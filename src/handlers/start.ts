import { Composer } from "grammy";
import { config } from "../config";
import { CB, mainMenuKeyboard } from "../bot/keyboards";
import { isPremium } from "../services/subscription";

export const startHandler = new Composer();

function welcomeText(userId: number, firstName: string): string {
  const plan = isPremium(userId)
    ? "⭐ Eres <b>premium</b>: preguntas ilimitadas y repaso de fallos."
    : `Tienes <b>${config.freeDailyLimit} preguntas gratis al día</b> (se reinician a medianoche). Con premium no hay límite.`;

  return [
    `👋 ¡Hola, ${firstName}!`,
    "",
    "Prepara la oposición de <b>Auxiliar Administrativo del Estado</b> con preguntas tipo test, cada una con su artículo de referencia y explicación.",
    "",
    plan,
    "",
    "¿Qué quieres hacer?",
  ].join("\n");
}

startHandler.command("start", async (ctx) => {
  if (!ctx.from) return;
  await ctx.reply(welcomeText(ctx.from.id, ctx.from.first_name), {
    parse_mode: "HTML",
    reply_markup: mainMenuKeyboard(),
  });
});

// Botón "Menú": muestra el menú principal en un mensaje nuevo
startHandler.callbackQuery(CB.menu, async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply("🏠 Menú principal. ¿Qué quieres hacer?", { reply_markup: mainMenuKeyboard() });
});
