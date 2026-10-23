import { Composer, type Context } from "grammy";
import { CB, reminderKeyboard } from "../bot/keyboards";
import { config } from "../config";
import { getUser, setReminderHour } from "../db/users";

export const reminderHandler = new Composer();

function reminderText(hour: number | null): string {
  return [
    "⏰ <b>Recordatorio diario</b>",
    "",
    "Te escribo una vez al día, a la hora que elijas, <b>solo si ese día aún no has practicado</b>. Así no pierdes la racha.",
    "",
    hour === null ? "Ahora mismo está <b>desactivado</b>." : `Ahora mismo te aviso a las <b>${hour}:00</b> (hora peninsular).`,
  ].join("\n");
}

async function showReminder(ctx: Context): Promise<void> {
  const hour = getUser(ctx.from!.id)?.reminder_hour ?? null;
  await ctx.reply(reminderText(hour), {
    parse_mode: "HTML",
    reply_markup: reminderKeyboard(config.reminderHours, hour),
  });
}

reminderHandler.callbackQuery(CB.reminder, async (ctx) => {
  await ctx.answerCallbackQuery();
  await showReminder(ctx);
});

reminderHandler.command("recordatorio", (ctx) => showReminder(ctx));

// Elegir hora ("rm:<hora>") o desactivar ("rm:off")
reminderHandler.callbackQuery(/^rm:(\d{1,2}|off)$/, async (ctx) => {
  const value = ctx.match[1];
  const hour = value === "off" ? null : Number(value);
  if (hour !== null && !(config.reminderHours as readonly number[]).includes(hour)) {
    await ctx.answerCallbackQuery();
    return;
  }

  setReminderHour(ctx.from.id, hour);
  await ctx.answerCallbackQuery({ text: hour === null ? "🔕 Recordatorio desactivado" : `✅ Te aviso a las ${hour}:00` });
  await ctx.editMessageText(reminderText(hour), {
    parse_mode: "HTML",
    reply_markup: reminderKeyboard(config.reminderHours, hour),
  });
});
