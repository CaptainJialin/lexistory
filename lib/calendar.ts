/** Calendar dates follow the learner's device timezone, including across DST. */
export function localDateKey(now: number = Date.now()): string {
  const date = new Date(now);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function calendarDayDistance(from: string, to: string): number {
  const ordinal = (key: string) => {
    const [year, month, day] = key.split("-").map(Number);
    return Date.UTC(year, month - 1, day) / 86400000;
  };
  return ordinal(to) - ordinal(from);
}
