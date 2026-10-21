import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

/**
 * Abre (o crea) la base de datos SQLite y se asegura de que existen las tablas.
 * Las fechas se guardan como texto ISO 8601 en UTC (ej: "2026-01-31T10:00:00.000Z"),
 * así se pueden comparar directamente como cadenas.
 */
export function openDatabase(dbPath: string): Database.Database {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL"); // Mejor rendimiento con lecturas y escrituras simultáneas
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id                INTEGER PRIMARY KEY,      -- id de Telegram
      name              TEXT    NOT NULL,
      created_at        TEXT    NOT NULL,
      subscription_end  TEXT                      -- NULL si no es premium
    );

    CREATE TABLE IF NOT EXISTS questions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      topic       TEXT NOT NULL,
      statement   TEXT NOT NULL,
      option_a    TEXT NOT NULL,
      option_b    TEXT NOT NULL,
      option_c    TEXT NOT NULL,
      option_d    TEXT NOT NULL,
      correct     TEXT NOT NULL CHECK (correct IN ('A','B','C','D')),
      reference   TEXT NOT NULL DEFAULT '',     -- ej: "Art. 1.1 CE"
      explanation TEXT NOT NULL DEFAULT '',
      UNIQUE (topic, statement)                 -- evita duplicados al importar
    );

    CREATE TABLE IF NOT EXISTS answers (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id),
      question_id INTEGER NOT NULL REFERENCES questions(id),
      is_correct  INTEGER NOT NULL,             -- 1 acierto, 0 fallo
      answered_at TEXT    NOT NULL,
      message_id  INTEGER NOT NULL,             -- evita contar dos veces el mismo mensaje
      UNIQUE (user_id, message_id)
    );
    CREATE INDEX IF NOT EXISTS idx_answers_user_date ON answers (user_id, answered_at);
    CREATE INDEX IF NOT EXISTS idx_answers_user_question ON answers (user_id, question_id);

    CREATE TABLE IF NOT EXISTS payments (
      id                          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id                     INTEGER NOT NULL REFERENCES users(id),
      telegram_payment_charge_id  TEXT    NOT NULL UNIQUE,
      stars                       INTEGER NOT NULL,
      paid_at                     TEXT    NOT NULL,
      expires_at                  TEXT    NOT NULL,
      is_recurring                INTEGER NOT NULL DEFAULT 0,  -- 1 si es una renovación automática
      refunded                    INTEGER NOT NULL DEFAULT 0
    );
  `);

  return db;
}

/** Conexión única que comparte todo el proyecto */
export const db = openDatabase(path.resolve(process.env.DB_PATH ?? "./data/bot.sqlite"));
