/**
 * Importa preguntas desde un archivo JSON a la base de datos sin duplicarlas.
 *
 * Uso:
 *   npm run import                    -> lee ./questions.json
 *   npm run import -- otro-archivo.json
 *
 * Una pregunta se considera duplicada si ya existe otra con el mismo tema y enunciado.
 */
import fs from "node:fs";
import path from "node:path";
import { db } from "../db/database";
import { countQuestions, insertQuestionIfNew, LETTERS, type Letter, type NewQuestion } from "../db/questions";

interface JsonQuestion {
  tema: string;
  enunciado: string;
  opciones: Record<Letter, string>;
  correcta: string;
  articulo?: string;
  explicacion?: string;
}

/** Comprueba que una pregunta del JSON tiene todos los campos necesarios */
function validate(raw: unknown, index: number): NewQuestion {
  const q = raw as Partial<JsonQuestion>;
  const fail = (msg: string): never => {
    throw new Error(`Pregunta nº ${index + 1}: ${msg}`);
  };

  if (!q || typeof q !== "object") fail("no es un objeto");
  if (!q.tema?.trim()) fail('falta "tema"');
  if (!q.enunciado?.trim()) fail('falta "enunciado"');
  if (!q.opciones || typeof q.opciones !== "object") fail('falta "opciones"');
  for (const l of LETTERS) {
    if (!q.opciones![l]?.trim()) fail(`falta la opción ${l}`);
  }
  const correct = q.correcta?.trim().toUpperCase();
  if (!LETTERS.includes(correct as Letter)) fail('"correcta" debe ser A, B, C o D');

  return {
    topic: q.tema!.trim(),
    statement: q.enunciado!.trim(),
    option_a: q.opciones!.A.trim(),
    option_b: q.opciones!.B.trim(),
    option_c: q.opciones!.C.trim(),
    option_d: q.opciones!.D.trim(),
    correct: correct as Letter,
    reference: q.articulo?.trim() ?? "",
    explanation: q.explicacion?.trim() ?? "",
  };
}

function main(): void {
  const file = path.resolve(process.argv[2] ?? "questions.json");
  if (!fs.existsSync(file)) {
    console.error(`❌ No existe el archivo ${file}`);
    process.exit(1);
  }

  let data: unknown;
  try {
    data = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    console.error(`❌ ${file} no es un JSON válido:`, (err as Error).message);
    process.exit(1);
  }
  if (!Array.isArray(data)) {
    console.error("❌ El JSON debe ser una lista de preguntas: [ {...}, {...} ]");
    process.exit(1);
  }

  // Validamos todo antes de insertar nada
  let questions: NewQuestion[];
  try {
    questions = data.map(validate);
  } catch (err) {
    console.error(`❌ ${(err as Error).message}`);
    process.exit(1);
  }

  // Insertamos dentro de una transacción: o entran todas o ninguna
  let inserted = 0;
  db.exec("BEGIN");
  try {
    for (const q of questions) if (insertQuestionIfNew(q)) inserted++;
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    console.error("❌ Error al guardar las preguntas, no se ha importado ninguna:", (err as Error).message);
    process.exit(1);
  }

  console.log(`✅ Leídas: ${questions.length} · Nuevas: ${inserted} · Duplicadas: ${questions.length - inserted}`);
  console.log(`📚 Total de preguntas en la base de datos: ${countQuestions()}`);
  db.close();
}

main();
