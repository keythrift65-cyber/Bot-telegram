import { db } from "./database";
import type { Letter } from "./questions";

export type ExamStatus = "active" | "finished" | "abandoned";
export type ExamResult = "ok" | "fail" | "blank";

export interface Exam {
  id: number;
  user_id: number;
  size: number;
  status: ExamStatus;
  started_at: string;
  finished_at: string | null;
  correct: number;
  wrong: number;
  blank: number;
}

export interface ExamQuestion {
  exam_id: number;
  position: number;
  question_id: number;
  /** Orden en que se muestran las opciones (ej: "2031") */
  option_order: string;
  result: ExamResult | null;
  chosen: Letter | null;
}

/**
 * Crea un simulacro con las preguntas indicadas. Abandona antes cualquier otro
 * simulacro que el usuario tuviera a medias. Devuelve el id del simulacro.
 */
export function createExam(userId: number, questions: { questionId: number; order: string }[]): number {
  db.exec("BEGIN");
  try {
    db.prepare("UPDATE exams SET status = 'abandoned' WHERE user_id = ? AND status = 'active'").run(userId);
    const examId = Number(
      db
        .prepare("INSERT INTO exams (user_id, size, started_at) VALUES (?, ?, ?)")
        .run(userId, questions.length, new Date().toISOString()).lastInsertRowid
    );
    const insert = db.prepare(
      "INSERT INTO exam_questions (exam_id, position, question_id, option_order) VALUES (?, ?, ?, ?)"
    );
    questions.forEach((q, i) => insert.run(examId, i + 1, q.questionId, q.order));
    db.exec("COMMIT");
    return examId;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export function getExam(id: number): Exam | undefined {
  return db.prepare("SELECT * FROM exams WHERE id = ?").get(id) as Exam | undefined;
}

export function getExamQuestion(examId: number, position: number): ExamQuestion | undefined {
  return db
    .prepare("SELECT * FROM exam_questions WHERE exam_id = ? AND position = ?")
    .get(examId, position) as ExamQuestion | undefined;
}

/** Siguiente pregunta sin responder del simulacro, o undefined si ya no quedan */
export function getNextPending(examId: number): ExamQuestion | undefined {
  return db
    .prepare("SELECT * FROM exam_questions WHERE exam_id = ? AND result IS NULL ORDER BY position LIMIT 1")
    .get(examId) as ExamQuestion | undefined;
}

/** Guarda la respuesta de una pregunta. Devuelve false si ya estaba respondida. */
export function saveExamAnswer(
  examId: number,
  position: number,
  result: ExamResult,
  chosen: Letter | null
): boolean {
  return (
    db
      .prepare(
        "UPDATE exam_questions SET result = ?, chosen = ? WHERE exam_id = ? AND position = ? AND result IS NULL"
      )
      .run(result, chosen, examId, position).changes > 0
  );
}

/**
 * Termina el simulacro: las preguntas sin responder cuentan como en blanco y se
 * guardan los totales. Devuelve false si ya estaba terminado.
 */
export function finishExam(examId: number): boolean {
  db.exec("BEGIN");
  try {
    const updated = db
      .prepare("UPDATE exams SET status = 'finished', finished_at = ? WHERE id = ? AND status = 'active'")
      .run(new Date().toISOString(), examId).changes;
    if (updated === 0) {
      db.exec("ROLLBACK");
      return false;
    }
    db.prepare("UPDATE exam_questions SET result = 'blank' WHERE exam_id = ? AND result IS NULL").run(examId);
    const totals = db
      .prepare(
        `SELECT COALESCE(SUM(result = 'ok'), 0) AS correct,
                COALESCE(SUM(result = 'fail'), 0) AS wrong,
                COALESCE(SUM(result = 'blank'), 0) AS blank
         FROM exam_questions WHERE exam_id = ?`
      )
      .get(examId) as { correct: number; wrong: number; blank: number };
    db.prepare("UPDATE exams SET correct = ?, wrong = ?, blank = ? WHERE id = ?").run(
      totals.correct,
      totals.wrong,
      totals.blank,
      examId
    );
    db.exec("COMMIT");
    return true;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

/** Todas las preguntas del simulacro, en orden */
export function listExamQuestions(examId: number): ExamQuestion[] {
  return db
    .prepare("SELECT * FROM exam_questions WHERE exam_id = ? ORDER BY position")
    .all(examId) as unknown as ExamQuestion[];
}

/** Últimos simulacros terminados del usuario, del más reciente al más antiguo */
export function listRecentExams(userId: number, limit = 5): Exam[] {
  return db
    .prepare("SELECT * FROM exams WHERE user_id = ? AND status = 'finished' ORDER BY id DESC LIMIT ?")
    .all(userId, limit) as unknown as Exam[];
}

export function countFinishedExams(): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM exams WHERE status = 'finished'").get() as { n: number }).n;
}
