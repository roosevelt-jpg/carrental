export function startOfDayUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function parseDateOnly(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new Error(`Invalid date: ${value}`);
  }
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

export function daysBetween(start: Date, end: Date): number {
  const ms = startOfDayUtc(end).getTime() - startOfDayUtc(start).getTime();
  const days = Math.round(ms / (24 * 60 * 60 * 1000));
  if (days <= 0) {
    throw new Error("end_date must be after start_date");
  }
  return days;
}

export function rangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function toDateString(date: Date): string {
  return startOfDayUtc(date).toISOString().slice(0, 10);
}
