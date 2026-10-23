import { getAnsweredDays } from "../db/answers";
import { dayNumber, madridDay } from "./time";

export interface Streak {
  /** Días seguidos practicando hasta hoy (o hasta ayer, si hoy aún no ha practicado) */
  current: number;
  /** Mejor racha de su historia */
  best: number;
  /** Si ya ha respondido alguna pregunta hoy */
  practicedToday: boolean;
}

/**
 * Calcula la racha a partir de los días con respuestas ("AAAA-MM-DD", del más reciente
 * al más antiguo). La racha sigue viva si el último día con respuestas es hoy o ayer.
 */
export function computeStreak(daysDesc: string[], today: string): Streak {
  if (daysDesc.length === 0) return { current: 0, best: 0, practicedToday: false };

  const numbers = daysDesc.map(dayNumber);
  const todayNumber = dayNumber(today);

  let best = 1;
  let run = 1;
  for (let i = 1; i < numbers.length; i++) {
    run = numbers[i - 1] - numbers[i] === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }

  let current = 0;
  if (todayNumber - numbers[0] <= 1) {
    current = 1;
    while (current < numbers.length && numbers[current - 1] - numbers[current] === 1) current++;
  }

  return { current, best, practicedToday: numbers[0] === todayNumber };
}

/** Racha del usuario */
export function getStreak(userId: number): Streak {
  return computeStreak(getAnsweredDays(userId), madridDay());
}

/** Texto corto de la racha, ej: "🔥 Racha: 5 días" */
export function streakLine(streak: Streak): string | null {
  if (streak.current === 0) return null;
  return `🔥 Racha: <b>${streak.current} ${streak.current === 1 ? "día" : "días"}</b>`;
}
