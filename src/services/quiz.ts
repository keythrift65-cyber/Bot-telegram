import { config } from "../config";
import { countAnswersSince } from "../db/answers";
import { LETTERS, optionsOf, type Question } from "../db/questions";
import { isPremium } from "./subscription";
import { startOfTodayIn } from "./time";

/** Modo de juego: "n" = nueva pregunta, "r" = repaso de fallos */
export type QuizMode = "n" | "r";

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

/** Texto de la pregunta con las opciones ya desordenadas */
export function formatQuestion(q: Question, order: Order, mode: QuizMode): string {
  const options = optionsOf(q);
  const header = mode === "r" ? "🔁 <b>Repaso de fallos</b>" : "📝 <b>Nueva pregunta</b>";
  const lines = order.map((orig, pos) => `<b>${LETTERS[pos]})</b> ${escapeHtml(options[orig])}`);
  return [
    header,
    `<i>${escapeHtml(q.topic)}</i>`,
    "",
    `<b>${escapeHtml(q.statement)}</b>`,
    "",
    ...lines,
  ].join("\n");
}

/** Texto que sustituye a la pregunta una vez respondida */
export function formatResult(q: Question, order: Order, chosenPos: number): string {
  const options = optionsOf(q);
  const rightPos = correctPosition(q, order);
  const isCorrect = chosenPos === rightPos;

  const lines = order.map((orig, pos) => {
    let mark = "▫️";
    if (pos === rightPos) mark = "✅";
    else if (pos === chosenPos) mark = "❌";
    return `${mark} <b>${LETTERS[pos]})</b> ${escapeHtml(options[orig])}`;
  });

  const result = [
    isCorrect ? "🎉 <b>¡Correcto!</b>" : "😕 <b>Has fallado</b>",
    `<i>${escapeHtml(q.topic)}</i>`,
    "",
    `<b>${escapeHtml(q.statement)}</b>`,
    "",
    ...lines,
    "",
    `Respuesta correcta: <b>${LETTERS[rightPos]}) ${escapeHtml(options[order[rightPos]])}</b>`,
  ];
  if (q.reference) result.push(`📖 ${escapeHtml(q.reference)}`);
  if (q.explanation) result.push(`💡 ${escapeHtml(q.explanation)}`);
  return result.join("\n");
}

/** Preguntas gratuitas que le quedan hoy al usuario (Infinity si es premium) */
export function remainingFreeToday(userId: number): number {
  if (isPremium(userId)) return Infinity;
  const since = startOfTodayIn(config.timeZone).toISOString();
  return Math.max(0, config.freeDailyLimit - countAnswersSince(userId, since));
}
