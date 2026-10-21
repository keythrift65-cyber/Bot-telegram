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
  const result = db
    .prepare(
      `INSERT OR IGNORE INTO answers (user_id, question_id, is_correct, answered_at, message_id)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(userId, questionId, isCorrect ? 1 : 0, new Date().toISOString(), messageId);
  return result.changes > 0;
}

/** Respuestas dadas por el usuario desde una fecha (para el límite diario) */
export function countAnswersSince(userId: number, sinceIso: string): number {
  return (
    db
      .prepare("SELECT COUNT(*) AS n FROM answers WHERE user_id = ? AND answered_at >= ?")
      .get(userId, sinceIso) as { n: number }
  ).n;
}

export interface TopicStats {
  topic: string;
  total: number;
  correct: number;
}

/** Estadísticas del usuario agrupadas por tema */
export function getStatsByTopic(userId: number): TopicStats[] {
  return db
    .prepare(
      `SELECT q.topic AS topic, COUNT(*) AS total, SUM(a.is_correct) AS correct
       FROM answers a JOIN questions q ON q.id = a.question_id
       WHERE a.user_id = ?
       GROUP BY q.topic
       ORDER BY total DESC`
    )
    .all(userId) as TopicStats[];
}
