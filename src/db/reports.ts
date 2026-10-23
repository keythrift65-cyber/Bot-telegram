import { db } from "./database";

export interface Report {
  id: number;
  user_id: number;
  question_id: number;
  text: string;
  created_at: string;
  status: "open" | "resolved";
}

/** Guarda un reporte de error. Devuelve su id. */
export function createReport(userId: number, questionId: number, text: string): number {
  return Number(
    db
      .prepare("INSERT INTO reports (user_id, question_id, text, created_at) VALUES (?, ?, ?, ?)")
      .run(userId, questionId, text, new Date().toISOString()).lastInsertRowid
  );
}

export function getReport(id: number): Report | undefined {
  return db.prepare("SELECT * FROM reports WHERE id = ?").get(id) as Report | undefined;
}

/** Reportes pendientes, del más antiguo al más reciente */
export function listOpenReports(limit = 10): (Report & { user_name: string; code: string | null; statement: string })[] {
  return db
    .prepare(
      `SELECT r.*, u.name AS user_name, q.code AS code, q.statement AS statement
       FROM reports r
       JOIN users u ON u.id = r.user_id
       JOIN questions q ON q.id = r.question_id
       WHERE r.status = 'open'
       ORDER BY r.id
       LIMIT ?`
    )
    .all(limit) as unknown as (Report & { user_name: string; code: string | null; statement: string })[];
}

/** Marca un reporte como resuelto. Devuelve false si no existía o ya estaba resuelto. */
export function resolveReport(id: number): boolean {
  return db.prepare("UPDATE reports SET status = 'resolved' WHERE id = ? AND status = 'open'").run(id).changes > 0;
}

export function countOpenReports(): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM reports WHERE status = 'open'").get() as { n: number }).n;
}

export function countReportsForQuestion(questionId: number): number {
  return (
    db.prepare("SELECT COUNT(*) AS n FROM reports WHERE question_id = ?").get(questionId) as { n: number }
  ).n;
}
