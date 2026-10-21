import { db } from "./database";

export interface User {
  id: number;
  name: string;
  created_at: string;
  subscription_end: string | null;
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
