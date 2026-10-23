import { config } from "../config";
import { countAnswersOnDay } from "../db/answers";
import { LETTERS, optionsOf, type Question } from "../db/questions";
import { getUser } from "../db/users";
import { isPremium } from "./subscription";
import { madridDay } from "./time";

/**
 * Modo de práctica, que viaja en los botones:
 *   "n"     → pregunta nueva al azar
 *   "r"     → repaso de fallos (premium)
 *   "t<id>" → pregunta del tema con ese id (ej: "t3")
 */
export type QuizMode = { kind: "n" } | { kind: "r" } | { kind: "t"; topicId: number };

export function encodeMode(mode: QuizMode): string {
  return mode.kind === "t" ? `t${mode.topicId}` : mode.kind;
}

export function parseMode(text: string): QuizMode | null {
  if (text === "n" || text === "r") return { kind: text };
  const m = text.match(/^t(\d{1,9})$/);
  return m ? { kind: "t", topicId: Number(m[1]) } : null;
}

/**
 * Orden en que se muestran las opciones. order[i] es el índice original (0=A … 3=D)
 * de la opción que aparece en la posición i. Se codifica como texto, ej: "2031".
 */
export type Order = number[];

/** Baraja las 4 opciones con Fisher-Yates */
export function shuffledOrder(): Order {
  const order = [0, 1, 2, 3];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

export function encodeOrder(order: Order): string {
  return order.join("");
}

/** Decodifica y valida un orden recibido en un callback */
export function decodeOrder(text: string): Order | null {
  if (!/^[0-3]{4}$/.test(text)) return null;
  const order = text.split("").map(Number);
  return new Set(order).size === 4 ? order : null;
}

/** Posición (0-3) en la que se muestra la respuesta correcta */
export function correctPosition(q: Question, order: Order): number {
  return order.indexOf(LETTERS.indexOf(q.correct));
}

/** Escapa texto para usarlo con parse_mode HTML */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Cabecera de la pregunta según el modo */
export function modeHeader(mode: QuizMode): string {
  if (mode.kind === "r") return "🔁 <b>Repaso de fallos</b>";
  if (mode.kind === "t") return "📚 <b>Practicando por tema</b>";
  return "📝 <b>Pregunta</b>";
}

/** Texto de la pregunta con las opciones ya desordenadas */
export function formatQuestion(q: Question, order: Order, header: string): string {
  const options = optionsOf(q);
  const lines = order.map((orig, pos) => `<b>${LETTERS[pos]})</b> ${escapeHtml(options[orig])}`);
  return [header, `<i>${escapeHtml(q.topic)}</i>`, "", `<b>${escapeHtml(q.statement)}</b>`, "", ...lines].join("\n");
}

/**
 * De dónde sale la pregunta: ley, Título/Capítulo/Sección y artículo, y el examen
 * oficial en el que apareció si se conoce.
 */
export function formatSource(q: Question): string[] {
  const location = q.location.split("\n").filter(Boolean);
  const showReference = q.reference && q.reference !== q.law;
  // Preguntas importadas con versiones antiguas: solo tienen el artículo
  if (!q.law && location.length === 0) {
    const lines = showReference ? [`📖 ${escapeHtml(q.reference)}`] : [];
    if (q.exam) lines.push(`🏛️ Apareció en: <b>${escapeHtml(q.exam)}</b>`);
    return lines;
  }

  const lines = ["📚 <b>De dónde sale</b>"];
  if (q.law) lines.push(escapeHtml(q.law));
  for (const level of location) lines.push(`› ${escapeHtml(level)}`);
  if (showReference) lines.push(`› <b>${escapeHtml(q.reference)}</b>`);
  if (q.exam) lines.push(`🏛️ Apareció en: <b>${escapeHtml(q.exam)}</b>`);
  return lines;
}

/** Marca de cada opción tras responder */
function optionLines(q: Question, order: Order, chosenPos: number | null): string[] {
  const options = optionsOf(q);
  const rightPos = correctPosition(q, order);
  return order.map((orig, pos) => {
    let mark = "▫️";
    if (pos === rightPos) mark = "✅";
    else if (pos === chosenPos) mark = "❌";
    return `${mark} <b>${LETTERS[pos]})</b> ${escapeHtml(options[orig])}`;
  });
}

/** Texto que sustituye a la pregunta una vez respondida */
export function formatResult(q: Question, order: Order, chosenPos: number, footer: string[] = []): string {
  const options = optionsOf(q);
  const rightPos = correctPosition(q, order);
  const isCorrect = chosenPos === rightPos;

  const result = [
    isCorrect ? "🎉 <b>¡Correcto!</b>" : "😕 <b>Has fallado</b>",
    `<i>${escapeHtml(q.topic)}</i>`,
    "",
    `<b>${escapeHtml(q.statement)}</b>`,
    "",
    ...optionLines(q, order, chosenPos),
    "",
    `Respuesta correcta: <b>${LETTERS[rightPos]}) ${escapeHtml(options[order[rightPos]])}</b>`,
  ];
  if (q.explanation) result.push(`💡 ${escapeHtml(q.explanation)}`);

  const source = formatSource(q);
  if (source.length > 0) result.push("", ...source);
  if (footer.length > 0) result.push("", ...footer);
  return result.join("\n");
}

/** Línea con el porcentaje de usuarios que acierta la pregunta (si hay respuestas suficientes) */
export function successLine(stats: { total: number; correct: number }): string | null {
  if (stats.total < config.minAnswersForQuestionStats) return null;
  const pct = Math.round((stats.correct / stats.total) * 100);
  return `👥 El <b>${pct}%</b> de los usuarios acierta esta pregunta`;
}

// ---------------------------------------------------------------------------
// Cupo diario
// ---------------------------------------------------------------------------

export interface Quota {
  premium: boolean;
  /** Preguntas respondidas hoy */
  usedToday: number;
  /** Preguntas gratis que quedan hoy */
  freeLeft: number;
  /** Preguntas extra conseguidas invitando a amigos */
  bonus: number;
  /** Total que puede responder ahora (Infinity si es premium) */
  remaining: number;
}

/** Cuántas preguntas puede responder hoy el usuario */
export function getQuota(userId: number): Quota {
  const premium = isPremium(userId);
  const usedToday = countAnswersOnDay(userId, madridDay());
  const freeLeft = Math.max(0, config.freeDailyLimit - usedToday);
  const bonus = getUser(userId)?.bonus_questions ?? 0;
  return { premium, usedToday, freeLeft, bonus, remaining: premium ? Infinity : freeLeft + bonus };
}

/** Texto corto del cupo para el pie de las respuestas, ej: "Te quedan 6 de 10 preguntas gratis hoy" */
export function quotaLine(quota: Quota): string | null {
  if (quota.premium) return null;
  const extra = quota.bonus > 0 ? ` (+${quota.bonus} extra)` : "";
  return `Te quedan <b>${quota.freeLeft}</b> de ${config.freeDailyLimit} preguntas gratis hoy${extra}`;
}
