import { db } from "./database";

export type Letter = "A" | "B" | "C" | "D";
export const LETTERS: Letter[] = ["A", "B", "C", "D"];

export interface Question {
  id: number;
  /** Identificador estable del JSON (ej: "CE-017"), NULL en preguntas importadas con versiones antiguas */
  code: string | null;
  /** Ley de la que sale la pregunta (ej: "Constitución Española") */
  law: string;
  topic: string;
  topic_id: number | null;
  statement: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct: Letter;
  /** Artículo de referencia (ej: "Art. 1.1 CE") */
  reference: string;
  explanation: string;
  /** Ubicación dentro de la ley, una línea por nivel (Título, Capítulo, Sección) */
  location: string;
  /** Enlace al texto oficial (BOE) */
  source_url: string;
  /** Examen oficial en el que apareció la pregunta, si se conoce */
  exam: string;
  active: number;
}

/** Datos de una pregunta tal y como llegan del importador */
export type QuestionData = Omit<Question, "id" | "active">;

/** Devuelve las 4 opciones en orden original [A, B, C, D] */
export function optionsOf(q: Question): string[] {
  return [q.option_a, q.option_b, q.option_c, q.option_d];
}

/** Pregunta por id (también las retiradas, para poder corregir mensajes antiguos) */
export function getQuestion(id: number): Question | undefined {
  return db.prepare("SELECT * FROM questions WHERE id = ?").get(id) as Question | undefined;
}

export function getQuestionByCode(code: string): Question | undefined {
  return db.prepare("SELECT * FROM questions WHERE code = ?").get(code) as Question | undefined;
}

/**
 * Pregunta aleatoria que el usuario NO haya respondido desde `sinceIso`, opcionalmente
 * de un tema concreto. Si ya las ha respondido todas en ese periodo, devuelve cualquiera.
 */
export function getRandomQuestion(userId: number, sinceIso: string, topicId?: number): Question | undefined {
  const topicFilter = topicId !== undefined ? "AND topic_id = ?" : "";
  const topicArgs = topicId !== undefined ? [topicId] : [];

  const fresh = db
    .prepare(
      `SELECT * FROM questions
       WHERE active = 1 ${topicFilter}
         AND id NOT IN (SELECT question_id FROM answers WHERE user_id = ? AND answered_at >= ?)
       ORDER BY RANDOM() LIMIT 1`
    )
    .get(...topicArgs, userId, sinceIso) as Question | undefined;
  if (fresh) return fresh;

  return db
    .prepare(`SELECT * FROM questions WHERE active = 1 ${topicFilter} ORDER BY RANDOM() LIMIT 1`)
    .get(...topicArgs) as Question | undefined;
}

/** Condición SQL: preguntas que el usuario ha fallado y no ha acertado después */
const FAILED_FILTER = `
  q.active = 1 AND EXISTS (
    SELECT 1 FROM answers a
    WHERE a.user_id = ? AND a.question_id = q.id AND a.is_correct = 0
      AND NOT EXISTS (
        SELECT 1 FROM answers b
        WHERE b.user_id = a.user_id AND b.question_id = a.question_id
          AND b.is_correct = 1 AND b.answered_at > a.answered_at
      )
  )`;

/** Pregunta aleatoria entre las que el usuario ha fallado y no ha acertado después */
export function getRandomFailedQuestion(userId: number): Question | undefined {
  return db
    .prepare(`SELECT q.* FROM questions q WHERE ${FAILED_FILTER} ORDER BY RANDOM() LIMIT 1`)
    .get(userId) as Question | undefined;
}

/** Número de preguntas pendientes de repasar */
export function countFailedQuestions(userId: number): number {
  return (
    db.prepare(`SELECT COUNT(*) AS n FROM questions q WHERE ${FAILED_FILTER}`).get(userId) as { n: number }
  ).n;
}

/** Ids de preguntas activas al azar (para los simulacros) */
export function getRandomQuestionIds(limit: number): number[] {
  return (
    db.prepare("SELECT id FROM questions WHERE active = 1 ORDER BY RANDOM() LIMIT ?").all(limit) as {
      id: number;
    }[]
  ).map((r) => r.id);
}

/** Cuántas veces se ha respondido una pregunta (todos los usuarios) y cuántas se acertó */
export function getQuestionSuccess(questionId: number): { total: number; correct: number } {
  return db
    .prepare(
      `SELECT COUNT(*) AS total, COALESCE(SUM(is_correct), 0) AS correct
       FROM answers WHERE question_id = ?`
    )
    .get(questionId) as { total: number; correct: number };
}

export function countQuestions(): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM questions WHERE active = 1").get() as { n: number }).n;
}

/** Preguntas activas por ley (para las estadísticas del administrador) */
export function countQuestionsByLaw(): { law: string; n: number }[] {
  return db
    .prepare(
      `SELECT CASE WHEN law = '' THEN topic ELSE law END AS law, COUNT(*) AS n
       FROM questions WHERE active = 1 GROUP BY 1 ORDER BY n DESC`
    )
    .all() as { law: string; n: number }[];
}

export function countInactiveQuestions(): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM questions WHERE active = 0").get() as { n: number }).n;
}

// ---------------------------------------------------------------------------
// Importación
// ---------------------------------------------------------------------------

/** Busca una pregunta importada con una versión antigua (sin código) por su enunciado */
export function findLegacyQuestion(statements: string[]): Question | undefined {
  for (const statement of statements) {
    const row = db
      .prepare("SELECT * FROM questions WHERE code IS NULL AND statement = ? ORDER BY id LIMIT 1")
      .get(statement) as Question | undefined;
    if (row) return row;
  }
  return undefined;
}

/** Busca una pregunta sin código por tema y enunciado (formato antiguo, sin "id" en el JSON) */
export function findByTopicAndStatement(topic: string, statement: string): Question | undefined {
  return db
    .prepare("SELECT * FROM questions WHERE topic = ? AND statement = ?")
    .get(topic, statement) as Question | undefined;
}

const COLUMNS = [
  "code",
  "law",
  "topic",
  "topic_id",
  "statement",
  "option_a",
  "option_b",
  "option_c",
  "option_d",
  "correct",
  "reference",
  "explanation",
  "location",
  "source_url",
  "exam",
] as const;

export function insertQuestion(q: QuestionData): number {
  const result = db
    .prepare(
      `INSERT INTO questions (${COLUMNS.join(", ")}, active)
       VALUES (${COLUMNS.map((c) => "@" + c).join(", ")}, 1)`
    )
    .run({ ...q });
  return Number(result.lastInsertRowid);
}

/** Actualiza una pregunta existente. Devuelve true si ha cambiado algún dato. */
export function updateQuestion(id: number, q: QuestionData): boolean {
  const current = getQuestion(id);
  if (!current) return false;
  const changed = current.active !== 1 || COLUMNS.some((c) => current[c] !== q[c]);
  if (!changed) return false;
  db.prepare(
    `UPDATE questions SET ${COLUMNS.map((c) => `${c} = @${c}`).join(", ")}, active = 1 WHERE id = @id`
  ).run({ ...q, id });
  return true;
}

/** Retira las preguntas con código que no están en la lista. Devuelve cuántas se han retirado. */
export function deactivateCodedExcept(keepIds: number[]): number {
  db.exec("CREATE TEMP TABLE IF NOT EXISTS keep_ids (id INTEGER PRIMARY KEY)");
  db.exec("DELETE FROM keep_ids");
  const insert = db.prepare("INSERT OR IGNORE INTO keep_ids (id) VALUES (?)");
  for (const id of keepIds) insert.run(id);
  const result = db
    .prepare(
      "UPDATE questions SET active = 0 WHERE active = 1 AND code IS NOT NULL AND id NOT IN (SELECT id FROM keep_ids)"
    )
    .run();
  return Number(result.changes);
}

/** Preguntas activas sin código que no se han tocado en esta importación (de versiones antiguas) */
export function listUntouchedLegacy(touchedIds: number[]): Question[] {
  const touched = new Set(touchedIds);
  return (db.prepare("SELECT * FROM questions WHERE active = 1 AND code IS NULL").all() as unknown as Question[]).filter(
    (q) => !touched.has(q.id)
  );
}

export function deactivateQuestions(ids: number[]): void {
  const stmt = db.prepare("UPDATE questions SET active = 0 WHERE id = ?");
  for (const id of ids) stmt.run(id);
}
