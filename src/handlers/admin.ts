import { Composer, GrammyError } from "grammy";
import { config } from "../config";
import { countQuestions } from "../db/questions";
import { getPayment, markRefunded, totalStarsEarned } from "../db/payments";
import { countActivePremium, countUsers, getStatsBySource, setSubscriptionEnd } from "../db/users";
import { escapeHtml } from "../services/quiz";
import { sendUserStats } from "./stats";

export const adminHandler = new Composer();

const isAdmin = (id: number | undefined) => id === config.adminId;

// /stats: estadísticas del bot para el admin; el resto de usuarios ve las suyas
adminHandler.command("stats", async (ctx) => {
  if (!isAdmin(ctx.from?.id)) {
    await sendUserStats(ctx);
    return;
  }

  await ctx.reply(
    [
      "🛠 <b>Estadísticas del bot</b>",
      "",
      `👥 Usuarios totales: <b>${countUsers()}</b>`,
      `⭐ Premium activos: <b>${countActivePremium(new Date().toISOString())}</b>`,
      `💰 Estrellas ganadas: <b>${totalStarsEarned()}</b> ⭐`,
      `❓ Preguntas en la base de datos: <b>${countQuestions()}</b>`,
    ].join("\n"),
    { parse_mode: "HTML" }
  );
});

// /refund <user_id> <charge_id>: devuelve un pago en Stars
adminHandler.command("refund", async (ctx) => {
  if (!isAdmin(ctx.from?.id)) return; // Se ignora en silencio para el resto de usuarios

  const [userIdText, chargeId] = ctx.match.trim().split(/\s+/);
  const userId = Number(userIdText);
  if (!Number.isInteger(userId) || !chargeId) {
    await ctx.reply("Uso: /refund <user_id> <telegram_payment_charge_id>");
    return;
  }

  try {
    await ctx.api.refundStarPayment(userId, chargeId);
  } catch (err) {
    const reason = err instanceof GrammyError ? err.description : String(err);
    console.error(`[REEMBOLSO] Error al reembolsar ${chargeId} a ${userId}:`, reason);
    await ctx.reply(`❌ No se pudo hacer el reembolso: ${reason}`);
    return;
  }

  // Cancelamos también la renovación automática (si ya no aplica, Telegram dará error y lo ignoramos)
  try {
    await ctx.api.editUserStarSubscription(userId, chargeId, true);
  } catch {
    /* ignorar */
  }

  // Quitamos el premium si el pago estaba registrado
  const payment = getPayment(userId, chargeId);
  markRefunded(chargeId);
  if (payment) setSubscriptionEnd(userId, null);

  console.log(`[REEMBOLSO] Pago ${chargeId} reembolsado al usuario ${userId} (${payment?.stars ?? "?"} ⭐)`);
  await ctx.reply(
    `✅ Reembolso hecho al usuario ${userId}.` +
      (payment ? " Se le ha retirado el premium." : " (Ese pago no estaba en la base de datos.)")
  );

  try {
    await ctx.api.sendMessage(
      userId,
      "💸 Te hemos devuelto el pago de tu suscripción premium. Tu cuenta vuelve al plan gratuito."
    );
  } catch {
    /* El usuario puede haber bloqueado el bot */
  }
});

// /origenes: de dónde llegan los usuarios (enlaces https://t.me/tubot?start=<origen>)
adminHandler.command("origenes", async (ctx) => {
  if (!isAdmin(ctx.from?.id)) return;

  const rows = getStatsBySource(new Date().toISOString());
  const total = rows.reduce((sum, r) => sum + r.total, 0);
  const pct = (n: number) => `${Math.round((n / total) * 100)}%`;
  const lines = rows.map((r) => {
    const name = r.source ? escapeHtml(r.source) : "<i>sin origen</i>";
    return `• <b>${name}</b>: ${r.total} ${r.total === 1 ? "usuario" : "usuarios"} (${pct(r.total)}) · ${r.premium} premium · ${r.stars} ⭐`;
  });

  await ctx.reply(
    [
      "🧭 <b>Origen de los usuarios</b>",
      "",
      ...lines,
      "",
      `Total: <b>${total}</b> usuarios`,
      "",
      "<i>Premium = suscripción activa ahora. ⭐ = estrellas pagadas en total (sin reembolsos). «Sin origen» = entraron sin enlace con ?start=… o antes de medirlo.</i>",
    ].join("\n"),
    { parse_mode: "HTML" }
  );
});
