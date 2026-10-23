import type { Api } from "grammy";
import { config } from "../config";
import { countAnswersTotal } from "../db/answers";
import { addBonusQuestions, claimReferralReward, getUser, setReferrer, setSourceIfEmpty } from "../db/users";
import { sendSafely } from "./messaging";
import { escapeHtml } from "./quiz";

/** Prefijo del enlace de invitación: https://t.me/tubot?start=ref_123456 */
const REFERRAL_PREFIX = "ref_";

/** Enlace personal de invitación */
export function referralLink(botUsername: string, userId: number): string {
  return `https://t.me/${botUsername}?start=${REFERRAL_PREFIX}${userId}`;
}

/** Enlace para compartir en Telegram con un texto ya escrito */
export function shareUrl(link: string): string {
  const text = `Estoy preparando la oposición de Auxiliar Administrativo del Estado con este bot: ${config.freeDailyLimit} preguntas gratis al día, con su artículo y explicación. ¡Pruébalo!`;
  return `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
}

/** Id de quien invita a partir del parámetro de /start, o null si no es una invitación */
export function parseReferral(payload: string): number | null {
  const m = payload.match(/^ref_(\d{1,15})$/);
  return m ? Number(m[1]) : null;
}

/**
 * Aplica una invitación a un usuario que acaba de llegar: apunta quién le invitó,
 * su origen ("amigo") y le regala las preguntas de bienvenida. Solo vale para
 * usuarios que aún no han respondido nada y nunca para invitarse a uno mismo.
 * Devuelve true si se ha aplicado.
 */
export function applyReferral(userId: number, referrerId: number): boolean {
  if (referrerId === userId || !getUser(referrerId)) return false;
  if (countAnswersTotal(userId) > 0) return false;
  if (!setReferrer(userId, referrerId)) return false;

  setSourceIfEmpty(userId, "amigo");
  addBonusQuestions(userId, config.referralWelcomeBonus);
  console.log(`[INVITACIÓN] Usuario ${userId} llega invitado por ${referrerId}`);
  return true;
}

/**
 * Cuando el invitado ya ha respondido sus primeras preguntas, premia (una sola vez)
 * a quien le invitó y le avisa. Nunca lanza errores.
 */
export async function rewardReferrerIfReady(api: Api, userId: number, firstName: string): Promise<void> {
  try {
    const user = getUser(userId);
    if (!user?.referred_by || user.referral_rewarded) return;
    if (countAnswersTotal(userId) < config.referralRequiredAnswers) return;

    const referrerId = claimReferralReward(userId);
    if (referrerId === null) return;
    addBonusQuestions(referrerId, config.referralBonus);
    console.log(`[INVITACIÓN] ${referrerId} gana ${config.referralBonus} preguntas extra por invitar a ${userId}`);

    await sendSafely(
      api,
      referrerId,
      `🎉 <b>${escapeHtml(firstName)}</b>, a quien invitaste, ya está practicando. ¡Has ganado <b>${config.referralBonus} preguntas extra</b>!\n\nSe usan cuando terminas las gratis del día.`,
      { parse_mode: "HTML" }
    );
  } catch (err) {
    console.error("[INVITACIÓN] Error al premiar la invitación:", err);
  }
}
