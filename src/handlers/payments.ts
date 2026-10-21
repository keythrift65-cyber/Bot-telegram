import { Composer, type Context } from "grammy";
import { config } from "../config";
import { backToMenuKeyboard, CB, mainMenuKeyboard, payKeyboard } from "../bot/keyboards";
import { savePayment } from "../db/payments";
import { getUser, setSubscriptionEnd } from "../db/users";
import { getPremiumInvoiceLink, isPremium, PREMIUM_PAYLOAD } from "../services/subscription";
import { formatDateEs } from "../services/time";

export const paymentsHandler = new Composer();

/** Muestra las ventajas de premium y el botón de pago */
async function showPremium(ctx: Context): Promise<void> {
  const userId = ctx.from!.id;

  if (isPremium(userId)) {
    const end = getUser(userId)!.subscription_end!;
    await ctx.reply(
      `⭐ Ya eres premium. Tu suscripción está activa hasta el <b>${formatDateEs(end)}</b> y se renovará automáticamente.\n\nPuedes gestionarla o cancelarla desde Ajustes → Mis estrellas en Telegram.`,
      { parse_mode: "HTML", reply_markup: backToMenuKeyboard() }
    );
    return;
  }

  const link = await getPremiumInvoiceLink(ctx.api);
  await ctx.reply(
    [
      "⭐ <b>Hazte premium</b>",
      "",
      "• Preguntas <b>ilimitadas</b> cada día",
      "• <b>Repasar fallos</b>: practica las preguntas que has fallado hasta acertarlas",
      "• Estadísticas por tema para saber dónde flojeas",
      "",
      `Precio: <b>${config.premiumPriceStars} ⭐ al mes</b>. Se renueva automáticamente cada 30 días y puedes cancelarla cuando quieras.`,
      "",
      "Al suscribirte aceptas las condiciones de uso (/terms).",
    ].join("\n"),
    { parse_mode: "HTML", reply_markup: payKeyboard(link, config.premiumPriceStars) }
  );
}

paymentsHandler.callbackQuery(CB.premium, async (ctx) => {
  await ctx.answerCallbackQuery();
  await showPremium(ctx);
});

paymentsHandler.command("premium", (ctx) => showPremium(ctx));

// Telegram pregunta si aceptamos el pago: hay que contestar en menos de 10 segundos
paymentsHandler.on("pre_checkout_query", async (ctx) => {
  await ctx.answerPreCheckoutQuery(true);
});

// Pago completado (primer pago o renovación automática de la suscripción)
paymentsHandler.on("message:successful_payment", async (ctx) => {
  const payment = ctx.message.successful_payment;
  const userId = ctx.from.id;
  const isRenewal = !!payment.is_recurring && !payment.is_first_recurring;

  if (payment.invoice_payload !== PREMIUM_PAYLOAD) {
    console.warn(`[PAGO] Payload desconocido "${payment.invoice_payload}" del usuario ${userId}`);
  }

  // Fecha de fin que nos da Telegram; si no viniera, 30 días desde hoy
  const expiresAt = payment.subscription_expiration_date
    ? new Date(payment.subscription_expiration_date * 1000)
    : new Date(Date.now() + config.subscriptionPeriod * 1000);

  const isNew = savePayment({
    userId,
    chargeId: payment.telegram_payment_charge_id,
    stars: payment.total_amount,
    expiresAt: expiresAt.toISOString(),
    isRecurring: isRenewal,
  });
  if (!isNew) {
    console.warn(`[PAGO] Pago duplicado ignorado: ${payment.telegram_payment_charge_id}`);
    return;
  }

  // Nunca acortamos una suscripción que ya terminaba más tarde
  const current = getUser(userId)?.subscription_end;
  const newEnd =
    current && new Date(current) > expiresAt ? new Date(current) : expiresAt;
  setSubscriptionEnd(userId, newEnd.toISOString());

  console.log(
    `[PAGO] ${isRenewal ? "Renovación" : "Nuevo pago"} · usuario ${userId} · ${payment.total_amount} ${payment.currency} · charge_id ${payment.telegram_payment_charge_id} · premium hasta ${newEnd.toISOString()}`
  );

  const text = isRenewal
    ? `🔄 Tu suscripción premium se ha renovado. Activa hasta el <b>${formatDateEs(newEnd.toISOString())}</b>. ¡Gracias por seguir con nosotros!`
    : `🎉 <b>¡Ya eres premium!</b>\n\nTu suscripción está activa hasta el <b>${formatDateEs(newEnd.toISOString())}</b> y se renovará automáticamente cada mes.\n\n¡A por la plaza! 💪`;

  await ctx.reply(text, { parse_mode: "HTML", reply_markup: mainMenuKeyboard() });
});

// Telegram avisa cuando un pago se ha reembolsado
paymentsHandler.on("message:refunded_payment", async (ctx) => {
  const refund = ctx.message.refunded_payment;
  console.log(
    `[PAGO] Reembolso recibido · usuario ${ctx.from.id} · ${refund.total_amount} ${refund.currency} · charge_id ${refund.telegram_payment_charge_id}`
  );
});
