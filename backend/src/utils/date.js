// Local calendar-day helpers.
//
// Date#toISOString() always renders in UTC. For a user in IST (UTC+5:30),
// that means `new Date().toISOString().slice(0, 10)` still reports
// YESTERDAY's date for the first ~5.5 hours after local midnight - which is
// exactly why habit logging, check-ins, and diet-for-today were staying on
// the previous day until well past midnight. These helpers read the Date
// object's own local getters instead, so "today" always matches the
// calendar day on the device/server's actual clock.

function pad(n) {
  return String(n).padStart(2, "0");
}

// The local (not UTC) calendar date, as YYYY-MM-DD.
function toLocalDateStr(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Adds `days` to a YYYY-MM-DD date string and returns a YYYY-MM-DD string.
// Done entirely in UTC so the result never depends on the server's
// timezone - a bare date string has no timezone of its own, so this must
// not be mixed with local Date methods (that's what caused the bug above).
function addDaysToDateStr(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

module.exports = { toLocalDateStr, addDaysToDateStr };
