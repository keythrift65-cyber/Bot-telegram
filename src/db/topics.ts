import { db } from "./database";

export interface Topic {
  id: number;
  law: string;
  name: string;
  position: number;
}

export interface TopicWithCount extends Topic {
  /** Preguntas activas del tema */
  questions: number;
}

/** Crea el tema si no existe y actualiza su posición. Devuelve su id. */
export function upsertTopic(law: string, name: string, position: number): number {
  db.prepare(
    `INSERT INTO topics (law, name, position) VALUES (?, ?, ?)
     ON CONFLICT (law, name) DO UPDATE SET position = excluded.position`
  ).run(law, name, position);
  return (db.prepare("SELECT id FROM topics WHERE law = ? AND name = ?").get(law, name) as { id: number }).id;
}

export function getTopic(id: number): Topic | undefined {
  return db.prepare("SELECT * FROM topics WHERE id = ?").get(id) as Topic | undefined;
}

/** Temas que tienen preguntas activas, en el orden del menú */
export function listTopics(law?: string): TopicWithCount[] {
  const filter = law !== undefined ? "AND t.law = ?" : "";
  return db
    .prepare(
      `SELECT t.*, COUNT(q.id) AS questions
       FROM topics t JOIN questions q ON q.topic_id = t.id AND q.active = 1
       WHERE 1 = 1 ${filter}
       GROUP BY t.id
       ORDER BY t.position, t.name`
    )
    .all(...(law !== undefined ? [law] : [])) as unknown as TopicWithCount[];
}

export interface LawWithCount {
  law: string;
  /** Preguntas activas de la ley */
  questions: number;
}

/** Leyes que tienen preguntas activas, en el orden del menú */
export function listLaws(): LawWithCount[] {
  return db
    .prepare(
      `SELECT t.law AS law, COUNT(q.id) AS questions
       FROM topics t JOIN questions q ON q.topic_id = t.id AND q.active = 1
       GROUP BY t.law ORDER BY MIN(t.position)`
    )
    .all() as unknown as LawWithCount[];
}

/** Aciertos y respuestas del usuario en cada tema (clave: id del tema) */
export function getUserTopicStats(userId: number): Map<number, { total: number; correct: number }> {
  const rows = db
    .prepare(
      `SELECT q.topic_id AS topicId, COUNT(*) AS total, SUM(a.is_correct) AS correct
       FROM answers a JOIN questions q ON q.id = a.question_id
       WHERE a.user_id = ? AND q.topic_id IS NOT NULL
       GROUP BY q.topic_id`
    )
    .all(userId) as { topicId: number; total: number; correct: number }[];
  return new Map(rows.map((r) => [r.topicId, { total: r.total, correct: r.correct }]));
}
