import type { Api } from "grammy";
import { config } from "../config";
import { getUser } from "../db/users";

/** Payload que identifica la factura de la suscripción mensual */
export const PREMIUM_PAYLOAD = "premium_monthly";

/** ¿Tiene el usuario una suscripción activa ahora mismo? */
export function isPremium(userId: number): boolean {
  const user = getUser(userId);
  return !!user?.subscription_end && new Date(user.subscription_end) > new Date();
}

// El enlace de suscripción es igual para todos los usuarios, así que se guarda en memoria
let cachedInvoiceLink: string | null = null;

/**
 * Devuelve el enlace de pago de la suscripción mensual en Telegram Stars.
 * Para pagos en Stars el provider_token va vacío y la moneda es "XTR".
 */
export async function getPremiumInvoiceLink(api: Api): Promise<string> {
  if (cachedInvoiceLink) return cachedInvoiceLink;

  cachedInvoiceLink = await api.createInvoiceLink(
    "Premium Oposiciones Auxiliar",
    "Preguntas ilimitadas, repaso de fallos y simulacros de examen durante 30 días. Se renueva automáticamente cada mes; puedes cancelarla cuando quieras.",
    PREMIUM_PAYLOAD,
    "", // provider_token vacío para Telegram Stars
    "XTR",
    [{ label: "Suscripción mensual", amount: config.premiumPriceStars }],
    { subscription_period: config.subscriptionPeriod }
  );
  return cachedInvoiceLink;
}
