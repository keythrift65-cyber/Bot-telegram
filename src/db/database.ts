import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import "./silence-sqlite-warning";
import { DatabaseSync } from "node:sqlite";
import { madridDay } from "../services/time";

/**
 * Abre (o crea) la base de datos SQLite y se asegura de que existen las tablas.
 * Usa el SQLite que viene incluido en Node.js (node:sqlite), así no hay que compilar nada.
 * Las fechas se guardan como texto ISO 8601 en UTC (ej: "2026-01-31T10:00:00.000Z"),
 * así se pueden comparar directamente como cadenas.
 */
export function openDatabase(dbPath: string): DatabaseSync {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL"); // Mejor rendimiento con lecturas y escrituras simultáneas
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000"); // Espera si otro proceso (ej: npm run import) está escribiendo

  // Tablas originales. Las columnas añadidas en versiones posteriores están en migrate()
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

    -- Preguntas publicadas en el canal. "cycle" es la vuelta: cuando se han publicado
    -- todas las preguntas, empieza una vuelta nueva y se pueden repetir.
    CREATE TABLE IF NOT EXISTS channel_posts (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id INTEGER NOT NULL REFERENCES questions(id),
      cycle       INTEGER NOT NULL,
      posted_at   TEXT    NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_channel_posts_cycle ON channel_posts (cycle, question_id);

    -- Temas para "Practicar por temas" y las estadísticas (ej: "Título II · La Corona")
    CREATE TABLE IF NOT EXISTS topics (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      law      TEXT    NOT NULL,                -- ej: "Constitución Española"
      name     TEXT    NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,      -- orden en el menú
      UNIQUE (law, name)
    );

    -- Simulacros de examen
    CREATE TABLE IF NOT EXISTS exams (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id),
      size        INTEGER NOT NULL,
      status      TEXT    NOT NULL DEFAULT 'active',  -- active | finished | abandoned
      started_at  TEXT    NOT NULL,
      finished_at TEXT,
      correct     INTEGER NOT NULL DEFAULT 0,
      wrong       INTEGER NOT NULL DEFAULT 0,
      blank       INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_exams_user ON exams (user_id, status);

    CREATE TABLE IF NOT EXISTS exam_questions (
      exam_id      INTEGER NOT NULL REFERENCES exams(id),
      position     INTEGER NOT NULL,          -- 1, 2, 3…
      question_id  INTEGER NOT NULL REFERENCES questions(id),
      option_order TEXT    NOT NULL,          -- orden en que se muestran las opciones, ej: "2031"
      result       TEXT,                      -- NULL (pendiente) | ok | fail | blank
      chosen       TEXT,                      -- letra original elegida (A-D)
      PRIMARY KEY (exam_id, position)
    );

    -- Errores que los usuarios reportan en las preguntas
    CREATE TABLE IF NOT EXISTS reports (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id),
      question_id INTEGER NOT NULL REFERENCES questions(id),
      text        TEXT    NOT NULL,
      created_at  TEXT    NOT NULL,
      status      TEXT    NOT NULL DEFAULT 'open'  -- open | resolved
    );
  `);

  migrate(db);
  return db;
}

/** Añade una columna si todavía no existe (para bases de datos de versiones anteriores) */
function addColumn(db: DatabaseSync, table: string, column: string, definition: string): void {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!columns.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

/** Actualiza bases de datos creadas con versiones anteriores del bot, sin perder datos */
function migrate(db: DatabaseSync): void {
  // Usuarios
  addColumn(db, "users", "source", "TEXT"); // De dónde llegó (ej: "canal" si entró con /start canal)
  addColumn(db, "users", "last_seen", "TEXT"); // Última vez que usó el bot
  addColumn(db, "users", "blocked", "INTEGER NOT NULL DEFAULT 0"); // 1 si ha bloqueado al bot
  addColumn(db, "users", "reminder_hour", "INTEGER"); // Hora del recordatorio diario (NULL = sin recordatorio)
  addColumn(db, "users", "bonus_questions", "INTEGER NOT NULL DEFAULT 0"); // Preguntas extra por invitar amigos
  addColumn(db, "users", "referred_by", "INTEGER"); // Quién le invitó
  addColumn(db, "users", "referral_rewarded", "INTEGER NOT NULL DEFAULT 0"); // 1 si ya se premió a quien le invitó

  // Preguntas
  addColumn(db, "questions", "code", "TEXT"); // Identificador estable del JSON (ej: "CE-017")
  addColumn(db, "questions", "law", "TEXT NOT NULL DEFAULT ''"); // Ley (ej: "Constitución Española")
  addColumn(db, "questions", "location", "TEXT NOT NULL DEFAULT ''"); // Título, Capítulo… (una línea por nivel)
  addColumn(db, "questions", "source_url", "TEXT NOT NULL DEFAULT ''"); // Enlace al texto oficial
  addColumn(db, "questions", "exam", "TEXT NOT NULL DEFAULT ''"); // Examen oficial en el que apareció, si lo hay
  addColumn(db, "questions", "topic_id", "INTEGER REFERENCES topics(id)");
  addColumn(db, "questions", "active", "INTEGER NOT NULL DEFAULT 1"); // 0 = retirada (no se pregunta)
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_questions_code ON questions (code)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions (topic_id, active)");

  // Respuestas: día del calendario de Madrid (para el límite diario y las rachas)
  addColumn(db, "answers", "day", "TEXT");
  db.exec("CREATE INDEX IF NOT EXISTS idx_answers_user_day ON answers (user_id, day)");
  const pending = db.prepare("SELECT id, answered_at FROM answers WHERE day IS NULL").all() as {
    id: number;
    answered_at: string;
  }[];
  if (pending.length > 0) {
    const update = db.prepare("UPDATE answers SET day = ? WHERE id = ?");
    db.exec("BEGIN");
    for (const row of pending) update.run(madridDay(new Date(row.answered_at)), row.id);
    db.exec("COMMIT");
  }
}

/** Conexión única que comparte todo el proyecto */
export const db = openDatabase(path.resolve(process.env.DB_PATH ?? "./data/bot.sqlite"));
