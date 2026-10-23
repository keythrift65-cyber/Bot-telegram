import { Composer, type Context } from "grammy";
import { backToMenuKeyboard, CB, lawsKeyboard, topicsKeyboard } from "../bot/keyboards";
import { getUserTopicStats, listLaws, listTopics } from "../db/topics";
import { escapeHtml } from "../services/quiz";

export const topicsHandler = new Composer();

/** Lista de temas de una ley (o de todas) con el porcentaje de acierto del usuario */
async function showTopics(ctx: Context, law: string | undefined, backTo: string): Promise<void> {
  const userId = ctx.from!.id;
  const topics = listTopics(law);
  if (topics.length === 0) {
    await ctx.reply("Todavía no hay temas disponibles. Prueba con «Nueva pregunta».", {
      reply_markup: backToMenuKeyboard().text("📝 Nueva pregunta", CB.newQuestion),
    });
    return;
  }

  const stats = getUserTopicStats(userId);
  const rows = topics.map((t) => {
    const s = stats.get(t.id);
    return { id: t.id, name: t.name, questions: t.questions, pct: s ? Math.round((s.correct / s.total) * 100) : null };
  });

  const title = law ? `📚 <b>${escapeHtml(law)}</b>` : "📚 <b>Practicar por temas</b>";
  await ctx.reply(
    [
      title,
      "",
      "Elige un tema. Al lado verás tu porcentaje de acierto o, si aún no lo has practicado, cuántas preguntas tiene.",
    ].join("\n"),
    { parse_mode: "HTML", reply_markup: topicsKeyboard(rows, backTo) }
  );
}

/** Si hay preguntas de varias leyes, primero se elige la ley; si no, directamente el tema */
async function showTopicsMenu(ctx: Context): Promise<void> {
  const laws = listLaws();
  if (laws.length > 1) {
    await ctx.reply("📚 <b>Practicar por temas</b>\n\n¿De qué norma quieres practicar?", {
      parse_mode: "HTML",
      reply_markup: lawsKeyboard(laws),
    });
    return;
  }
  await showTopics(ctx, laws[0], CB.menu);
}

topicsHandler.callbackQuery(CB.topics, async (ctx) => {
  await ctx.answerCallbackQuery();
  await showTopicsMenu(ctx);
});

topicsHandler.command("temas", (ctx) => showTopicsMenu(ctx));

// Temas de una ley concreta: "tl:<índice>"
topicsHandler.callbackQuery(/^tl:(\d{1,3})$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const law = listLaws()[Number(ctx.match[1])];
  if (!law) {
    await showTopicsMenu(ctx);
    return;
  }
  await showTopics(ctx, law, CB.topics);
});
