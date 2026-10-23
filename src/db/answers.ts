import { madridDay } from "../services/time";
import { db } from "./database";

/**
 * Guarda una respuesta. Si ese mensaje ya se había respondido (doble pulsación),
 * no hace nada y devuelve false.
 */
export function saveAnswer(
  userId: number,
  questionId: number,
  isCorrect: boolean,
  messageId: number
): boolean {
  const now = new Date();
  const result = db
    .prepare(
      `INSERT OR IGNORE INTO answers (user_id, question_id, is_correct, answered_at, message_id, day)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(userId, questionId, isCorrect ? 1 : 0, now.toISOString(), messageId, madridDay(now));
  return result.changes > 0;
}

/** Respuestas del usuario en un día ("AAAA-MM-DD", hora de Madrid) */
export function countAnswersOnDay(userId: number, day: string): number {
  return (
    db.prepare("SELECT COUNT(*) AS n FROM answers WHERE user_id = ? AND day = ?").get(userId, day) as {
      n: number;
    }
  ).n;
}

/** Respuestas del usuario en total */
export function countAnswersTotal(userId: number): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM answers WHERE user_id = ?").get(userId) as { n: number }).n;
}

/** Días en los que el usuario ha respondido algo, del más reciente al más antiguo */
export function getAnsweredDays(userId: number, limit = 1000): string[] {
  return (
    db
      .prepare(
        "SELECT DISTINCT day FROM answers WHERE user_id = ? AND day IS NOT NULL ORDER BY day DESC LIMIT ?"
      )
      .all(userId, limit) as { day: string }[]
  ).map((r) => r.day);
}

/** Preguntas activas distintas que el usuario ha respondido alguna vez */
export function countDistinctAnswered(userId: number): number {
  return (
    db
      .prepare(
        `SELECT COUNT(DISTINCT a.question_id) AS n
         FROM answers a JOIN questions q ON q.id = a.question_id AND q.active = 1
         WHERE a.user_id = ?`
      )
      .get(userId) as { n: number }
  ).n;
}

export interface TopicStats {
  topicId: number | null;
  /** Ley del tema ("" en preguntas antiguas sin ley) */
  law: string;
  topic: string;
  total: number;
  correct: number;
}

/** Estadísticas del usuario agrupadas por tema */
export function getStatsByTopic(userId: number): TopicStats[] {
  return db
    .prepare(
      `SELECT q.topic_id AS topicId, COALESCE(t.law, q.law) AS law, COALESCE(t.name, q.topic) AS topic,
              COUNT(*) AS total, SUM(a.is_correct) AS correct
       FROM answers a
       JOIN questions q ON q.id = a.question_id
       LEFT JOIN topics t ON t.id = q.topic_id
       WHERE a.user_id = ?
       GROUP BY q.topic_id, COALESCE(t.law, q.law), COALESCE(t.name, q.topic)
       ORDER BY total DESC`
    )
    .all(userId) as unknown as TopicStats[];
}

/** Respuestas de todos los usuarios en un día (para el administrador) */
export function countAllAnswersOnDay(day: string): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM answers WHERE day = ?").get(day) as { n: number }).n;
}

export function countAllAnswers(): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM answers").get() as { n: number }).n;
}
