// Local calendar-day helpers - mirrors backend/src/utils/date.js.
//
// Date#toISOString() always renders in UTC. For a user in IST (UTC+5:30),
// `new Date().toISOString().slice(0, 10)` still reports YESTERDAY's date
// for the first ~5.5 hours after local midnight, which is why habit
// logging and the cycle calendar could lag a full day behind the phone's
// actual clock. These read the Date object's own local getters instead.

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// The local (not UTC) calendar date, as YYYY-MM-DD.
export function todayLocalStr(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Adds `days` to a YYYY-MM-DD date string and returns a YYYY-MM-DD string.
// Done entirely in UTC so the result never depends on the device's
// timezone - a bare date string has no timezone of its own, so this must
// not be mixed with local Date methods (that's what caused the bug above).
export function addDaysToDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}
