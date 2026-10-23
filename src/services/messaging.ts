import { GrammyError, type Api } from "grammy";
import { markBlocked } from "../db/users";

type SendOptions = Parameters<Api["sendMessage"]>[2];
export type SendResult = "ok" | "blocked" | "error";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Envía un mensaje sin lanzar errores. Si el usuario ha bloqueado el bot (o borrado
 * su cuenta) se marca para no volver a escribirle. Si Telegram pide esperar por
 * enviar demasiado rápido, espera y lo reintenta una vez.
 */
export async function sendSafely(api: Api, chatId: number, text: string, options?: SendOptions): Promise<SendResult> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await api.sendMessage(chatId, text, options);
      return "ok";
    } catch (err) {
      if (err instanceof GrammyError) {
        if (err.error_code === 403 || /chat not found|user is deactivated/i.test(err.description)) {
          markBlocked(chatId);
          return "blocked";
        }
        if (err.error_code === 429 && attempt === 0) {
          await wait(((err.parameters.retry_after ?? 1) + 1) * 1000);
          continue;
        }
      }
      console.error(`[ENVÍO] No se pudo escribir a ${chatId}:`, err instanceof GrammyError ? err.description : err);
      return "error";
    }
  }
  return "error";
}

export interface BulkResult {
  ok: number;
  blocked: number;
  error: number;
}

/**
 * Envía un mensaje a muchos usuarios, de uno en uno y sin pasar de unos 25 por
 * segundo (el límite de Telegram es 30). Nunca lanza errores.
 */
export async function sendToMany(
  api: Api,
  chatIds: number[],
  message: (chatId: number) => { text: string; options?: SendOptions }
): Promise<BulkResult> {
  const totals: BulkResult = { ok: 0, blocked: 0, error: 0 };
  for (const chatId of chatIds) {
    const { text, options } = message(chatId);
    totals[await sendSafely(api, chatId, text, options)]++;
    await wait(40);
  }
  return totals;
}
