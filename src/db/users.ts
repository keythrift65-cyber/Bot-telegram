import { db } from "./database";

export interface User {
  id: number;
  name: string;
  created_at: string;
  subscription_end: string | null;
  source: string | null;
  last_seen: string | null;
  /** 1 si el usuario ha bloqueado al bot (no se le envían recordatorios ni anuncios) */
  blocked: number;
  /** Hora (0-23, Madrid) del recordatorio diario, o null si no lo quiere */
  reminder_hour: number | null;
  /** Preguntas extra conseguidas invitando a amigos */
  bonus_questions: number;
  /** Usuario que le invitó al bot */
  referred_by: number | null;
  /** 1 si ya se premió a quien le invitó */
  referral_rewarded: number;
}

/**
 * Crea el usuario si no existe o actualiza su nombre si ya existe. Apunta la última
 * vez que usó el bot y, si lo tenía bloqueado, lo marca como desbloqueado.
 * Devuelve true si el usuario es nuevo.
 */
export function upsertUser(id: number, name: string): boolean {
  const now = new Date().toISOString();
  const isNew = !db.prepare("SELECT 1 FROM users WHERE id = ?").get(id);
  db.prepare(
    `INSERT INTO users (id, name, created_at, last_seen) VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, last_seen = excluded.last_seen, blocked = 0`
  ).run(id, name, now, now);
  return isNew;
}

export function getUser(id: number): User | undefined {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as User | undefined;
}

/** Cambia la fecha de fin de suscripción (null = sin premium) */
export function setSubscriptionEnd(id: number, endIso: string | null): void {
  db.prepare("UPDATE users SET subscription_end = ? WHERE id = ?").run(endIso, id);
}

export function countUsers(): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n;
}

export function countActivePremium(nowIso: string): number {
  return (
    db.prepare("SELECT COUNT(*) AS n FROM users WHERE subscription_end > ?").get(nowIso) as {
      n: number;
    }
  ).n;
}

/** Guarda de dónde llegó el usuario, solo la primera vez (no se sobrescribe) */
export function setSourceIfEmpty(id: number, source: string): boolean {
  return db.prepare("UPDATE users SET source = ? WHERE id = ? AND source IS NULL").run(source, id).changes > 0;
}

/** Usuarios que llegaron desde un origen, y cuántos de ellos son premium ahora */
export function countUsersBySource(source: string, nowIso: string): { total: number; premium: number } {
  return db
    .prepare(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(CASE WHEN subscription_end > ? THEN 1 ELSE 0 END), 0) AS premium
       FROM users WHERE source = ?`
    )
    .get(nowIso, source) as { total: number; premium: number };
}

export interface SourceStats {
  source: string | null;
  total: number;
  premium: number;
  stars: number;
}

/**
 * Usuarios agrupados por origen (null = sin origen: entraron sin enlace con ?start=…),
 * con cuántos son premium ahora y cuántas estrellas han pagado (sin reembolsos).
 */
export function getStatsBySource(nowIso: string): SourceStats[] {
  return db
    .prepare(
      `SELECT u.source AS source,
              COUNT(*) AS total,
              COALESCE(SUM(CASE WHEN u.subscription_end > ? THEN 1 ELSE 0 END), 0) AS premium,
              COALESCE(SUM(p.stars), 0) AS stars
       FROM users u
       LEFT JOIN (
         SELECT user_id, SUM(stars) AS stars FROM payments WHERE refunded = 0 GROUP BY user_id
       ) p ON p.user_id = u.id
       GROUP BY u.source
       ORDER BY total DESC`
    )
    .all(nowIso) as unknown as SourceStats[];
}

// ---------------------------------------------------------------------------
// Recordatorios, bloqueos y anuncios
// ---------------------------------------------------------------------------

/** Hora del recordatorio diario (null = desactivado) */
export function setReminderHour(id: number, hour: number | null): void {
  db.prepare("UPDATE users SET reminder_hour = ? WHERE id = ?").run(hour, id);
}

/** Usuarios con recordatorio a esta hora que hoy todavía no han practicado */
export function getUsersToRemind(hour: number, day: string): { id: number; name: string }[] {
  return db
    .prepare(
      `SELECT id, name FROM users
       WHERE reminder_hour = ? AND blocked = 0
         AND NOT EXISTS (SELECT 1 FROM answers WHERE answers.user_id = users.id AND answers.day = ?)`
    )
    .all(hour, day) as { id: number; name: string }[];
}

/** El usuario ha bloqueado al bot: dejamos de escribirle */
export function markBlocked(id: number): void {
  db.prepare("UPDATE users SET blocked = 1 WHERE id = ?").run(id);
}

/** Usuarios a los que se puede enviar un anuncio (no han bloqueado al bot) */
export function listReachableUserIds(): number[] {
  return (db.prepare("SELECT id FROM users WHERE blocked = 0 ORDER BY id").all() as { id: number }[]).map(
    (r) => r.id
  );
}

export function countUsersSeenSince(sinceIso: string): number {
  return (
    db.prepare("SELECT COUNT(*) AS n FROM users WHERE last_seen >= ?").get(sinceIso) as { n: number }
  ).n;
}

export function countBlockedUsers(): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM users WHERE blocked = 1").get() as { n: number }).n;
}

export function countUsersWithReminder(): number {
  return (
    db.prepare("SELECT COUNT(*) AS n FROM users WHERE reminder_hour IS NOT NULL AND blocked = 0").get() as {
      n: number;
    }
  ).n;
}

// ---------------------------------------------------------------------------
// Invitar amigos y preguntas extra
// ---------------------------------------------------------------------------

/** Apunta quién invitó al usuario (solo si no tenía ya a nadie) */
export function setReferrer(id: number, referrerId: number): boolean {
  return (
    db
      .prepare("UPDATE users SET referred_by = ? WHERE id = ? AND referred_by IS NULL AND id != ?")
      .run(referrerId, id, referrerId).changes > 0
  );
}

/** Suma preguntas extra a un usuario */
export function addBonusQuestions(id: number, amount: number): void {
  db.prepare("UPDATE users SET bonus_questions = bonus_questions + ? WHERE id = ?").run(amount, id);
}

/** Gasta una pregunta extra. Devuelve false si no le quedaba ninguna. */
export function consumeBonusQuestion(id: number): boolean {
  return (
    db
      .prepare("UPDATE users SET bonus_questions = bonus_questions - 1 WHERE id = ? AND bonus_questions > 0")
      .run(id).changes > 0
  );
}

/**
 * Marca que ya se ha premiado a quien invitó a este usuario. Devuelve el id de quien
 * le invitó solo la primera vez (así el premio no se da dos veces).
 */
export function claimReferralReward(id: number): number | null {
  const user = getUser(id);
  if (!user?.referred_by || user.referral_rewarded) return null;
  const claimed = db
    .prepare("UPDATE users SET referral_rewarded = 1 WHERE id = ? AND referral_rewarded = 0")
    .run(id).changes;
  return claimed > 0 ? user.referred_by : null;
}

/** Amigos invitados por un usuario y cuántos ya han empezado a practicar */
export function countReferrals(id: number): { joined: number; active: number } {
  return db
    .prepare(
      `SELECT COUNT(*) AS joined, COALESCE(SUM(referral_rewarded), 0) AS active
       FROM users WHERE referred_by = ?`
    )
    .get(id) as { joined: number; active: number };
}
