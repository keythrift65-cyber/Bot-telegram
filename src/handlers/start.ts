import { Composer } from "grammy";
import { config } from "../config";
import { CB, mainMenuKeyboard } from "../bot/keyboards";
import { countAnswersTotal } from "../db/answers";
import { countQuestions } from "../db/questions";
import { listLaws } from "../db/topics";
import { setSourceIfEmpty } from "../db/users";
import { getStreak, streakLine } from "../services/progress";
import { escapeHtml, getQuota } from "../services/quiz";
import { applyReferral, parseReferral } from "../services/referrals";
import { lawLabel } from "../services/sources";

export const startHandler = new Composer();

function welcomeText(userId: number, firstName: string, invited: boolean): string {
  const quota = getQuota(userId);
  const plan = quota.premium
    ? "⭐ Eres <b>premium</b>: preguntas ilimitadas, repaso de fallos y simulacros."
    : `Tienes <b>${config.freeDailyLimit} preguntas gratis al día</b> (se reinician a medianoche)${
        quota.bonus > 0 ? ` y <b>${quota.bonus} extra</b>` : ""
      }. Con premium no hay límite.`;
  const questions = countQuestions();
  const laws = listLaws();

  const lines = [
    `👋 ¡Hola, ${escapeHtml(firstName)}!`,
    "",
    `Prepara la oposición de <b>Auxiliar Administrativo del Estado</b> con ${
      questions > 0 ? `<b>${questions} preguntas</b>` : "preguntas"
    } tipo test${laws.length > 0 ? ":" : "."}`,
    ...laws.map((l) => `• ${escapeHtml(lawLabel(l.law))}: <b>${l.questions}</b>`),
    "",
    "Cada pregunta te dice <b>de dónde sale</b> (Título, artículo y enlace al BOE) y por qué es la correcta.",
    "",
    plan,
  ];
  if (invited) lines.push(`🎁 Has entrado con la invitación de un amigo: tienes <b>${config.referralWelcomeBonus} preguntas extra</b>.`);
  const streak = streakLine(getStreak(userId));
  if (streak) lines.push(streak);
  lines.push("", "¿Qué quieres hacer?");
  return lines.join("\n");
}

startHandler.command("start", async (ctx) => {
  if (!ctx.from) return;
  const userId = ctx.from.id;

  // Enlaces con origen: https://t.me/tubot?start=canal → ctx.match = "canal".
  // Invitaciones: https://t.me/tubot?start=ref_123 → le invitó el usuario 123.
  // Solo cuentan para usuarios nuevos (sin respuestas todavía) y nunca se sobrescriben.
  const payload = ctx.match.trim();
  let invited = false;
  const referrerId = parseReferral(payload);
  if (referrerId !== null) {
    invited = applyReferral(userId, referrerId);
  } else if (/^[a-zA-Z0-9_-]{1,32}$/.test(payload) && countAnswersTotal(userId) === 0) {
    if (setSourceIfEmpty(userId, payload.toLowerCase())) {
      console.log(`[ORIGEN] Usuario ${userId} llega desde "${payload}"`);
    }
  }

  await ctx.reply(welcomeText(userId, ctx.from.first_name, invited), {
    parse_mode: "HTML",
    reply_markup: mainMenuKeyboard(),
  });
});

// Botón "Menú": muestra el menú principal en un mensaje nuevo
startHandler.callbackQuery(CB.menu, async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply("🏠 Menú principal. ¿Qué quieres hacer?", { reply_markup: mainMenuKeyboard() });
});
