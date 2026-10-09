// Daily practice time and the streak (DESIGN.md §1, §7.1), ported from
// PlayingChord's goals. One record per local day; the streak is always
// *derived* from the records against the current goal — nothing is stored,
// so a changed goal can never disagree with a cached counter. Pure TS.

export interface DailyRecord {
  date: string // local 'YYYY-MM-DD', also the record's key
  activeMinutes: number
}

export type DailyRecords = Readonly<Record<string, DailyRecord>>

export const DEFAULT_GOAL_MINUTES = 10

export function localDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

// 'YYYY-MM-DD' → local Date at noon. Noon keeps day arithmetic safe on DST
// days (23/25-hour days shift midnight, never noon).
export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1, 12)
}

export function previousDateKey(key: string): string {
  const date = parseDateKey(key)
  date.setDate(date.getDate() - 1)
  return localDateKey(date)
}

export function addActiveMinutes(
  records: DailyRecords,
  dateKey: string,
  minutes: number,
): DailyRecords {
  const activeMinutes = (records[dateKey]?.activeMinutes ?? 0) + minutes
  return { ...records, [dateKey]: { date: dateKey, activeMinutes } }
}

// What is left of today's goal, in minutes; zero once it's met.
export function goalMinutesLeft(
  records: DailyRecords,
  goalMinutes: number,
  todayKey: string,
): number {
  return Math.max(0, goalMinutes - (records[todayKey]?.activeMinutes ?? 0))
}

export function meetsGoal(
  record: DailyRecord | undefined,
  goalMinutes: number,
): boolean {
  return record !== undefined && record.activeMinutes >= goalMinutes
}

// Consecutive local days meeting the goal, ending today. A today that hasn't
// met the goal *yet* doesn't break the chain — the streak counts from
// yesterday until the day is actually over.
export function computeStreak(
  records: DailyRecords,
  goalMinutes: number,
  todayKey: string,
): number {
  let day = meetsGoal(records[todayKey], goalMinutes)
    ? todayKey
    : previousDateKey(todayKey)
  let streak = 0
  while (meetsGoal(records[day], goalMinutes)) {
    streak += 1
    day = previousDateKey(day)
  }
  return streak
}
