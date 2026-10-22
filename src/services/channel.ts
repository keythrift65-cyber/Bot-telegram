import { GrammyError, InlineKeyboard, type Api, type Bot } from "grammy";
import cron from "node-cron";
import { config } from "../config";
import {
  countChannelPostsSince,
  currentCycle,
  getAllQuestionsShuffled,
  getUnpostedQuestions,
  saveChannelPost,
} from "../db/channel";
import { optionsOf, type Question } from "../db/questions";
import { correctPosition, shuffledOrder } from "./quiz";
import { startOfTodayIn } from "./time";

/** Límites de Telegram para las encuestas */
const MAX_QUESTION = 300;
const MAX_OPTION = 100;
const MAX_EXPLANATION = 200;

export interface ChannelPoll {
  question: string;
  options: string[];
  correctOptionId: number;
  explanation: string;
}

/**
 * Divide un texto en frases. Solo corta tras ". ", "! ", "? " o "… " seguidos de
 * mayúscula, para no partir abreviaturas como "art. 9.3" o "arts. 15 a 29".
 */
function splitSentences(text: string): string[] {
  return text
    .trim()
    .split(/(?<=[.!?…])\s+(?=[A-ZÁÉÍÓÚÑ¿¡«"'(])/)
    .filter(Boolean);
}

/**
 * Texto que ve el usuario tras responder: artículo + explicación, recortada por
 * frases completas para no pasar de 200 caracteres. Devuelve null si ni siquiera
 * cabe el artículo de referencia.
 */
export function buildExplanation(q: Question): string | null {
  let text = q.reference ? `📖 ${q.reference}` : "";
  if (text.length > MAX_EXPLANATION) return null;

  let first = true;
  for (const sentence of splitSentences(q.explanation)) {
    const separator = !text ? "" : first ? "\n" : " ";
    const candidate = text + separator + sentence;
    if (candidate.length > MAX_EXPLANATION) break;
    text = candidate;
    first = false;
  }
  return text;
}

/**
 * Prepara la encuesta tipo quiz con las opciones desordenadas.
 * Devuelve null si la pregunta no cabe en los límites de Telegram.
 */
export function buildPoll(q: Question): ChannelPoll | null {
  const original = optionsOf(q);
  if (q.statement.length > MAX_QUESTION) return null;
  if (original.some((o) => o.length > MAX_OPTION)) return null;

  const explanation = buildExplanation(q);
  if (explanation === null) return null;

  const order = shuffledOrder();
  return {
    question: q.statement,
    options: order.map((i) => original[i]),
    correctOptionId: correctPosition(q, order),
    explanation,
  };
}

/**
 * Elige la siguiente pregunta para el canal: una que no se haya publicado en la
 * vuelta actual y que quepa en los límites. Si ya se publicaron todas las que
 * caben, empieza una vuelta nueva.
 */
function pickQuestion(): { question: Question; poll: ChannelPoll; cycle: number } | null {
  const cycle = currentCycle();
  for (const question of getUnpostedQuestions(cycle)) {
    const poll = buildPoll(question);
    if (poll) return { question, poll, cycle };
  }
  // Vuelta completada: se pueden volver a usar todas
  for (const question of getAllQuestionsShuffled()) {
    const poll = buildPoll(question);
    if (poll) return { question, poll, cycle: cycle + 1 };
  }
  return null;
}

/** Usuario del bot para el enlace: el del .env o, si falta, el que da Telegram */
export function channelBotUsername(telegramUsername: string): string {
  return config.botUsername ?? telegramUsername;
}

/**
 * Publica en el canal una encuesta tipo quiz y, a continuación, el mensaje con el
 * botón para abrir el bot. Lanza un error si falla.
 */
export async function publishToChannel(api: Api, botUsername: string): Promise<Question> {
  if (!config.channelId) throw new Error("CHANNEL_ID no está configurado en el .env");

  const picked = pickQuestion();
  if (!picked) {
    throw new Error(
      "No hay ninguna pregunta que quepa en los límites de Telegram (enunciado ≤ 300, opciones ≤ 100 caracteres)"
    );
  }
  const { question, poll, cycle } = picked;

  await api.sendPoll(config.channelId, poll.question, poll.options, {
    type: "quiz",
    is_anonymous: true,
    // La API actual de Telegram pide una lista de correctas; aquí solo hay una
    correct_option_ids: [poll.correctOptionId],
    ...(poll.explanation ? { explanation: poll.explanation } : {}),
  });
  // La encuesta ya está publicada: la registramos aunque luego falle el mensaje del botón
  saveChannelPost(question.id, cycle);

  await api.sendMessage(
    config.channelId,
    `¿Quieres seguir practicando? Tienes ${config.freeDailyLimit} preguntas gratis al día en el bot 👇`,
    {
      reply_markup: new InlineKeyboard().url(
        "📝 Practicar en el bot",
        `https://t.me/${botUsername}?start=canal`
      ),
    }
  );

  return question;
}

/** Explica los errores habituales de Telegram en lenguaje claro */
function describeError(err: unknown): string {
  if (!(err instanceof GrammyError)) return err instanceof Error ? err.message : String(err);
  const d = err.description;
  if (d.includes("chat not found")) return `${d}. Revisa CHANNEL_ID en el .env (ej: @micanal o -100…).`;
  if (d.includes("not enough rights") || d.includes("have no rights") || d.includes("not a member"))
    return `${d}. El bot debe ser administrador del canal con permiso para publicar mensajes.`;
  return d;
}

/**
 * Publica y registra el resultado. Si falla, lo apunta en consola y avisa al
 * administrador por privado. Nunca lanza errores (el bot no debe caerse).
 */
export async function publishAndReport(
  api: Api,
  botUsername: string,
  reason: string
): Promise<Question | null> {
  try {
    const q = await publishToChannel(api, botUsername);
    console.log(`[CANAL] Pregunta ${q.id} publicada en ${config.channelId} (${reason})`);
    return q;
  } catch (err) {
    const message = describeError(err);
    console.error(`[CANAL] Error al publicar en ${config.channelId} (${reason}):`, message);
    try {
      await api.sendMessage(
        config.adminId,
        `⚠️ No se pudo publicar la pregunta del día en el canal (${reason}).\n\n${message}`
      );
    } catch (notifyErr) {
      console.error("[CANAL] Tampoco se pudo avisar al administrador:", describeError(notifyErr));
    }
    return null;
  }
}

/** Hora actual en Madrid (0-23) */
function madridHour(): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: config.timeZone, hour: "2-digit", hourCycle: "h23" }).format(
      new Date()
    )
  );
}

/**
 * Programa la publicación diaria a las 9:00 (Europe/Madrid).
 * Además, si el bot arranca después de las 9:00 y hoy todavía no se ha publicado
 * (por ejemplo, porque el portátil estaba apagado), publica en ese momento.
 */
export function startChannelScheduler(bot: Bot): void {
  if (!config.channelId) {
    console.log("ℹ️ CHANNEL_ID no configurado: la pregunta del día en el canal está desactivada");
    return;
  }

  const username = channelBotUsername(bot.botInfo.username);
  cron.schedule(config.channelCron, () => publishAndReport(bot.api, username, "publicación diaria de las 9:00"), {
    name: "pregunta-del-dia",
    timezone: config.timeZone,
    noOverlap: true,
  });
  console.log(`📢 Pregunta del día programada a las 9:00 (Madrid) en ${config.channelId}`);

  const postedToday = countChannelPostsSince(startOfTodayIn(config.timeZone).toISOString()) > 0;
  if (madridHour() >= 9 && !postedToday) {
    void publishAndReport(bot.api, username, "recuperada: el bot no estaba encendido a las 9:00");
  }
}
