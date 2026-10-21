import { Composer } from "grammy";
import { config } from "../config";

export const infoHandler = new Composer();

// Obligatorio para bots que cobran en Telegram Stars
infoHandler.command("paysupport", async (ctx) => {
  await ctx.reply(
    [
      "💬 <b>Ayuda con pagos</b>",
      "",
      "Si has tenido algún problema con un pago o con tu suscripción premium:",
      "",
      "1. Escríbenos aquí mismo explicando qué ha pasado.",
      "2. Incluye la fecha del pago y, si puedes, el identificador de la transacción (lo encontrarás en el recibo del pago dentro del chat).",
      "3. Te responderemos lo antes posible, normalmente en menos de 48 horas.",
      "",
      "Para cancelar la renovación automática: Ajustes de Telegram → Mis estrellas → selecciona la suscripción → Cancelar.",
      "",
      "⚠️ El soporte de Telegram no puede ayudarte con compras hechas en este bot; contacta siempre con nosotros primero.",
    ].join("\n"),
    { parse_mode: "HTML" }
  );
});

infoHandler.command("terms", async (ctx) => {
  await ctx.reply(
    [
      "📄 <b>Condiciones de uso</b>",
      "",
      "1. Este bot es una herramienta de estudio para la oposición de Auxiliar Administrativo del Estado. No está vinculado a ningún organismo oficial.",
      "2. Las preguntas y explicaciones se elaboran con cuidado, pero pueden contener errores o quedar desactualizadas por cambios normativos. Consulta siempre la normativa oficial (BOE).",
      `3. El uso gratuito permite ${config.freeDailyLimit} preguntas al día. La suscripción premium cuesta ${config.premiumPriceStars} Telegram Stars cada 30 días y se renueva automáticamente hasta que la canceles.`,
      "4. Puedes cancelar la suscripción en cualquier momento desde los ajustes de Telegram; seguirás siendo premium hasta el final del periodo pagado.",
      "5. Los reembolsos se estudian caso por caso a través de /paysupport.",
      "6. Guardamos tu id y nombre de Telegram, tus respuestas y tus pagos solo para el funcionamiento del bot. No los compartimos con terceros.",
      "7. Podemos modificar estas condiciones o el servicio; los cambios importantes se avisarán en el bot.",
      "",
      "Al usar el bot aceptas estas condiciones.",
    ].join("\n"),
    { parse_mode: "HTML" }
  );
});
