// Wall-clock <-> UTC conversion for a salon's IANA timezone, without extra deps.

function offsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - utcMs;
}

/** "2026-11-02T14:30" in `timeZone` -> ISO string in UTC. Returns null if invalid. */
export function zonedLocalToUtcIso(local: string, timeZone: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  // Two passes handle DST transitions.
  let utc = wall - offsetMs(wall, timeZone);
  utc = wall - offsetMs(utc, timeZone);
  return Number.isNaN(utc) ? null : new Date(utc).toISOString();
}

/** UTC ISO -> "YYYY-MM-DDTHH:mm" wall time in `timeZone` (for datetime-local inputs). */
export function utcIsoToZonedLocal(iso: string, timeZone: string): string {
  const utc = new Date(iso).getTime();
  return new Date(utc + offsetMs(utc, timeZone)).toISOString().slice(0, 16);
}
