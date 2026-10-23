import { Composer, type Context } from "grammy";
import { config } from "../config";
import { afterAnswerKeyboard, answerKeyboard, backToMenuKeyboard, CB, goPremiumKeyboard } from "../bot/keyboards";
import { saveAnswer } from "../db/answers";
import { getQuestion, getQuestionSuccess, getRandomFailedQuestion, getRandomQuestion } from "../db/questions";
import { getTopic } from "../db/topics";
import { consumeBonusQuestion } from "../db/users";
import { getStreak, streakLine } from "../services/progress";
import {
  correctPosition,
  decodeOrder,
  formatQuestion,
  formatResult,
  getQuota,
  modeHeader,
  parseMode,
  quotaLine,
  shuffledOrder,
  successLine,
  type QuizMode,
} from "../services/quiz";
import { rewardReferrerIfReady } from "../services/referrals";
import { isPremium } from "../services/subscription";
import { daysAgo } from "../services/time";

export const quizHandler = new Composer();

export const LIMIT_TEXT = [
  `🙌 ¡Buen trabajo! Has completado tus <b>${config.freeDailyLimit} preguntas gratis</b> de hoy.`,
  "",
  `Mañana a medianoche (hora peninsular) tendrás otras ${config.freeDailyLimit}.`,
  "",
  "¿Quieres seguir ahora?",
  `• Con <b>premium</b> tienes preguntas ilimitadas, repaso de fallos y simulacros por ${config.premiumPriceStars} ⭐ al mes.`,
  `• O invita a un amigo y gana <b>${config.referralBonus} preguntas extra</b> gratis.`,
].join("\n");

export const PREMIUM_ONLY_TEXT = [
  "🔒 <b>Repasar fallos</b> es una función premium.",
  "",
  "Con premium podrás practicar justo las preguntas que fallaste hasta dominarlas, hacer simulacros de examen y responder sin límite diario.",
].join("\n");

/**
 * Envía una pregunta según el modo: nueva al azar, de un tema o del repaso de
 * fallos. Comprueba antes el límite diario y el premium.
 */
export async function askQuestion(ctx: Context, mode: QuizMode): Promise<void> {
  const userId = ctx.from!.id;

  let question;
  if (mode.kind === "r") {
    if (!isPremium(userId)) {
      await ctx.reply(PREMIUM_ONLY_TEXT, { parse_mode: "HTML", reply_markup: goPremiumKeyboard() });
      return;
    }
    question = getRandomFailedQuestion(userId);
    if (!question) {
      await ctx.reply("🎯 ¡No tienes fallos pendientes! Sigue practicando con preguntas nuevas.", {
        reply_markup: backToMenuKeyboard().text("📝 Nueva pregunta", CB.newQuestion),
      });
      return;
    }
  } else {
    if (getQuota(userId).remaining <= 0) {
      await ctx.reply(LIMIT_TEXT, { parse_mode: "HTML", reply_markup: goPremiumKeyboard() });
      return;
    }
    if (mode.kind === "t" && !getTopic(mode.topicId)) {
      await ctx.reply("Ese tema ya no está disponible. Elige otro en «📚 Por temas».", {
        reply_markup: backToMenuKeyboard().text("📚 Por temas", CB.topics),
      });
      return;
    }
    const since = daysAgo(config.noRepeatDays).toISOString();
    question = getRandomQuestion(userId, since, mode.kind === "t" ? mode.topicId : undefined);
    if (!question) {
      await ctx.reply("Todavía no hay preguntas cargadas. Vuelve a intentarlo más tarde. 🙏", {
        reply_markup: backToMenuKeyboard(),
      });
      return;
    }
  }

  const order = shuffledOrder();
  await ctx.reply(formatQuestion(question, order, modeHeader(mode)), {
    parse_mode: "HTML",
    reply_markup: answerKeyboard(mode, question.id, order),
  });
}

quizHandler.callbackQuery(CB.newQuestion, async (ctx) => {
  await ctx.answerCallbackQuery();
  await askQuestion(ctx, { kind: "n" });
});

quizHandler.callbackQuery(CB.review, async (ctx) => {
  await ctx.answerCallbackQuery();
  await askQuestion(ctx, { kind: "r" });
});

// Pregunta de un tema concreto: "tp:<idTema>"
quizHandler.callbackQuery(/^tp:(\d{1,9})$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  await askQuestion(ctx, { kind: "t", topicId: Number(ctx.match[1]) });
});

// También como comandos, por comodidad
quizHandler.command("pregunta", (ctx) => askQuestion(ctx, { kind: "n" }));
quizHandler.command("repaso", (ctx) => askQuestion(ctx, { kind: "r" }));

// Respuesta a una pregunta: "a:<modo>:<idPregunta>:<orden>:<posición>"
quizHandler.callbackQuery(/^a:(n|r|t\d{1,9}):(\d+):(\d{4}):([0-3])$/, async (ctx) => {
  const userId = ctx.from.id;
  const message = ctx.callbackQuery.message;
  const [, modeText, idText, orderText, posText] = ctx.match;
  const mode = parseMode(modeText);
  const order = decodeOrder(orderText);
  const q = getQuestion(Number(idText));

  if (!message || !mode || !order || !q) {
    await ctx.answerCallbackQuery({ text: "Esta pregunta ya no está disponible." });
    return;
  }

  // Comprobaciones por si el usuario responde a mensajes antiguos
  const quota = getQuota(userId);
  if (mode.kind === "r" && !quota.premium) {
    await ctx.answerCallbackQuery({ text: "Tu suscripción premium no está activa.", show_alert: true });
    await ctx.reply(PREMIUM_ONLY_TEXT, { parse_mode: "HTML", reply_markup: goPremiumKeyboard() });
    return;
  }
  if (mode.kind !== "r" && quota.remaining <= 0) {
    await ctx.answerCallbackQuery({ text: "Has llegado al límite gratuito de hoy.", show_alert: true });
    await ctx.reply(LIMIT_TEXT, { parse_mode: "HTML", reply_markup: goPremiumKeyboard() });
    return;
  }

  const chosenPos = Number(posText);
  const isCorrect = chosenPos === correctPosition(q, order);

  // Si devuelve false es que ese mensaje ya estaba respondido (doble pulsación)
  if (!saveAnswer(userId, q.id, isCorrect, message.message_id)) {
    await ctx.answerCallbackQuery({ text: "Ya has respondido a esta pregunta." });
    return;
  }
  // Acabadas las gratis del día, cada respuesta gasta una pregunta extra
  if (!quota.premium && quota.freeLeft <= 0) consumeBonusQuestion(userId);

  await ctx.answerCallbackQuery({ text: isCorrect ? "✅ ¡Correcto!" : "❌ Incorrecto" });

  // Pie: % de usuarios que la aciertan, racha y preguntas que quedan
  const footer: string[] = [];
  const success = successLine(getQuestionSuccess(q.id));
  if (success) footer.push(success);
  const progress = [streakLine(getStreak(userId)), mode.kind !== "r" ? quotaLine(getQuota(userId)) : null].filter(
    (l): l is string => l !== null
  );
  if (progress.length > 0) footer.push(progress.join(" · "));

  await ctx.editMessageText(formatResult(q, order, chosenPos, footer), {
    parse_mode: "HTML",
    reply_markup: afterAnswerKeyboard(mode, q),
    link_preview_options: { is_disabled: true },
  });

  await rewardReferrerIfReady(ctx.api, userId, ctx.from.first_name);
});
