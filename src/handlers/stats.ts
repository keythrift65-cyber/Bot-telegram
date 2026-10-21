import { Composer, type Context } from "grammy";
import { backToMenuKeyboard, CB } from "../bot/keyboards";
import { getStatsByTopic } from "../db/answers";
import { countFailedQuestions } from "../db/questions";
import { getUser } from "../db/users";
import { escapeHtml } from "../services/quiz";
import { isPremium } from "../services/subscription";
import { formatDateEs } from "../services/time";

export const statsHandler = new Composer();

function percent(correct: number, total: number): string {
  return total === 0 ? "0%" : `${Math.round((correct / total) * 100)}%`;
}

/** Muestra las estadísticas del usuario: global y por tema */
export async function sendUserStats(ctx: Context): Promise<void> {
  const userId = ctx.from!.id;
  const byTopic = getStatsByTopic(userId);
  const total = byTopic.reduce((sum, t) => sum + t.total, 0);
  const correct = byTopic.reduce((sum, t) => sum + t.correct, 0);

  if (total === 0) {
    await ctx.reply("📊 Aún no has respondido ninguna pregunta. ¡Empieza con «Nueva pregunta»!", {
      reply_markup: backToMenuKeyboard().text("📝 Nueva pregunta", CB.newQuestion),
    });
    return;
  }

  const lines = [
    "📊 <b>Mis estadísticas</b>",
    "",
    `Preguntas respondidas: <b>${total}</b>`,
    `Aciertos: <b>${correct}</b> · Fallos: <b>${total - correct}</b>`,
    `Porcentaje de acierto: <b>${percent(correct, total)}</b>`,
    `Fallos pendientes de repasar: <b>${countFailedQuestions(userId)}</b>`,
    "",
    "<b>Por tema:</b>",
    ...byTopic.map(
      (t) => `• ${escapeHtml(t.topic)}: ${percent(t.correct, t.total)} (${t.correct}/${t.total})`
    ),
  ];

  const user = getUser(userId);
  if (isPremium(userId) && user?.subscription_end) {
    lines.push("", `⭐ Premium activo hasta el ${formatDateEs(user.subscription_end)}`);
  }

  await ctx.reply(lines.join("\n"), { parse_mode: "HTML", reply_markup: backToMenuKeyboard() });
}

statsHandler.callbackQuery(CB.myStats, async (ctx) => {
  await ctx.answerCallbackQuery();
  await sendUserStats(ctx);
});

statsHandler.command("estadisticas", (ctx) => sendUserStats(ctx));
