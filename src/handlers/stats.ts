import { Composer, InlineKeyboard, type Context } from "grammy";
import { CB } from "../bot/keyboards";
import { countAnswersOnDay, countDistinctAnswered, getStatsByTopic } from "../db/answers";
import { listRecentExams } from "../db/exams";
import { countFailedQuestions, countQuestions } from "../db/questions";
import { getUser } from "../db/users";
import { examScore, formatScore } from "../services/exam";
import { getStreak } from "../services/progress";
import { escapeHtml } from "../services/quiz";
import { isPremium } from "../services/subscription";
import { formatDateEs, madridDay } from "../services/time";

export const statsHandler = new Composer();

function percent(correct: number, total: number): number {
  return total === 0 ? 0 : Math.round((correct / total) * 100);
}

/** Semáforo según el porcentaje de acierto */
function light(pct: number): string {
  if (pct < 50) return "🔴";
  if (pct < 75) return "🟡";
  return "🟢";
}

/** Muestra las estadísticas del usuario: racha, global, por tema y simulacros */
export async function sendUserStats(ctx: Context): Promise<void> {
  const userId = ctx.from!.id;
  const byTopic = getStatsByTopic(userId);
  const total = byTopic.reduce((sum, t) => sum + t.total, 0);
  const correct = byTopic.reduce((sum, t) => sum + t.correct, 0);

  if (total === 0) {
    await ctx.reply("📊 Aún no has respondido ninguna pregunta. ¡Empieza con «Nueva pregunta»!", {
      reply_markup: new InlineKeyboard().text("📝 Nueva pregunta", CB.newQuestion).row().text("🏠 Menú", CB.menu),
    });
    return;
  }

  const streak = getStreak(userId);
  const seen = countDistinctAnswered(userId);
  const bank = countQuestions();
  const lines = [
    "📊 <b>Mis estadísticas</b>",
    "",
    streak.current > 0
      ? `🔥 Racha: <b>${streak.current} ${streak.current === 1 ? "día" : "días"}</b> (tu mejor racha: ${streak.best})`
      : `🔥 Racha: 0 días · responde hoy para empezar una (tu mejor racha: ${streak.best})`,
    `📅 Hoy: <b>${countAnswersOnDay(userId, madridDay())}</b> preguntas`,
    `✅ Total: <b>${total}</b> respondidas · <b>${percent(correct, total)}%</b> de acierto`,
    `📖 Has visto <b>${seen}</b> de ${bank} preguntas (${percent(seen, bank)}%)`,
    `🔁 Fallos pendientes de repasar: <b>${countFailedQuestions(userId)}</b>`,
  ];

  // Temas, del más flojo al más fuerte
  const topics = [...byTopic].sort((a, b) => a.correct / a.total - b.correct / b.total);
  lines.push("", "<b>Por tema</b> (del más flojo al más fuerte):");
  for (const t of topics) {
    const pct = percent(t.correct, t.total);
    lines.push(`${light(pct)} ${escapeHtml(t.topic)}: <b>${pct}%</b> (${t.correct}/${t.total})`);
  }

  const exams = listRecentExams(userId, 5);
  if (exams.length > 0) {
    const scores = exams.map((e) => formatScore(examScore(e.correct, e.wrong, e.size)));
    lines.push("", `🎓 <b>Últimos simulacros:</b> ${scores.join(" · ")}`);
  }

  const user = getUser(userId);
  if (isPremium(userId) && user?.subscription_end) {
    lines.push("", `⭐ Premium activo hasta el ${formatDateEs(user.subscription_end)}`);
  }
  if (user && user.bonus_questions > 0) lines.push(`🎁 Preguntas extra: <b>${user.bonus_questions}</b>`);

  const keyboard = new InlineKeyboard();
  const weakest = topics.find((t) => t.topicId !== null && t.correct < t.total);
  if (weakest) keyboard.text("🎯 Practicar mi tema más flojo", `tp:${weakest.topicId}`).row();
  keyboard.text("🏠 Menú", CB.menu);

  await ctx.reply(lines.join("\n"), { parse_mode: "HTML", reply_markup: keyboard });
}

statsHandler.callbackQuery(CB.myStats, async (ctx) => {
  await ctx.answerCallbackQuery();
  await sendUserStats(ctx);
});

statsHandler.command("estadisticas", (ctx) => sendUserStats(ctx));
