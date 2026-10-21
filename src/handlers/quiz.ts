import { Composer, type Context } from "grammy";
import { config } from "../config";
import {
  afterAnswerKeyboard,
  answerKeyboard,
  backToMenuKeyboard,
  CB,
  goPremiumKeyboard,
} from "../bot/keyboards";
import { saveAnswer } from "../db/answers";
import {
  getQuestion,
  getRandomFailedQuestion,
  getRandomQuestion,
  type Question,
} from "../db/questions";
import {
  correctPosition,
  decodeOrder,
  formatQuestion,
  formatResult,
  remainingFreeToday,
  shuffledOrder,
  type QuizMode,
} from "../services/quiz";
import { isPremium } from "../services/subscription";
import { daysAgo } from "../services/time";

export const quizHandler = new Composer();

const LIMIT_TEXT = [
  "🙌 ¡Buen trabajo! Has completado tus <b>" + config.freeDailyLimit + " preguntas gratis</b> de hoy.",
  "",
  "Mañana a medianoche (hora peninsular) tendrás otras " + config.freeDailyLimit + ".",
  `Si quieres seguir practicando ahora, con <b>premium</b> tienes preguntas ilimitadas y el repaso de tus fallos por ${config.premiumPriceStars} ⭐ al mes.`,
].join("\n");

const PREMIUM_ONLY_TEXT = [
  "🔒 <b>Repasar fallos</b> es una función premium.",
  "",
  "Con premium podrás practicar justo las preguntas que fallaste hasta dominarlas, y sin límite diario.",
].join("\n");

/** Envía una pregunta con las opciones desordenadas */
async function sendQuestion(ctx: Context, q: Question, mode: QuizMode): Promise<void> {
  const order = shuffledOrder();
  await ctx.reply(formatQuestion(q, order, mode), {
    parse_mode: "HTML",
    reply_markup: answerKeyboard(mode, q.id, order),
  });
}

/** Nueva pregunta aleatoria (respetando el límite diario) */
async function newQuestion(ctx: Context): Promise<void> {
  const userId = ctx.from!.id;

  if (remainingFreeToday(userId) <= 0) {
    await ctx.reply(LIMIT_TEXT, { parse_mode: "HTML", reply_markup: goPremiumKeyboard() });
    return;
  }

  const since = daysAgo(config.noRepeatDays).toISOString();
  const q = getRandomQuestion(userId, since);
  if (!q) {
    await ctx.reply("Todavía no hay preguntas cargadas. Vuelve a intentarlo más tarde. 🙏", {
      reply_markup: backToMenuKeyboard(),
    });
    return;
  }
  await sendQuestion(ctx, q, "n");
}

/** Pregunta del repaso de fallos (solo premium) */
async function reviewQuestion(ctx: Context): Promise<void> {
  const userId = ctx.from!.id;

  if (!isPremium(userId)) {
    await ctx.reply(PREMIUM_ONLY_TEXT, { parse_mode: "HTML", reply_markup: goPremiumKeyboard() });
    return;
  }

  const q = getRandomFailedQuestion(userId);
  if (!q) {
    await ctx.reply("🎯 ¡No tienes fallos pendientes! Sigue practicando con preguntas nuevas.", {
      reply_markup: backToMenuKeyboard().text("📝 Nueva pregunta", CB.newQuestion),
    });
    return;
  }
  await sendQuestion(ctx, q, "r");
}

quizHandler.callbackQuery(CB.newQuestion, async (ctx) => {
  await ctx.answerCallbackQuery();
  await newQuestion(ctx);
});

quizHandler.callbackQuery(CB.review, async (ctx) => {
  await ctx.answerCallbackQuery();
  await reviewQuestion(ctx);
});

// También como comandos, por comodidad
quizHandler.command("pregunta", (ctx) => newQuestion(ctx));
quizHandler.command("repaso", (ctx) => reviewQuestion(ctx));

// Respuesta a una pregunta: "a:<modo>:<idPregunta>:<orden>:<posición>"
quizHandler.callbackQuery(/^a:([nr]):(\d+):(\d{4}):([0-3])$/, async (ctx) => {
  const userId = ctx.from.id;
  const message = ctx.callbackQuery.message;
  const [, modeText, idText, orderText, posText] = ctx.match;
  const mode = modeText as QuizMode;
  const order = decodeOrder(orderText);
  const q = getQuestion(Number(idText));

  if (!message || !order || !q) {
    await ctx.answerCallbackQuery({ text: "Esta pregunta ya no está disponible." });
    return;
  }

  // Comprobaciones por si el usuario responde a mensajes antiguos
  if (mode === "r" && !isPremium(userId)) {
    await ctx.answerCallbackQuery({ text: "Tu suscripción premium no está activa.", show_alert: true });
    await ctx.reply(PREMIUM_ONLY_TEXT, { parse_mode: "HTML", reply_markup: goPremiumKeyboard() });
    return;
  }
  if (mode === "n" && remainingFreeToday(userId) <= 0) {
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

  await ctx.answerCallbackQuery({ text: isCorrect ? "✅ ¡Correcto!" : "❌ Incorrecto" });

  let text = formatResult(q, order, chosenPos);
  const remaining = remainingFreeToday(userId);
  if (mode === "n" && Number.isFinite(remaining)) {
    text += `\n\n<i>Te quedan ${remaining} de ${config.freeDailyLimit} preguntas gratis hoy.</i>`;
  }

  await ctx.editMessageText(text, {
    parse_mode: "HTML",
    reply_markup: afterAnswerKeyboard(mode),
  });
});

