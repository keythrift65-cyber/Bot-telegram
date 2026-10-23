import { Composer, type Context } from "grammy";
import { config } from "../config";
import { CB, examMenuKeyboard, examQuestionKeyboard, examResultKeyboard, goPremiumKeyboard } from "../bot/keyboards";
import { saveAnswer } from "../db/answers";
import {
  finishExam,
  getExam,
  getExamQuestion,
  getNextPending,
  saveExamAnswer,
  type ExamQuestion,
  type ExamResult,
} from "../db/exams";
import { getQuestion, LETTERS, type Letter } from "../db/questions";
import { createRandomExam, formatCorrections, formatExamQuestion, formatExamSummary, penaltyText } from "../services/exam";
import { decodeOrder } from "../services/quiz";
import { rewardReferrerIfReady } from "../services/referrals";
import { isPremium } from "../services/subscription";

export const examHandler = new Composer();

const PREMIUM_ONLY_TEXT = [
  "🔒 <b>Los simulacros de examen</b> son una función premium.",
  "",
  "Haz un examen de 10, 25 o 50 preguntas sin ver la corrección hasta el final, con la penalización por fallo del examen real, y descubre tu nota y qué temas reforzar.",
].join("\n");

/** Pantalla para elegir el tamaño del simulacro */
async function showExamMenu(ctx: Context): Promise<void> {
  if (!isPremium(ctx.from!.id)) {
    await ctx.reply(PREMIUM_ONLY_TEXT, { parse_mode: "HTML", reply_markup: goPremiumKeyboard() });
    return;
  }
  await ctx.reply(
    [
      "🎓 <b>Simulacro de examen</b>",
      "",
      "• No verás si aciertas hasta el final, como en el examen real.",
      `• Cada fallo resta ${penaltyText()}. Si dudas mucho, puedes dejar la pregunta en blanco.`,
      "• Al terminar tendrás tu nota, el tiempo y la corrección de los fallos.",
      "",
      "¿De cuántas preguntas?",
    ].join("\n"),
    { parse_mode: "HTML", reply_markup: examMenuKeyboard(config.examSizes) }
  );
}

async function sendExamQuestion(ctx: Context, examId: number, eq: ExamQuestion, total: number): Promise<void> {
  const q = getQuestion(eq.question_id);
  if (!q) return;
  await ctx.reply(formatExamQuestion(q, eq, total), {
    parse_mode: "HTML",
    reply_markup: examQuestionKeyboard(examId, eq.position),
  });
}

/** Termina el simulacro y envía el resumen (solo la primera vez) */
async function finishAndReport(ctx: Context, examId: number): Promise<void> {
  if (!finishExam(examId)) return;
  const exam = getExam(examId)!;
  console.log(`[SIMULACRO] Usuario ${exam.user_id} · ${exam.correct}/${exam.size} aciertos, ${exam.wrong} fallos`);
  await ctx.reply(formatExamSummary(exam), {
    parse_mode: "HTML",
    reply_markup: examResultKeyboard(examId, exam.wrong + exam.blank > 0),
  });
}

examHandler.callbackQuery(CB.exam, async (ctx) => {
  await ctx.answerCallbackQuery();
  await showExamMenu(ctx);
});

examHandler.command("simulacro", (ctx) => showExamMenu(ctx));

// Empezar un simulacro: "ex:<tamaño>"
examHandler.callbackQuery(/^ex:(\d{1,3})$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const size = Number(ctx.match[1]);
  if (!(config.examSizes as readonly number[]).includes(size)) return;
  if (!isPremium(ctx.from.id)) {
    await ctx.reply(PREMIUM_ONLY_TEXT, { parse_mode: "HTML", reply_markup: goPremiumKeyboard() });
    return;
  }

  const examId = createRandomExam(ctx.from.id, size);
  const first = examId !== null ? getNextPending(examId) : undefined;
  if (examId === null || !first) {
    await ctx.reply("Todavía no hay preguntas suficientes para un simulacro. 🙏");
    return;
  }
  await sendExamQuestion(ctx, examId, first, getExam(examId)!.size);
});

// Responder: "x:<idSimulacro>:<posición>:<0-3 | b>"
examHandler.callbackQuery(/^x:(\d+):(\d+):([0-3]|b)$/, async (ctx) => {
  const [, examText, positionText, choice] = ctx.match;
  const examId = Number(examText);
  const exam = getExam(examId);
  const message = ctx.callbackQuery.message;

  if (!exam || exam.user_id !== ctx.from.id || !message) {
    await ctx.answerCallbackQuery({ text: "Este simulacro no está disponible." });
    return;
  }
  if (exam.status !== "active") {
    await ctx.answerCallbackQuery({ text: "Este simulacro ya ha terminado." });
    return;
  }

  const eq = getExamQuestion(examId, Number(positionText));
  const q = eq ? getQuestion(eq.question_id) : undefined;
  const order = eq ? decodeOrder(eq.option_order) : null;
  if (!eq || !q || !order || eq.result !== null) {
    await ctx.answerCallbackQuery({ text: "Ya habías respondido esta pregunta." });
    return;
  }

  // Letra original elegida (las opciones se muestran desordenadas)
  const chosen: Letter | null = choice === "b" ? null : LETTERS[order[Number(choice)]];
  const result: ExamResult = chosen === null ? "blank" : chosen === q.correct ? "ok" : "fail";
  if (!saveExamAnswer(examId, eq.position, result, chosen)) {
    await ctx.answerCallbackQuery({ text: "Ya habías respondido esta pregunta." });
    return;
  }
  // Las respuestas del simulacro también cuentan para las estadísticas y el repaso de fallos
  if (chosen !== null) saveAnswer(ctx.from.id, q.id, result === "ok", message.message_id);

  await ctx.answerCallbackQuery({ text: chosen === null ? "⏭️ En blanco" : "📝 Respuesta guardada" });
  const answerLine =
    chosen === null ? "⏭️ <i>La has dejado en blanco</i>" : `📝 Has respondido: <b>${LETTERS[Number(choice)]}</b>`;
  await ctx.editMessageText(formatExamQuestion(q, eq, exam.size, answerLine), { parse_mode: "HTML" });

  const next = getNextPending(examId);
  if (next) await sendExamQuestion(ctx, examId, next, exam.size);
  else await finishAndReport(ctx, examId);

  if (chosen !== null) await rewardReferrerIfReady(ctx.api, ctx.from.id, ctx.from.first_name);
});

// Terminar antes de tiempo: lo que falte cuenta como en blanco
examHandler.callbackQuery(/^xs:(\d+)$/, async (ctx) => {
  const examId = Number(ctx.match[1]);
  const exam = getExam(examId);
  if (!exam || exam.user_id !== ctx.from.id || exam.status !== "active") {
    await ctx.answerCallbackQuery({ text: "Este simulacro ya ha terminado." });
    return;
  }
  await ctx.answerCallbackQuery({ text: "🛑 Simulacro terminado" });
  try {
    await ctx.editMessageReplyMarkup(); // Quita los botones de la pregunta que estaba en pantalla
  } catch {
    /* El mensaje puede ser antiguo o no tener botones */
  }
  await finishAndReport(ctx, examId);
});

// Ver la corrección de los fallos y las preguntas en blanco
examHandler.callbackQuery(/^xc:(\d+)$/, async (ctx) => {
  const examId = Number(ctx.match[1]);
  const exam = getExam(examId);
  if (!exam || exam.user_id !== ctx.from.id || exam.status !== "finished") {
    await ctx.answerCallbackQuery({ text: "No se encuentra este simulacro." });
    return;
  }
  await ctx.answerCallbackQuery();
  for (const text of formatCorrections(examId)) {
    await ctx.reply(text, { parse_mode: "HTML" });
  }
  await ctx.reply("¿Qué hacemos ahora?", { reply_markup: examResultKeyboard(examId, false) });
});
