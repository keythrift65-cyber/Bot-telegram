import { GrammyError, type Bot } from "grammy";
import { config } from "./config";
import { createBot } from "./bot/bot";
import { countQuestions } from "./db/questions";
import { db } from "./db/database";
import { startChannelScheduler } from "./services/channel";
import { startReminderScheduler } from "./services/reminders";

// Red de seguridad: registramos errores no capturados en lugar de cerrar el proceso
process.on("unhandledRejection", (reason) => console.error("[ERROR] Promesa rechazada sin capturar:", reason));
process.on("uncaughtException", (err) => console.error("[ERROR] Excepción sin capturar:", err));

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Conecta con Telegram reintentando hasta que haya internet (por ejemplo, cuando
 * el portátil acaba de encenderse y el wifi aún no ha conectado).
 * Si el token es incorrecto no tiene sentido reintentar y se para el proceso.
 */
async function connectWithRetry(bot: Bot): Promise<void> {
  let delay = 2_000;
  for (;;) {
    try {
      // Llamamos a getMe nosotros para controlar la espera y avisar en consola
      bot.botInfo = await bot.api.getMe();
      return;
    } catch (err) {
      if (err instanceof GrammyError && err.error_code === 401) {
        console.error("❌ Telegram rechaza el BOT_TOKEN. Revisa el token en el archivo .env");
        process.exit(1);
      }
      console.warn(`[RED] No se puede conectar con Telegram, reintentando en ${delay / 1000} s…`);
      await wait(delay);
      delay = Math.min(delay * 2, 60_000);
    }
  }
}

async function main(): Promise<void> {
  const bot = createBot();
  await connectWithRetry(bot);

  // Comandos que aparecen en el menú de Telegram (si falla, el bot funciona igual)
  await bot.api.setMyCommands([
    { command: "start", description: "Menú principal" },
    { command: "pregunta", description: "Nueva pregunta" },
    { command: "temas", description: "Practicar por temas" },
    { command: "repaso", description: "Repasar fallos (premium)" },
    { command: "simulacro", description: "Simulacro de examen (premium)" },
    { command: "estadisticas", description: "Mis estadísticas" },
    { command: "invitar", description: "Invitar amigos y ganar preguntas extra" },
    { command: "recordatorio", description: "Recordatorio diario" },
    { command: "premium", description: "Hazte premium" },
    { command: "paysupport", description: "Ayuda con pagos" },
    { command: "terms", description: "Condiciones de uso" },
  ]).catch((err) => console.warn("[AVISO] No se pudo registrar el menú de comandos:", err));

  // Cierre ordenado (Ctrl+C o pm2 stop)
  const stop = async () => {
    console.log("Deteniendo el bot…");
    await bot.stop();
    db.close();
    process.exit(0);
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  const questions = countQuestions();
  if (questions === 0) console.warn("⚠️ No hay preguntas en la base de datos. Ejecuta: npm run import");

  // Long polling. Pedimos explícitamente los tipos de update que usamos.
  await bot.start({
    allowed_updates: ["message", "callback_query", "pre_checkout_query"],
    drop_pending_updates: false,
    onStart: (me) => {
      console.log(`✅ Bot @${me.username} en marcha · ${questions} preguntas · admin ${config.adminId}`);
      startChannelScheduler(bot);
      startReminderScheduler(bot);
    },
  });
}

main().catch((err) => {
  console.error("❌ No se pudo arrancar el bot:", err);
  process.exit(1);
});
