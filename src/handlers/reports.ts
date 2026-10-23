import { Composer } from "grammy";
import { backToMenuKeyboard } from "../bot/keyboards";
import { config } from "../config";
import { getQuestion, LETTERS, optionsOf } from "../db/questions";
import { createReport, getReport, listOpenReports, resolveReport } from "../db/reports";
import { sendSafely } from "../services/messaging";
import { escapeHtml } from "../services/quiz";

export const reportsHandler = new Composer();

const isAdmin = (id: number | undefined) => id === config.adminId;

/** Usuarios que han pulsado "Reportar error" y a los que esperamos el comentario (se pierde si el bot se reinicia) */
const pending = new Map<number, { questionId: number; expires: number }>();
const PENDING_MINUTES = 15;

// Botón "⚠️ Reportar error": "rep:<idPregunta>"
reportsHandler.callbackQuery(/^rep:(\d+)$/, async (ctx) => {
  const questionId = Number(ctx.match[1]);
  if (!getQuestion(questionId)) {
    await ctx.answerCallbackQuery({ text: "Esta pregunta ya no está disponible." });
    return;
  }
  const now = Date.now();
  for (const [userId, p] of pending) if (p.expires < now) pending.delete(userId); // Limpia los caducados
  pending.set(ctx.from.id, { questionId, expires: now + PENDING_MINUTES * 60_000 });
  await ctx.answerCallbackQuery();
  await ctx.reply(
    "✍️ Cuéntame en un mensaje qué está mal en esta pregunta (por ejemplo: «la respuesta correcta es la C porque el artículo dice…»).\n\nSi no quieres enviar nada, escribe /cancelar.",
    { reply_markup: { force_reply: true, input_field_placeholder: "¿Qué está mal en la pregunta?" } }
  );
});

reportsHandler.command("cancelar", async (ctx) => {
  const had = pending.delete(ctx.from!.id);
  await ctx.reply(had ? "👌 No se ha enviado nada." : "No había nada que cancelar.", {
    reply_markup: backToMenuKeyboard(),
  });
});

// El siguiente mensaje de texto del usuario es el comentario del reporte
reportsHandler.on("message:text", async (ctx, next) => {
  const waiting = pending.get(ctx.from.id);
  if (!waiting || waiting.expires < Date.now() || ctx.message.text.startsWith("/")) {
    pending.delete(ctx.from.id);
    return next();
  }
  pending.delete(ctx.from.id);

  const text = ctx.message.text.trim().slice(0, 1000);
  const reportId = createReport(ctx.from.id, waiting.questionId, text);
  const q = getQuestion(waiting.questionId)!;
  console.log(`[REPORTE] #${reportId} de ${ctx.from.id} sobre la pregunta ${q.code ?? q.id}`);

  await ctx.reply("🙏 ¡Gracias! Lo revisaremos y, si hay un error, corregiremos la pregunta.", {
    reply_markup: backToMenuKeyboard(),
  });

  const correct = optionsOf(q)[LETTERS.indexOf(q.correct)];
  await sendSafely(
    ctx.api,
    config.adminId,
    [
      `⚠️ <b>Reporte #${reportId}</b> de ${escapeHtml(ctx.from.first_name)} (id ${ctx.from.id})`,
      `Pregunta <b>${escapeHtml(q.code ?? `#${q.id}`)}</b> · ${escapeHtml(q.reference)}`,
      "",
      `<i>${escapeHtml(q.statement)}</i>`,
      `Correcta según el archivo: <b>${q.correct}) ${escapeHtml(correct)}</b> <i>(al usuario se le muestran las opciones en otro orden)</i>`,
      "",
      `💬 ${escapeHtml(text)}`,
      "",
      `Ver la pregunta: /ver ${escapeHtml(q.code ?? String(q.id))} · Cuando lo revises: /resuelto ${reportId}`,
    ].join("\n"),
    { parse_mode: "HTML" }
  );
});

// /reportes: errores pendientes de revisar (solo administrador)
reportsHandler.command("reportes", async (ctx, next) => {
  if (!isAdmin(ctx.from?.id)) return next();
  const reports = listOpenReports(10);
  if (reports.length === 0) {
    await ctx.reply("✅ No hay reportes pendientes.");
    return;
  }
  const lines = ["⚠️ <b>Reportes pendientes</b>", ""];
  for (const r of reports) {
    lines.push(
      `<b>#${r.id}</b> · ${escapeHtml(r.code ?? `pregunta #${r.question_id}`)} · ${escapeHtml(r.user_name)}`,
      `<i>${escapeHtml(r.statement.slice(0, 120))}</i>`,
      `💬 ${escapeHtml(r.text.slice(0, 300))}`,
      ""
    );
  }
  lines.push("Marca uno como revisado con /resuelto &lt;número&gt;");
  await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
});

// /resuelto <id>: marca un reporte como revisado y da las gracias a quien lo envió
reportsHandler.command("resuelto", async (ctx, next) => {
  if (!isAdmin(ctx.from?.id)) return next();
  const id = Number(ctx.match.trim());
  const report = Number.isInteger(id) ? getReport(id) : undefined;
  if (!report) {
    await ctx.reply("Uso: /resuelto <número de reporte> (los ves con /reportes)");
    return;
  }
  if (!resolveReport(id)) {
    await ctx.reply(`El reporte #${id} ya estaba resuelto.`);
    return;
  }
  const q = getQuestion(report.question_id);
  await sendSafely(
    ctx.api,
    report.user_id,
    `✅ Hemos revisado el error que reportaste${q ? ` en la pregunta «${q.statement.slice(0, 80)}…»` : ""}. ¡Gracias por ayudar a mejorar el bot!`
  );
  await ctx.reply(`✅ Reporte #${id} marcado como resuelto y avisado el usuario.`);
});
