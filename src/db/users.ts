import { db } from "./database";

export interface User {
  id: number;
  name: string;
  created_at: string;
  subscription_end: string | null;
  source: string | null;
}

/**
 * Crea el usuario si no existe o actualiza su nombre si ya existe.
 */
export function upsertUser(id: number, name: string): void {
  db.prepare(
    `INSERT INTO users (id, name, created_at) VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name`
  ).run(id, name, new Date().toISOString());
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
