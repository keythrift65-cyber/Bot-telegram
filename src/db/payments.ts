import { db } from "./database";

export interface Payment {
  id: number;
  user_id: number;
  telegram_payment_charge_id: string;
  stars: number;
  paid_at: string;
  expires_at: string;
  is_recurring: number;
  refunded: number;
}

/**
 * Guarda un pago. Si el charge_id ya existe (Telegram reenvía el mismo pago),
 * no se duplica y devuelve false.
 */
export function savePayment(p: {
  userId: number;
  chargeId: string;
  stars: number;
  expiresAt: string;
  isRecurring: boolean;
}): boolean {
  const result = db
    .prepare(
      `INSERT OR IGNORE INTO payments
         (user_id, telegram_payment_charge_id, stars, paid_at, expires_at, is_recurring)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(p.userId, p.chargeId, p.stars, new Date().toISOString(), p.expiresAt, p.isRecurring ? 1 : 0);
  return result.changes > 0;
}

export function getPayment(userId: number, chargeId: string): Payment | undefined {
  return db
    .prepare("SELECT * FROM payments WHERE user_id = ? AND telegram_payment_charge_id = ?")
    .get(userId, chargeId) as Payment | undefined;
}

export function markRefunded(chargeId: string): void {
  db.prepare("UPDATE payments SET refunded = 1 WHERE telegram_payment_charge_id = ?").run(chargeId);
}

/** Estrellas ganadas en total (sin contar los pagos reembolsados) */
export function totalStarsEarned(): number {
  return (
    db.prepare("SELECT COALESCE(SUM(stars), 0) AS n FROM payments WHERE refunded = 0").get() as {
      n: number;
    }
  ).n;
}
