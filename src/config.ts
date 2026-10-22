import "dotenv/config";

/**
 * Lee una variable de entorno obligatoria y detiene el proceso si falta.
 */
function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`❌ Falta la variable de entorno ${name}. Revisa tu archivo .env`);
    process.exit(1);
  }
  return value;
}

const adminId = Number(required("ADMIN_ID"));
if (!Number.isInteger(adminId)) {
  console.error("❌ ADMIN_ID debe ser un número (tu id de Telegram).");
  process.exit(1);
}

/** Variable de entorno opcional: devuelve undefined si no está o está vacía */
function optional(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

export const config = {
  botToken: required("BOT_TOKEN"),
  adminId,

  /** Canal donde se publica la pregunta del día: "@micanal" o id numérico "-100…". Sin él, la función está desactivada */
  channelId: optional("CHANNEL_ID"),
  /** Usuario del bot sin "@" (para el enlace del canal). Si falta, se usa el que devuelve Telegram */
  botUsername: optional("BOT_USERNAME")?.replace(/^@/, ""),
  /** Hora de publicación en el canal (formato cron: minuto hora * * *) */
  channelCron: "0 9 * * *",

  /** Preguntas gratuitas al día para usuarios no premium */
  freeDailyLimit: 10,
  /** Precio de la suscripción mensual en Telegram Stars */
  premiumPriceStars: 250,
  /** Duración de la suscripción en segundos (30 días, el único valor que admite Telegram) */
  subscriptionPeriod: 2592000,
  /** Días durante los que no se repite una pregunta ya respondida */
  noRepeatDays: 7,
  /** Zona horaria para reiniciar el contador diario */
  timeZone: "Europe/Madrid",
} as const;
