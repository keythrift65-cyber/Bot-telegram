import { config } from "../config";
import { createExam, listExamQuestions, type Exam, type ExamQuestion } from "../db/exams";
import { getQuestion, getRandomQuestionIds, LETTERS, optionsOf, type Question } from "../db/questions";
import { decodeOrder, encodeOrder, escapeHtml, shuffledOrder } from "./quiz";

/** Crea un simulacro con preguntas al azar. Devuelve su id, o null si no hay preguntas. */
export function createRandomExam(userId: number, size: number): number | null {
  const ids = getRandomQuestionIds(size);
  if (ids.length === 0) return null;
  return createExam(
    userId,
    ids.map((questionId) => ({ questionId, order: encodeOrder(shuffledOrder()) }))
  );
}

/** Nota sobre 10: cada fallo resta una fracción de acierto y las preguntas en blanco no restan */
export function examScore(correct: number, wrong: number, total: number): number {
  if (total === 0) return 0;
  return Math.max(0, ((correct - wrong * config.examPenalty) / total) * 10);
}

/** Número con coma decimal, ej: 6,53 */
export function formatScore(score: number): string {
  return score.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/** Cuánto resta cada fallo, en palabras (ej: "un tercio de acierto") */
export function penaltyText(): string {
  const p = config.examPenalty;
  if (Math.abs(p - 1 / 3) < 1e-9) return "un tercio de acierto";
  if (Math.abs(p - 1 / 4) < 1e-9) return "un cuarto de acierto";
  return `${formatScore(p)} aciertos`;
}

function formatDuration(fromIso: string, toIso: string): string {
  const seconds = Math.max(0, Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 1000));
  const minutes = Math.floor(seconds / 60);
  return minutes > 0 ? `${minutes} min ${seconds % 60} s` : `${seconds} s`;
}

/** Texto de una pregunta del simulacro */
export function formatExamQuestion(q: Question, eq: ExamQuestion, total: number, answer?: string): string {
  const order = decodeOrder(eq.option_order) ?? [0, 1, 2, 3];
  const options = optionsOf(q);
  const lines = [
    `🎓 <b>Simulacro · Pregunta ${eq.position} de ${total}</b>`,
    `<i>${escapeHtml(q.topic)}</i>`,
    "",
    `<b>${escapeHtml(q.statement)}</b>`,
    "",
    ...order.map((orig, pos) => `<b>${LETTERS[pos]})</b> ${escapeHtml(options[orig])}`),
  ];
  if (answer) lines.push("", answer);
  return lines.join("\n");
}

/** Resumen al terminar: aciertos, fallos, en blanco, nota, tiempo y temas a reforzar */
export function formatExamSummary(exam: Exam): string {
  const answered = listExamQuestions(exam.id);
  const total = answered.length;
  const score = examScore(exam.correct, exam.wrong, total);

  // Aciertos por tema para saber qué reforzar
  const byTopic = new Map<string, { ok: number; total: number }>();
  for (const eq of answered) {
    const topic = getQuestion(eq.question_id)?.topic ?? "Otros";
    const entry = byTopic.get(topic) ?? { ok: 0, total: 0 };
    entry.total++;
    if (eq.result === "ok") entry.ok++;
    byTopic.set(topic, entry);
  }
  const weakest = [...byTopic.entries()]
    .filter(([, s]) => s.ok < s.total)
    .sort((a, b) => a[1].ok / a[1].total - b[1].ok / b[1].total)
    .slice(0, 3);

  const verdict = score >= 5 ? "✅ <b>¡Aprobado!</b>" : "📚 <b>Toca seguir practicando</b>";
  const lines = [
    "🎓 <b>Simulacro terminado</b>",
    "",
    `✅ Aciertos: <b>${exam.correct}</b>   ❌ Fallos: <b>${exam.wrong}</b>   ⏭️ En blanco: <b>${exam.blank}</b>`,
    `📈 Nota: <b>${formatScore(score)} / 10</b> · ${verdict}`,
    `<i>Cada fallo resta ${penaltyText()}; las preguntas en blanco no restan.</i>`,
  ];
  if (exam.finished_at) lines.push(`⏱️ Tiempo: ${formatDuration(exam.started_at, exam.finished_at)}`);
  if (weakest.length > 0) {
    lines.push("", "<b>Temas a reforzar:</b>");
    for (const [topic, s] of weakest) lines.push(`• ${escapeHtml(topic)}: ${s.ok}/${s.total}`);
  }
  return lines.join("\n");
}

/**
 * Corrección de las preguntas falladas y en blanco, troceada en mensajes que
 * no pasen del límite de Telegram (4096 caracteres).
 */
export function formatCorrections(examId: number): string[] {
  const blocks: string[] = [];
  for (const eq of listExamQuestions(examId)) {
    if (eq.result === "ok") continue;
    const q = getQuestion(eq.question_id);
    if (!q) continue;
    const options = optionsOf(q);
    const correctText = options[LETTERS.indexOf(q.correct)];
    const lines = [`${eq.result === "blank" ? "⏭️" : "❌"} <b>${eq.position}.</b> ${escapeHtml(q.statement)}`];
    if (eq.result === "fail" && eq.chosen) {
      lines.push(`Tu respuesta: <s>${escapeHtml(options[LETTERS.indexOf(eq.chosen)])}</s>`);
    }
    lines.push(`✅ <b>${escapeHtml(correctText)}</b>`);
    if (q.reference) lines.push(`📖 ${escapeHtml(q.reference)}`);
    if (q.explanation) lines.push(`💡 ${escapeHtml(q.explanation)}`);
    blocks.push(lines.join("\n"));
  }

  const messages: string[] = [];
  let current = "📋 <b>Corrección del simulacro</b>";
  for (const block of blocks) {
    if (current.length + block.length + 2 > 3800) {
      messages.push(current);
      current = block;
    } else {
      current += `\n\n${block}`;
    }
  }
  messages.push(current);
  return messages;
}
