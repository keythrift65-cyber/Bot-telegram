import { Bot, GrammyError, HttpError } from "grammy";
import { config } from "../config";
import { upsertUser } from "../db/users";
import { mainMenuKeyboard } from "./keyboards";
import { adminHandler } from "../handlers/admin";
import { infoHandler } from "../handlers/info";
import { paymentsHandler } from "../handlers/payments";
import { quizHandler } from "../handlers/quiz";
import { startHandler } from "../handlers/start";
import { statsHandler } from "../handlers/stats";

/**
 * Crea el bot y registra todos los middlewares y handlers.
 */
export function createBot(): Bot {
  const bot = new Bot(config.botToken);

  // Solo atendemos chats privados (pre_checkout_query no tiene chat, así que se deja pasar)
  bot.use(async (ctx, next) => {
    if (ctx.chat && ctx.chat.type !== "private") return;
    await next();
  });

  // Registra o actualiza al usuario en cada interacción
  bot.use(async (ctx, next) => {
    if (ctx.from && !ctx.from.is_bot) {
      const name = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(" ");
      upsertUser(ctx.from.id, name);
    }
    await next();
  });

  bot.use(startHandler);
  bot.use(quizHandler);
  bot.use(statsHandler);
  bot.use(paymentsHandler);
  bot.use(infoHandler);
  bot.use(adminHandler);

  // Cualquier otro mensaje (texto libre, comando desconocido, foto…): mostramos el menú
  bot.on("message", async (ctx) => {
    await ctx.reply("🤔 No te he entendido. Elige una opción del menú:", {
      reply_markup: mainMenuKeyboard(),
    });
  });

  // Botones antiguos o desconocidos: quitamos el "reloj" del botón
  bot.on("callback_query", (ctx) => ctx.answerCallbackQuery());

  // Captura cualquier error para que el bot no se caiga nunca
  bot.catch((err) => {
    const ctx = err.ctx;
    const e = err.error;
    const where = `update ${ctx.update.update_id} (usuario ${ctx.from?.id ?? "?"})`;

    if (e instanceof GrammyError) {
      // Editar un mensaje con el mismo contenido no es un error real
      if (e.description.includes("message is not modified")) return;
      console.error(`[ERROR] Telegram rechazó la petición en ${where}:`, e.description);
    } else if (e instanceof HttpError) {
      console.error(`[ERROR] No se pudo contactar con Telegram en ${where}:`, e);
    } else {
      console.error(`[ERROR] Error inesperado en ${where}:`, e);
    }
  });

  return bot;
}
