/**
 * Importa preguntas desde archivos JSON a la base de datos sin duplicarlas.
 *
 * Uso:
 *   npm run import                         -> lee todos los .json de la carpeta ./preguntas
 *   npm run import -- archivo1.json otro.json
 *
 * Cada pregunta puede traer las opciones de dos formas:
 *   "opciones": { "A": "...", "B": "...", "C": "...", "D": "..." }
 *   "opcion_a": "...", "opcion_b": "...", "opcion_c": "...", "opcion_d": "..."
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
  opciones?: Partial<Record<Letter, string>>;
  opcion_a?: string;
  opcion_b?: string;
  opcion_c?: string;
  opcion_d?: string;
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
  // Opciones en cualquiera de los dos formatos admitidos
  const options = LETTERS.map((l) => {
    const value = q.opciones?.[l] ?? q[`opcion_${l.toLowerCase()}` as "opcion_a"];
    if (typeof value !== "string" || !value.trim()) fail(`falta la opción ${l}`);
    return value!.trim();
  });
  if (new Set(options).size < 4) fail("hay opciones repetidas");
  const correct = q.correcta?.trim().toUpperCase();
  if (!LETTERS.includes(correct as Letter)) fail('"correcta" debe ser A, B, C o D');

  return {
    topic: q.tema!.trim(),
    statement: q.enunciado!.trim(),
    option_a: options[0],
    option_b: options[1],
    option_c: options[2],
    option_d: options[3],
    correct: correct as Letter,
    reference: q.articulo?.trim() ?? "",
    explanation: q.explicacion?.trim() ?? "",
  };
}

/** Lee y valida un archivo. Si hay cualquier error, detiene el script sin importar nada. */
function readFile(file: string): NewQuestion[] {
  const name = path.basename(file);
  let data: unknown;
  try {
    data = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    console.error(`❌ ${name} no es un JSON válido:`, (err as Error).message);
    process.exit(1);
  }
  if (!Array.isArray(data)) {
    console.error(`❌ ${name}: el JSON debe ser una lista de preguntas: [ {...}, {...} ]`);
    process.exit(1);
  }
  try {
    return data.map(validate);
  } catch (err) {
    console.error(`❌ ${name}: ${(err as Error).message}`);
    process.exit(1);
  }
}

/** Archivos a importar: los indicados en la línea de comandos o todos los de ./preguntas */
function filesToImport(): string[] {
  const args = process.argv.slice(2);
  if (args.length > 0) return args.map((f) => path.resolve(f));

  const dir = path.resolve("preguntas");
  if (!fs.existsSync(dir)) {
    console.error(`❌ No existe la carpeta ${dir}. Crea la carpeta y pon ahí tus archivos .json`);
    process.exit(1);
  }
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".json"))
    .sort()
    .map((f) => path.join(dir, f));
}

function main(): void {
  const files = filesToImport();
  if (files.length === 0) {
    console.error("❌ No hay ningún archivo .json que importar.");
    process.exit(1);
  }
  for (const f of files) {
    if (!fs.existsSync(f)) {
      console.error(`❌ No existe el archivo ${f}`);
      process.exit(1);
    }
  }

  // Validamos todos los archivos antes de insertar nada
  const questions: NewQuestion[] = [];
  for (const f of files) {
    const fromFile = readFile(f);
    console.log(`📄 ${path.basename(f)}: ${fromFile.length} preguntas`);
    questions.push(...fromFile);
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
