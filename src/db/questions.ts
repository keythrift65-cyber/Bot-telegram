import { db } from "./database";

export type Letter = "A" | "B" | "C" | "D";
export const LETTERS: Letter[] = ["A", "B", "C", "D"];

export interface Question {
  id: number;
  topic: string;
  statement: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct: Letter;
  reference: string;
  explanation: string;
}

export type NewQuestion = Omit<Question, "id">;

/** Devuelve las 4 opciones en orden original [A, B, C, D] */
export function optionsOf(q: Question): string[] {
  return [q.option_a, q.option_b, q.option_c, q.option_d];
}

export function getQuestion(id: number): Question | undefined {
  return db.prepare("SELECT * FROM questions WHERE id = ?").get(id) as Question | undefined;
}

/**
 * Pregunta aleatoria que el usuario NO haya respondido desde `sinceIso`.
 * Si ya las ha respondido todas en ese periodo, devuelve cualquiera al azar.
 */
export function getRandomQuestion(userId: number, sinceIso: string): Question | undefined {
  const fresh = db
    .prepare(
      `SELECT * FROM questions
       WHERE id NOT IN (
         SELECT question_id FROM answers WHERE user_id = ? AND answered_at >= ?
       )
       ORDER BY RANDOM() LIMIT 1`
    )
    .get(userId, sinceIso) as Question | undefined;
  if (fresh) return fresh;

  return db.prepare("SELECT * FROM questions ORDER BY RANDOM() LIMIT 1").get() as
    | Question
    | undefined;
}

/**
 * Pregunta aleatoria entre las que el usuario ha fallado y no ha acertado después.
 */
export function getRandomFailedQuestion(userId: number): Question | undefined {
  return db
    .prepare(
      `SELECT q.* FROM questions q
       WHERE EXISTS (
         SELECT 1 FROM answers a
         WHERE a.user_id = ? AND a.question_id = q.id AND a.is_correct = 0
           AND NOT EXISTS (
             SELECT 1 FROM answers b
             WHERE b.user_id = a.user_id AND b.question_id = a.question_id
               AND b.is_correct = 1 AND b.answered_at > a.answered_at
           )
       )
       ORDER BY RANDOM() LIMIT 1`
    )
    .get(userId) as Question | undefined;
}

/** Número de preguntas pendientes de repasar */
export function countFailedQuestions(userId: number): number {
  return (
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM questions q
         WHERE EXISTS (
           SELECT 1 FROM answers a
           WHERE a.user_id = ? AND a.question_id = q.id AND a.is_correct = 0
             AND NOT EXISTS (
               SELECT 1 FROM answers b
               WHERE b.user_id = a.user_id AND b.question_id = a.question_id
                 AND b.is_correct = 1 AND b.answered_at > a.answered_at
             )
         )`
      )
      .get(userId) as { n: number }
  ).n;
}

/**
 * Inserta una pregunta si no existe otra con el mismo tema y enunciado.
 * Devuelve true si se ha insertado.
 */
export function insertQuestionIfNew(q: NewQuestion): boolean {
  const result = db
    .prepare(
      `INSERT OR IGNORE INTO questions
         (topic, statement, option_a, option_b, option_c, option_d, correct, reference, explanation)
       VALUES (@topic, @statement, @option_a, @option_b, @option_c, @option_d, @correct, @reference, @explanation)`
    )
    .run(q);
  return result.changes > 0;
}

export function countQuestions(): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM questions").get() as { n: number }).n;
}
