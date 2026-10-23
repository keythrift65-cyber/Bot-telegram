import { randomBytes } from "node:crypto";
import { Composer, GrammyError, InlineKeyboard } from "grammy";
import { config } from "../config";
import { countAllAnswers, countAllAnswersOnDay } from "../db/answers";
import { countFinishedExams } from "../db/exams";
import {
  countInactiveQuestions,
  countQuestions,
  countQuestionsByLaw,
  getQuestion,
  getQuestionByCode,
  getQuestionSuccess,
  LETTERS,
  optionsOf,
} from "../db/questions";
import { getPayment, markRefunded, totalStarsEarned } from "../db/payments";
import { countOpenReports, countReportsForQuestion } from "../db/reports";
import {
  countActivePremium,
  countBlockedUsers,
  countUsers,
  countUsersSeenSince,
  countUsersWithReminder,
  getStatsBySource,
  listReachableUserIds,
  setSubscriptionEnd,
} from "../db/users";
import { sendSafely, sendToMany } from "../services/messaging";
import { escapeHtml, formatSource } from "../services/quiz";
import { daysAgo, madridDay, startOfTodayIn } from "../services/time";
import { sendUserStats } from "./stats";

export const adminHandler = new Composer();

const isAdmin = (id: number | undefined) => id === config.adminId;

// /stats: estadísticas del bot para el admin; el resto de usuarios ve las suyas
adminHandler.command("stats", async (ctx) => {
  if (!isAdmin(ctx.from?.id)) {
    await sendUserStats(ctx);
    return;
  }

  const now = new Date();
  const byLaw = countQuestionsByLaw();
  const inactive = countInactiveQuestions();
  await ctx.reply(
    [
      "🛠 <b>Estadísticas del bot</b>",
      "",
      `👥 Usuarios totales: <b>${countUsers()}</b>`,
      `🟢 Activos hoy: <b>${countUsersSeenSince(startOfTodayIn(config.timeZone).toISOString())}</b> · últimos 7 días: <b>${countUsersSeenSince(daysAgo(7, now).toISOString())}</b>`,
      `🚫 Han bloqueado el bot: <b>${countBlockedUsers()}</b> · ⏰ con recordatorio: <b>${countUsersWithReminder()}</b>`,
      "",
      `⭐ Premium activos: <b>${countActivePremium(now.toISOString())}</b>`,
      `💰 Estrellas ganadas: <b>${totalStarsEarned()}</b> ⭐`,
      "",
      `📝 Respuestas hoy: <b>${countAllAnswersOnDay(madridDay(now))}</b> · en total: <b>${countAllAnswers()}</b>`,
      `🎓 Simulacros terminados: <b>${countFinishedExams()}</b>`,
      `⚠️ Reportes pendientes: <b>${countOpenReports()}</b> (/reportes)`,
      "",
      `❓ Preguntas activas: <b>${countQuestions()}</b>${inactive ? ` · retiradas: ${inactive}` : ""}`,
      ...byLaw.map((l) => `   • ${escapeHtml(l.law)}: ${l.n}`),
    ].join("\n"),
    { parse_mode: "HTML" }
  );
});

// /refund <user_id> <charge_id>: devuelve un pago en Stars
adminHandler.command("refund", async (ctx, next) => {
  if (!isAdmin(ctx.from?.id)) return next(); // Para el resto de usuarios es un comando desconocido

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
adminHandler.command("origenes", async (ctx, next) => {
  if (!isAdmin(ctx.from?.id)) return next();

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

// /ver <id o código>: ficha completa de una pregunta (para revisar reportes)
adminHandler.command("ver", async (ctx, next) => {
  if (!isAdmin(ctx.from?.id)) return next();
  const key = ctx.match.trim();
  if (!key) {
    await ctx.reply("Uso: /ver <número o id de la pregunta> (ej: /ver CE-017)");
    return;
  }
  const q = /^\d+$/.test(key) ? getQuestion(Number(key)) : getQuestionByCode(key);
  if (!q) {
    await ctx.reply(`No encuentro la pregunta "${key}". Usa su número o su id (ej: CE-017).`);
    return;
  }
  const options = optionsOf(q);
  const success = getQuestionSuccess(q.id);
  await ctx.reply(
    [
      `🔎 <b>Pregunta #${q.id}</b>${q.code ? ` · ${escapeHtml(q.code)}` : ""}${q.active ? "" : " · <b>RETIRADA</b>"}`,
      `<i>${escapeHtml(q.topic)}</i>`,
      "",
      `<b>${escapeHtml(q.statement)}</b>`,
      ...LETTERS.map((l, i) => `${l === q.correct ? "✅" : "▫️"} ${l}) ${escapeHtml(options[i])}`),
      "",
      `💡 ${escapeHtml(q.explanation || "(sin explicación)")}`,
      "",
      ...formatSource(q),
      q.source_url ? escapeHtml(q.source_url) : "",
      "",
      `📊 Respondida ${success.total} veces · ${success.total ? Math.round((success.correct / success.total) * 100) : 0}% de acierto · ⚠️ ${countReportsForQuestion(q.id)} reportes`,
    ].join("\n"),
    { parse_mode: "HTML", link_preview_options: { is_disabled: true } }
  );
});

// /anuncio <texto>: envía un mensaje a todos los usuarios, con confirmación previa
const pendingBroadcasts = new Map<string, string>();

adminHandler.command("anuncio", async (ctx, next) => {
  if (!isAdmin(ctx.from?.id)) return next();
  const text = ctx.match.trim();
  if (!text) {
    await ctx.reply(
      "Uso: /anuncio <texto>\n\nEjemplo:\n/anuncio 📚 ¡Ya tienes 120 preguntas nuevas de la Ley 39/2015! Escribe /temas para practicarlas."
    );
    return;
  }
  const key = randomBytes(4).toString("hex");
  pendingBroadcasts.set(key, text);
  const recipients = listReachableUserIds().length;
  await ctx.reply(`📣 Vista previa del anuncio (se enviará a ${recipients} usuarios):\n\n${text}`, {
    reply_markup: new InlineKeyboard()
      .text(`✅ Enviar a ${recipients} usuarios`, `bc:ok:${key}`)
      .row()
      .text("❌ Cancelar", `bc:no:${key}`),
  });
});

adminHandler.callbackQuery(/^bc:(ok|no):([0-9a-f]{8})$/, async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    await ctx.answerCallbackQuery();
    return;
  }
  const [, action, key] = ctx.match;
  const text = pendingBroadcasts.get(key);
  pendingBroadcasts.delete(key);
  if (!text) {
    await ctx.answerCallbackQuery({ text: "Este anuncio ya se envió o se canceló." });
    return;
  }
  if (action === "no") {
    await ctx.answerCallbackQuery({ text: "Anuncio cancelado" });
    await ctx.editMessageText("❌ Anuncio cancelado.");
    return;
  }

  const ids = listReachableUserIds();
  await ctx.answerCallbackQuery({ text: "📣 Enviando…" });
  await ctx.editMessageText(`📣 Enviando el anuncio a ${ids.length} usuarios… Te aviso al terminar.`);
  console.log(`[ANUNCIO] Enviando a ${ids.length} usuarios`);

  // Se envía en segundo plano para no bloquear el bot mientras tanto
  const api = ctx.api;
  void sendToMany(api, ids, () => ({ text })).then(async (result) => {
    console.log(`[ANUNCIO] Enviados ${result.ok} · bloqueados ${result.blocked} · errores ${result.error}`);
    await sendSafely(
      api,
      config.adminId,
      `✅ Anuncio enviado.\n\n📬 Recibido: ${result.ok}\n🚫 Han bloqueado el bot: ${result.blocked}\n⚠️ Errores: ${result.error}`
    );
  });
});
