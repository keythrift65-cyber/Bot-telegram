/**
 * Utilidades de fechas. Todo se guarda en UTC, pero el "día" del límite
 * gratuito empieza a medianoche en Europe/Madrid (teniendo en cuenta el
 * cambio de horario de verano/invierno).
 */

/** Desfase en minutos de una zona horaria respecto a UTC en un instante dado */
function offsetMinutes(timeZone: string, date: Date): number {
  const part = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(date)
    .find((p) => p.type === "timeZoneName")?.value; // ej: "GMT+02:00" o "GMT"

  const match = part?.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

/**
 * Instante (en UTC) en el que empezó el día actual en la zona horaria indicada.
 */
export function startOfTodayIn(timeZone: string, now = new Date()): Date {
  // Fecha (año, mes, día) que marca el reloj en esa zona
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(now)
    .split("-")
    .map(Number);

  const midnightAsUtc = Date.UTC(y, m - 1, d);
  // Primera aproximación con el desfase actual y corrección con el desfase real a medianoche
  let guess = midnightAsUtc - offsetMinutes(timeZone, now) * 60_000;
  guess = midnightAsUtc - offsetMinutes(timeZone, new Date(guess)) * 60_000;
  return new Date(guess);
}

/** Fecha de hace N días */
export function daysAgo(days: number, now = new Date()): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

/** Formatea una fecha en español con la hora de Madrid, ej: "21/10/2026, 18:30" */
export function formatDateEs(iso: string, timeZone = "Europe/Madrid"): string {
  return new Date(iso).toLocaleString("es-ES", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
