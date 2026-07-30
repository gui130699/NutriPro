/**
 * Produces a calendar date for the user's local time zone rather than a UTC
 * date. This is the format persisted in date-only Firestore fields.
 */
export function localIsoDate(date = new Date()): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error('Informe uma data válida.')
  }

  const offsetMs = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 10)
}

/** Validates a YYYY-MM-DD calendar date without relying on the local parser. */
export function isLocalIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

/** Compares date-only ISO strings in calendar order. */
export function compareLocalIsoDates(left: string, right: string): number {
  if (!isLocalIsoDate(left) || !isLocalIsoDate(right)) {
    throw new Error('As datas devem estar no formato AAAA-MM-DD.')
  }

  return left.localeCompare(right)
}
