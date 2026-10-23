/**
 * Importa preguntas desde archivos JSON a la base de datos.
 *
 * Uso:
 *   npm run import                         -> sincroniza todos los .json de la carpeta ./preguntas
 *   npm run import -- archivo1.json otro.json
 *   npm run import -- --limpiar            -> además retira las preguntas antiguas sin "id"
 *                                             que no aparecen en ningún archivo
 *
 * Cada pregunta puede llevar un "id" estable (ej: "CE-017"). Con él, volver a
 * importar ACTUALIZA la pregunta (por ejemplo, si corriges una errata) en lugar
 * de duplicarla, y se conservan las estadísticas de los usuarios. Si un archivo
 * se importa entero desde ./preguntas, las preguntas con id que ya no estén en
 * ningún archivo se retiran (dejan de preguntarse, pero no se borran).
 *
 * Las opciones pueden venir de dos formas:
 *   "opcion_a": "...", "opcion_b": "...", "opcion_c": "...", "opcion_d": "..."
 *   "opciones": { "A": "...", "B": "...", "C": "...", "D": "..." }
 *
 * Para la Constitución, el tema, la ubicación (Título, Capítulo…) y el enlace al
 * BOE se calculan solos a partir de "articulo" (ej: "Art. 17.2 CE").
 */
import fs from "node:fs";
import path from "node:path";
import { db } from "../db/database";
import {
  countQuestions,
  deactivateCodedExcept,
  deactivateQuestions,
  findByTopicAndStatement,
  findLegacyQuestion,
  getQuestionByCode,
  insertQuestion,
  LETTERS,
  listUntouchedLegacy,
  updateQuestion,
  type Letter,
  type Question,
  type QuestionData,
} from "../db/questions";
import { upsertTopic } from "../db/topics";
import { articleAnchor, boeUrl, CE_NAME, CE_TOPIC_ORDER, findLaw, locateCE } from "../services/sources";

/** Límites de Telegram para las encuestas del canal (las preguntas más largas no se publican allí) */
const CHANNEL_MAX_QUESTION = 300;
const CHANNEL_MAX_OPTION = 100;

interface JsonQuestion {
  id?: string;
  ley?: string;
  tema?: string;
  enunciado: string;
  opciones?: Partial<Record<Letter, string>>;
  opcion_a?: string;
  opcion_b?: string;
  opcion_c?: string;
  opcion_d?: string;
  correcta: string;
  articulo?: string;
  explicacion?: string;
  ubicacion?: string | string[];
  enlace?: string;
  examen?: string;
  /** Enunciado(s) anterior(es) si se ha reescrito: sirve para reconocer la pregunta en la base de datos */
  enunciado_anterior?: string | string[];
}

interface ParsedQuestion {
  where: string;
  code: string | null;
  law: string;
  /** Orden del tema en el menú */
  topicPosition: number;
  data: Omit<QuestionData, "topic_id">;
  previousStatements: string[];
}

const optionalText = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/** Comprueba una pregunta del JSON y calcula los datos que faltan */
function parseQuestion(raw: unknown, where: string, appearance: number): ParsedQuestion {
  const q = raw as Partial<JsonQuestion>;
  const fail = (msg: string): never => {
    throw new Error(`${where}: ${msg}`);
  };

  if (!q || typeof q !== "object" || Array.isArray(q)) fail("no es un objeto");

  const code = optionalText(q.id) || null;
  if (code && !/^[A-Za-z0-9._-]{1,40}$/.test(code)) {
    fail('"id" solo puede tener letras, números, ".", "_" y "-" (ej: "CE-017")');
  }

  const statement = optionalText(q.enunciado);
  if (!statement) fail('falta "enunciado"');

  // Opciones en cualquiera de los dos formatos admitidos
  const options = LETTERS.map((l) => {
    const value = q.opciones?.[l] ?? q[`opcion_${l.toLowerCase()}` as "opcion_a"];
    if (typeof value !== "string" || !value.trim()) fail(`falta la opción ${l}`);
    return value!.trim();
  });
  if (new Set(options.map((o) => o.toLowerCase())).size < 4) fail("hay opciones repetidas");

  const correct = optionalText(q.correcta).toUpperCase();
  if (!LETTERS.includes(correct as Letter)) fail('"correcta" debe ser A, B, C o D');

  const reference = optionalText(q.articulo);
  const givenLaw = optionalText(q.ley);
  const givenTopic = optionalText(q.tema);

  // Ley: la indicada, la que se deduce del artículo ("... CE") o la del tema antiguo
  const lawInfo = findLaw(givenLaw) ?? findLaw(reference) ?? findLaw(givenTopic);
  const law = lawInfo?.name ?? (givenLaw || givenTopic);
  if (!law) fail('falta "ley" o "tema"');
  const isCE = lawInfo?.name === CE_NAME;
  const ce = isCE ? locateCE(reference) : undefined;

  // Tema: el indicado o, en la Constitución, el Título al que pertenece el artículo
  let topic = givenTopic;
  if (!topic || topic === law || topic === givenLaw) topic = ce?.topic ?? law;

  // Ubicación dentro de la ley (Título, Capítulo, Sección)
  const givenLocation = Array.isArray(q.ubicacion)
    ? q.ubicacion.map(optionalText)
    : optionalText(q.ubicacion).split(/\n|›/).map((s) => s.trim());
  const location = givenLocation.filter(Boolean);
  if (location.length === 0 && ce) location.push(...ce.location);

  // Enlace al texto oficial
  let sourceUrl = optionalText(q.enlace);
  if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) fail('"enlace" debe empezar por https://');
  if (!sourceUrl && lawInfo) sourceUrl = boeUrl(lawInfo, ce ? ce.anchor : articleAnchor(reference));

  const previous = q.enunciado_anterior;
  const previousStatements = (Array.isArray(previous) ? previous : [previous]).map(optionalText).filter(Boolean);

  const cePosition = isCE ? CE_TOPIC_ORDER.indexOf(topic) : -1;
  return {
    where,
    code,
    law,
    topicPosition: cePosition >= 0 ? cePosition : 1000 + appearance,
    data: {
      code,
      law,
      topic,
      statement,
      option_a: options[0],
      option_b: options[1],
      option_c: options[2],
      option_d: options[3],
      correct: correct as Letter,
      reference,
      explanation: optionalText(q.explicacion),
      location: location.join("\n"),
      source_url: sourceUrl,
      exam: optionalText(q.examen),
    },
    previousStatements,
  };
}

/** Lee y comprueba un archivo. Si hay cualquier error, detiene el script sin importar nada. */
function readFile(file: string, firstAppearance: number): ParsedQuestion[] {
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
    return data.map((raw, i) => {
      const id = typeof (raw as JsonQuestion)?.id === "string" ? ` (${(raw as JsonQuestion).id})` : "";
      return parseQuestion(raw, `${name}, pregunta nº ${i + 1}${id}`, firstAppearance + i);
    });
  } catch (err) {
    console.error(`❌ ${(err as Error).message}`);
    process.exit(1);
  }
}

/** Archivos a importar: los indicados en la línea de comandos o todos los de ./preguntas */
function filesToImport(args: string[]): { files: string[]; wholeFolder: boolean } {
  if (args.length > 0) return { files: args.map((f) => path.resolve(f)), wholeFolder: false };

  const dir = path.resolve("preguntas");
  if (!fs.existsSync(dir)) {
    console.error(`❌ No existe la carpeta ${dir}. Crea la carpeta y pon ahí tus archivos .json`);
    process.exit(1);
  }
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".json"))
    .sort((a, b) => a.localeCompare(b, "es", { numeric: true }))
    .map((f) => path.join(dir, f));
  return { files, wholeFolder: true };
}

function main(): void {
  const argv = process.argv.slice(2);
  const cleanLegacy = argv.includes("--limpiar");
  const { files, wholeFolder } = filesToImport(argv.filter((a) => !a.startsWith("--")));

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

  // Leemos y comprobamos todos los archivos antes de tocar la base de datos
  const questions: ParsedQuestion[] = [];
  for (const f of files) {
    const fromFile = readFile(f, questions.length);
    console.log(`📄 ${path.basename(f)}: ${fromFile.length} preguntas`);
    questions.push(...fromFile);
  }

  const seenCodes = new Map<string, string>();
  for (const q of questions) {
    if (!q.code) continue;
    const other = seenCodes.get(q.code);
    if (other) {
      console.error(`❌ El id "${q.code}" está repetido: ${other} y ${q.where}`);
      process.exit(1);
    }
    seenCodes.set(q.code, q.where);
  }

  // Guardamos dentro de una transacción: o entra todo o nada
  const touched = new Set<number>();
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  let duplicated = 0;
  let retired = 0;
  const topics = new Set<number>();

  db.exec("BEGIN");
  try {
    const topicIds = new Map<string, number>();
    for (const q of questions) {
      const key = `${q.law}\u0000${q.data.topic}`;
      if (!topicIds.has(key)) topicIds.set(key, upsertTopic(q.law, q.data.topic, q.topicPosition));
    }

    for (const q of questions) {
      const topicId = topicIds.get(`${q.law}\u0000${q.data.topic}`)!;
      const data: QuestionData = { ...q.data, topic_id: topicId };
      topics.add(topicId);

      // 1) Por id. 2) Pregunta antigua sin id con el mismo enunciado (o el anterior).
      // 3) Sin id en el JSON: misma pregunta por tema y enunciado (comportamiento clásico).
      let row: Question | undefined = q.code ? getQuestionByCode(q.code) : undefined;
      row ??= findLegacyQuestion([q.data.statement, ...q.previousStatements]);
      if (!row && !q.code) row = findByTopicAndStatement(q.data.topic, q.data.statement);
      if (row && touched.has(row.id)) row = undefined; // ya la ha usado otra pregunta de esta importación

      if (row && !q.code && row.code) {
        // Pregunta sin id que ya existe con id: no la tocamos para no perder su id
        duplicated++;
        continue;
      }

      try {
        if (row) {
          if (updateQuestion(row.id, data)) updated++;
          else unchanged++;
          touched.add(row.id);
        } else {
          touched.add(insertQuestion(data));
          inserted++;
        }
      } catch (err) {
        throw new Error(`${q.where}: ${(err as Error).message} (¿hay otra pregunta igual en el mismo tema?)`);
      }
    }

    if (wholeFolder) retired = deactivateCodedExcept([...touched]);

    const legacy = listUntouchedLegacy([...touched]);
    if (legacy.length > 0 && cleanLegacy) {
      deactivateQuestions(legacy.map((l) => l.id));
      retired += legacy.length;
    } else if (legacy.length > 0) {
      console.log(
        `\n⚠️ Hay ${legacy.length === 1 ? "1 pregunta antigua" : `${legacy.length} preguntas antiguas`} (sin "id") que no está${legacy.length === 1 ? "" : "n"} en ningún archivo, por ejemplo:\n` +
          legacy
            .slice(0, 3)
            .map((l) => `   • ${l.statement.slice(0, 90)}`)
            .join("\n") +
          `\n   Si ya no las quieres, retíralas con: npm run import -- --limpiar`
      );
    }

    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    console.error("\n❌ Error al guardar las preguntas, no se ha importado nada:", (err as Error).message);
    process.exit(1);
  }

  const tooLong = questions.filter(
    (q) =>
      q.data.statement.length > CHANNEL_MAX_QUESTION ||
      [q.data.option_a, q.data.option_b, q.data.option_c, q.data.option_d].some((o) => o.length > CHANNEL_MAX_OPTION)
  );

  console.log(
    `\n✅ Leídas: ${questions.length} · Nuevas: ${inserted} · Actualizadas: ${updated} · Sin cambios: ${unchanged}` +
      (duplicated ? ` · Duplicadas: ${duplicated}` : "")
  );
  console.log(`🗂️ Temas: ${topics.size}${retired ? ` · Retiradas: ${retired}` : ""}`);
  if (tooLong.length > 0) {
    console.log(
      `📢 ${tooLong.length} preguntas no se publicarán en el canal (enunciado > ${CHANNEL_MAX_QUESTION} o alguna opción > ${CHANNEL_MAX_OPTION} caracteres): ` +
        tooLong.map((q) => q.code ?? q.where).join(", ")
    );
  }
  console.log(`📚 Preguntas activas en la base de datos: ${countQuestions()}`);
  db.close();
}

main();
