import { config } from "./config";
import { createBot } from "./bot/bot";
import { countQuestions } from "./db/questions";
import { db } from "./db/database";

// Red de seguridad: registramos errores no capturados en lugar de cerrar el proceso
process.on("unhandledRejection", (reason) => console.error("[ERROR] Promesa rechazada sin capturar:", reason));
process.on("uncaughtException", (err) => console.error("[ERROR] Excepción sin capturar:", err));

async function main(): Promise<void> {
  const bot = createBot();

  // Comandos que aparecen en el menú de Telegram
  await bot.api.setMyCommands([
    { command: "start", description: "Menú principal" },
    { command: "pregunta", description: "Nueva pregunta" },
    { command: "repaso", description: "Repasar fallos (premium)" },
    { command: "estadisticas", description: "Mis estadísticas" },
    { command: "premium", description: "Hazte premium" },
    { command: "paysupport", description: "Ayuda con pagos" },
    { command: "terms", description: "Condiciones de uso" },
  ]);

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
    onStart: (me) =>
      console.log(`✅ Bot @${me.username} en marcha · ${questions} preguntas · admin ${config.adminId}`),
  });
}

main().catch((err) => {
  console.error("❌ No se pudo arrancar el bot:", err);
  process.exit(1);
});
