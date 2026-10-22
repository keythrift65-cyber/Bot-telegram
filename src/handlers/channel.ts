import { Composer } from "grammy";
import { config } from "../config";
import { currentCycle, getAllQuestionsShuffled, getChannelPostStats } from "../db/channel";
import { countUsersBySource } from "../db/users";
import { escapeHtml } from "../services/quiz";
import { buildPoll, channelBotUsername, publishAndReport } from "../services/channel";
import { formatDateEs } from "../services/time";

export const channelHandler = new Composer();

const isAdmin = (id: number | undefined) => id === config.adminId;

// /canal_ahora: publica una pregunta en el canal al momento (para probar)
channelHandler.command("canal_ahora", async (ctx) => {
  if (!isAdmin(ctx.from?.id)) return;
  if (!config.channelId) {
    await ctx.reply("⚠️ Falta CHANNEL_ID en el .env. Añádelo y reinicia el bot.");
    return;
  }

  // Si falla, publishAndReport ya avisa al administrador (que es quien escribe)
  const q = await publishAndReport(ctx.api, channelBotUsername(ctx.me.username), "/canal_ahora");
  if (q) {
    await ctx.reply(`✅ Publicada en ${config.channelId} la pregunta #${q.id}:\n\n${escapeHtml(q.statement)}`, {
      parse_mode: "HTML",
    });
  }
});

// /canal_stats: publicaciones hechas y usuarios que han llegado desde el canal
channelHandler.command("canal_stats", async (ctx) => {
  if (!isAdmin(ctx.from?.id)) return;

  const cycle = currentCycle();
  const posts = getChannelPostStats(cycle);
  const fitting = getAllQuestionsShuffled().filter((q) => buildPoll(q) !== null).length;
  const fromChannel = countUsersBySource("canal", new Date().toISOString());

  await ctx.reply(
    [
      "📢 <b>Estadísticas del canal</b>",
      "",
      `Canal: <b>${escapeHtml(config.channelId ?? "sin configurar")}</b>`,
      `Preguntas publicadas: <b>${posts.total}</b>`,
      `Vuelta actual (${cycle}): <b>${posts.inCycle}</b> de <b>${fitting}</b> preguntas aptas para el canal`,
      `Última publicación: <b>${posts.lastPostedAt ? formatDateEs(posts.lastPostedAt) : "ninguna"}</b>`,
      "",
      `👥 Usuarios llegados desde el canal: <b>${fromChannel.total}</b>`,
      `⭐ De ellos, premium ahora: <b>${fromChannel.premium}</b>`,
    ].join("\n"),
    { parse_mode: "HTML" }
  );
});
