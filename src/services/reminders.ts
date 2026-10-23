import { InlineKeyboard, type Api, type Bot } from "grammy";
import cron from "node-cron";
import { CB } from "../bot/keyboards";
import { config } from "../config";
import { getUsersToRemind } from "../db/users";
import { sendToMany, type BulkResult } from "./messaging";
import { getStreak } from "./progress";
import { hourIn, madridDay } from "./time";

/** Texto del recordatorio, con la racha si la tiene */
function reminderText(userId: number): string {
  const streak = getStreak(userId);
  const lines = ["⏰ <b>¡Hora de practicar!</b>", "", "Tus preguntas de hoy te están esperando. Con 5 minutos al día se nota."];
  if (streak.current > 0) {
    lines.push("", `🔥 Llevas <b>${streak.current} ${streak.current === 1 ? "día" : "días"}</b> seguidos: ¡no pierdas la racha!`);
  }
  return lines.join("\n");
}

/**
 * Envía el recordatorio a quien lo tenga a esta hora y hoy todavía no haya
 * practicado. Devuelve el resumen del envío.
 */
export async function sendReminders(api: Api, now = new Date()): Promise<BulkResult & { hour: number }> {
  const hour = hourIn(config.timeZone, now);
  const users = getUsersToRemind(hour, madridDay(now));
  const keyboard = new InlineKeyboard().text("📝 Empezar", CB.newQuestion).text("🔕 Ajustar", CB.reminder);
  const result = await sendToMany(
    api,
    users.map((u) => u.id),
    (id) => ({ text: reminderText(id), options: { parse_mode: "HTML", reply_markup: keyboard } })
  );
  if (users.length > 0) {
    console.log(
      `[RECORDATORIO] ${hour}:00 · enviados ${result.ok} · bloqueados ${result.blocked} · errores ${result.error}`
    );
  }
  return { ...result, hour };
}

/** Programa los recordatorios: se comprueba cada hora en punto (hora de Madrid) */
export function startReminderScheduler(bot: Bot): void {
  cron.schedule(
    "0 * * * *",
    async () => {
      try {
        await sendReminders(bot.api);
      } catch (err) {
        console.error("[RECORDATORIO] Error al enviar los recordatorios:", err);
      }
    },
    { name: "recordatorios", timezone: config.timeZone, noOverlap: true }
  );
  console.log("⏰ Recordatorios diarios activados");
}
