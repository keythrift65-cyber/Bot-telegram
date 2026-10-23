import { InlineKeyboard } from "grammy";
import { LETTERS, type Question } from "../db/questions";
import { encodeMode, encodeOrder, type Order, type QuizMode } from "../services/quiz";

/**
 * Datos de los botones (callback_data). Telegram admite como máximo 64 bytes.
 *   Respuesta:        "a:<modo>:<idPregunta>:<orden>:<posición>"  ej: "a:t3:42:2031:1"
 *   Tema:             "tp:<idTema>"        Ley (si hay varias): "tl:<índice>"
 *   Reportar error:   "rep:<idPregunta>"
 *   Simulacro:        "ex:<tamaño>" (empezar) · "x:<idSimulacro>:<posición>:<0-3 | b>" (responder)
 *                     "xs:<idSimulacro>" (terminar) · "xc:<idSimulacro>" (ver corrección)
 *   Recordatorio:     "rm:<hora>" · "rm:off"
 *   Anuncio (admin):  "bc:ok:<clave>" · "bc:no:<clave>"
 */
export const CB = {
  menu: "menu",
  newQuestion: "new",
  review: "review",
  myStats: "mystats",
  premium: "premium",
  topics: "topics",
  exam: "exam",
  invite: "invite",
  reminder: "remind",
} as const;

export function mainMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("📝 Nueva pregunta", CB.newQuestion)
    .text("📚 Por temas", CB.topics)
    .row()
    .text("🔁 Repasar fallos", CB.review)
    .text("🎓 Simulacro", CB.exam)
    .row()
    .text("📊 Mis estadísticas", CB.myStats)
    .text("🎁 Invitar amigos", CB.invite)
    .row()
    .text("⏰ Recordatorio", CB.reminder)
    .text("⭐ Premium", CB.premium);
}

/** Botones A, B, C, D de una pregunta */
export function answerKeyboard(mode: QuizMode, questionId: number, order: Order): InlineKeyboard {
  const kb = new InlineKeyboard();
  const encoded = encodeOrder(order);
  LETTERS.forEach((letter, pos) => kb.text(letter, `a:${encodeMode(mode)}:${questionId}:${encoded}:${pos}`));
  return kb;
}

/** A dónde lleva "Siguiente pregunta" según el modo */
export function nextCallback(mode: QuizMode): string {
  if (mode.kind === "r") return CB.review;
  if (mode.kind === "t") return `tp:${mode.topicId}`;
  return CB.newQuestion;
}

/** Botones que aparecen tras responder */
export function afterAnswerKeyboard(mode: QuizMode, q: Question): InlineKeyboard {
  const kb = new InlineKeyboard().text("➡️ Siguiente pregunta", nextCallback(mode)).row();
  if (q.source_url) kb.url("📖 Leer en el BOE", q.source_url);
  kb.text("⚠️ Reportar error", `rep:${q.id}`).row();
  return kb.text("🏠 Menú", CB.menu);
}

/** Botón para ir a la suscripción (se usa al llegar al límite y en las funciones premium) */
export function goPremiumKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("⭐ Hazte premium", CB.premium)
    .row()
    .text("🎁 Consigue preguntas extra", CB.invite)
    .row()
    .text("🏠 Menú", CB.menu);
}

/** Botón con el enlace de pago */
export function payKeyboard(invoiceLink: string, stars: number): InlineKeyboard {
  return new InlineKeyboard().url(`Suscribirme por ${stars} ⭐/mes`, invoiceLink).row().text("🏠 Menú", CB.menu);
}

export function backToMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("🏠 Menú", CB.menu);
}

/** Lista de temas: un botón por tema con su porcentaje de acierto (o su número de preguntas) */
export function topicsKeyboard(
  topics: { id: number; name: string; questions: number; pct: number | null }[],
  backTo: string = CB.menu
): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const t of topics) {
    const detail = t.pct !== null ? `${t.pct}%` : `${t.questions} preg.`;
    kb.text(`${t.name} · ${detail}`, `tp:${t.id}`).row();
  }
  kb.text("🎲 Todos los temas", CB.newQuestion).row();
  return kb.text(backTo === CB.menu ? "🏠 Menú" : "⬅️ Volver", backTo);
}

/** Lista de leyes, cuando hay preguntas de más de una */
export function lawsKeyboard(laws: string[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  laws.forEach((law, i) => kb.text(law, `tl:${i}`).row());
  return kb.text("🏠 Menú", CB.menu);
}

/** Elegir tamaño de simulacro */
export function examMenuKeyboard(sizes: readonly number[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const size of sizes) kb.text(`${size} preguntas`, `ex:${size}`);
  return kb.row().text("🏠 Menú", CB.menu);
}

/** Botones de una pregunta del simulacro */
export function examQuestionKeyboard(examId: number, position: number): InlineKeyboard {
  const kb = new InlineKeyboard();
  LETTERS.forEach((letter, pos) => kb.text(letter, `x:${examId}:${position}:${pos}`));
  return kb.row().text("⏭️ En blanco", `x:${examId}:${position}:b`).text("🛑 Terminar", `xs:${examId}`);
}

/** Botones al terminar un simulacro */
export function examResultKeyboard(examId: number, hasMistakes: boolean): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (hasMistakes) kb.text("📋 Ver corrección", `xc:${examId}`).row();
  return kb.text("🎓 Otro simulacro", CB.exam).row().text("🏠 Menú", CB.menu);
}

/** Elegir la hora del recordatorio diario */
export function reminderKeyboard(hours: readonly number[], current: number | null): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const hour of hours) kb.text(`${hour === current ? "✅ " : ""}${hour}:00`, `rm:${hour}`);
  kb.row();
  if (current !== null) kb.text("🔕 Desactivar", "rm:off").row();
  return kb.text("🏠 Menú", CB.menu);
}

/** Compartir el enlace de invitación */
export function inviteKeyboard(shareUrl: string): InlineKeyboard {
  return new InlineKeyboard().url("📤 Compartir mi enlace", shareUrl).row().text("🏠 Menú", CB.menu);
}
