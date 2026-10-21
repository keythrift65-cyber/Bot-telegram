import { InlineKeyboard } from "grammy";
import { LETTERS } from "../db/questions";
import { encodeOrder, type Order, type QuizMode } from "../services/quiz";

/**
 * Datos de los botones (callback_data). Telegram admite como máximo 64 bytes.
 * Respuesta: "a:<modo>:<idPregunta>:<orden>:<posiciónElegida>", ej: "a:n:42:2031:1"
 */
export const CB = {
  menu: "menu",
  newQuestion: "new",
  review: "review",
  myStats: "mystats",
  premium: "premium",
} as const;

export function mainMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("📝 Nueva pregunta", CB.newQuestion)
    .row()
    .text("🔁 Repasar fallos", CB.review)
    .row()
    .text("📊 Mis estadísticas", CB.myStats)
    .row()
    .text("⭐ Hazte premium", CB.premium);
}

/** Botones A, B, C, D de una pregunta */
export function answerKeyboard(mode: QuizMode, questionId: number, order: Order): InlineKeyboard {
  const kb = new InlineKeyboard();
  const encoded = encodeOrder(order);
  LETTERS.forEach((letter, pos) => kb.text(letter, `a:${mode}:${questionId}:${encoded}:${pos}`));
  return kb;
}

/** Botones que aparecen tras responder */
export function afterAnswerKeyboard(mode: QuizMode): InlineKeyboard {
  return new InlineKeyboard()
    .text("➡️ Siguiente pregunta", mode === "r" ? CB.review : CB.newQuestion)
    .row()
    .text("🏠 Menú", CB.menu);
}

/** Botón para ir a la suscripción (se usa al llegar al límite y en "Repasar fallos") */
export function goPremiumKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("⭐ Hazte premium", CB.premium).row().text("🏠 Menú", CB.menu);
}

/** Botón con el enlace de pago */
export function payKeyboard(invoiceLink: string, stars: number): InlineKeyboard {
  return new InlineKeyboard().url(`Suscribirme por ${stars} ⭐/mes`, invoiceLink).row().text("🏠 Menú", CB.menu);
}

export function backToMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("🏠 Menú", CB.menu);
}
