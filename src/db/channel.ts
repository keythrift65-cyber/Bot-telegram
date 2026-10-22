import { db } from "./database";
import type { Question } from "./questions";

/** Vuelta actual de publicaciones (1 si todavía no se ha publicado nada) */
export function currentCycle(): number {
  const row = db.prepare("SELECT MAX(cycle) AS c FROM channel_posts").get() as { c: number | null };
  return row.c ?? 1;
}

/** Preguntas aún no publicadas en la vuelta indicada, en orden aleatorio */
export function getUnpostedQuestions(cycle: number): Question[] {
  return db
    .prepare(
      `SELECT * FROM questions
       WHERE id NOT IN (SELECT question_id FROM channel_posts WHERE cycle = ?)
       ORDER BY RANDOM()`
    )
    .all(cycle) as unknown as Question[];
}

/** Todas las preguntas en orden aleatorio (para empezar una vuelta nueva) */
export function getAllQuestionsShuffled(): Question[] {
  return db.prepare("SELECT * FROM questions ORDER BY RANDOM()").all() as unknown as Question[];
}

export function saveChannelPost(questionId: number, cycle: number): void {
  db.prepare("INSERT INTO channel_posts (question_id, cycle, posted_at) VALUES (?, ?, ?)").run(
    questionId,
    cycle,
    new Date().toISOString()
  );
}

/** Publicaciones hechas desde una fecha (para saber si ya se publicó hoy) */
export function countChannelPostsSince(sinceIso: string): number {
  return (
    db.prepare("SELECT COUNT(*) AS n FROM channel_posts WHERE posted_at >= ?").get(sinceIso) as {
      n: number;
    }
  ).n;
}

export function getChannelPostStats(cycle: number): {
  total: number;
  inCycle: number;
  lastPostedAt: string | null;
} {
  return db
    .prepare(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(CASE WHEN cycle = ? THEN 1 ELSE 0 END), 0) AS inCycle,
              MAX(posted_at) AS lastPostedAt
       FROM channel_posts`
    )
    .get(cycle) as { total: number; inCycle: number; lastPostedAt: string | null };
}
