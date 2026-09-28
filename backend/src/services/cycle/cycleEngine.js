// Cycle Intelligence engine.
//
// PCOD cycles are frequently irregular, so this deliberately avoids naive
// "average of last N cycles" calendar math, which breaks down hard once
// cycle length varies by 10-20+ days. Instead:
//  - uses the MEDIAN cycle length (robust to one-off outliers)
//  - reports a confidence level based on how much cycle lengths vary
//  - never claims certainty about ovulation - PCOD often means anovulatory
//    cycles, so "fertile window" is shown as a wide estimate, not a promise
//  - flags patterns worth raising with a doctor, without diagnosing anything

const { toLocalDateStr, addDaysToDateStr } = require("../../utils/date");

const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(dateA, dateB) {
  return Math.round((new Date(dateB) - new Date(dateA)) / DAY_MS);
}

function median(numbers) {
  if (numbers.length === 0) return null;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function stdDev(numbers) {
  if (numbers.length < 2) return 0;
  const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
  const variance =
    numbers.reduce((acc, n) => acc + (n - mean) ** 2, 0) / numbers.length;
  return Math.sqrt(variance);
}

// cycles: array of { period_start, period_end } sorted DESC (most recent first)
function analyzeCycles(cycles, today = new Date()) {
  if (!cycles || cycles.length === 0) {
    return {
      hasData: false,
      message: "Log your period start date to unlock cycle predictions.",
    };
  }

  const todayStr = toLocalDateStr(today);

  // A period start in the future is bad data (a mis-tapped date, a test
  // entry, a clock issue) - it should never be used as "today's" reference
  // point, since that produces a negative cycle day. Ignore anything after
  // today when picking the current cycle; log-days already rejects these
  // going forward, but this keeps the math safe against old/bad rows too.
  const validCycles = cycles.filter((c) => c.period_start <= todayStr);
  if (validCycles.length === 0) {
    return {
      hasData: false,
      message: "Log your period start date to unlock cycle predictions.",
    };
  }

  const startsAsc = [...validCycles]
    .map((c) => c.period_start)
    .sort((a, b) => new Date(a) - new Date(b));

  // Gaps of 0 (duplicate/same-day logs) or under ~10 days aren't a real
  // cycle length - they're almost always a data entry slip, not an actual
  // 0-10 day cycle. Excluding them keeps the median honest.
  const rawLengths = [];
  for (let i = 1; i < startsAsc.length; i++) {
    rawLengths.push(daysBetween(startsAsc[i - 1], startsAsc[i]));
  }
  const lengths = rawLengths.filter((l) => l >= 10);

  const lastPeriodStart = startsAsc[startsAsc.length - 1];
  // Clamped to at least 1 - a valid period start is never later than today
  // (guaranteed above), but this keeps the number safe against clock-skew
  // edge cases too. A cycle day of 0 or negative should never be shown.
  const cycleDay = Math.max(1, daysBetween(lastPeriodStart, today) + 1);

  const DEFAULT_CYCLE_LENGTH = 28; // typical gap between periods, used only
  // as a starting estimate until we have real history to go on.

  // Not enough (reliable) history yet - still give a rough next-period
  // estimate based on a typical cycle, but make clear it's not personalized
  // yet. This must never equal lastPeriodStart itself.
  if (lengths.length === 0) {
    return {
      hasData: true,
      cycleDay,
      lastPeriodStart,
      avgCycleLength: null,
      predictedNextPeriod: addDays(lastPeriodStart, DEFAULT_CYCLE_LENGTH),
      confidence: "low",
      irregular: null,
      phase: phaseFromDay(cycleDay, null),
      note: "This first estimate assumes a typical 28-day cycle. Log one more period start date for a prediction based on your own history.",
    };
  }

  const cycleLength = median(lengths);
  const variability = stdDev(lengths);
  const predictedNextPeriod = addDays(lastPeriodStart, cycleLength);

  // Regularity heuristic: PCOD-aware, not a diagnosis.
  // Cycles are considered irregular if length varies a lot cycle-to-cycle,
  // or if any recent cycle is very long/short.
  const recentLengths = lengths.slice(-6);
  const outOfRange = recentLengths.some((l) => l < 21 || l > 35);
  const irregular = variability > 7 || outOfRange;

  const confidence =
    lengths.length >= 4 && variability <= 5
      ? "high"
      : lengths.length >= 2
      ? "medium"
      : "low";

  return {
    hasData: true,
    cycleDay,
    lastPeriodStart,
    avgCycleLength: cycleLength,
    cycleLengthVariability: Math.round(variability * 10) / 10,
    predictedNextPeriod,
    confidence,
    irregular,
    phase: phaseFromDay(cycleDay, cycleLength),
    flag: buildFlag({ irregular, recentLengths, variability }),
  };
}

function phaseFromDay(cycleDay, cycleLength) {
  const length = cycleLength || 28;
  if (cycleDay <= 5) return "menstrual";
  if (cycleDay <= Math.round(length * 0.45)) return "follicular";
  if (cycleDay <= Math.round(length * 0.6)) return "fertile_window_estimate";
  return "luteal";
}

function buildFlag({ irregular, recentLengths, variability }) {
  if (!irregular) return null;
  const veryLong = recentLengths.some((l) => l > 45);
  if (veryLong) {
    return {
      level: "notice",
      message:
        "A few of your recent cycles have been quite long. This is common with PCOD, but it's worth mentioning to a gynecologist if it continues.",
    };
  }
  return {
    level: "info",
    message:
      "Your cycle length has been varying a fair amount, so predictions here are estimates, not guarantees.",
  };
}

function addDays(dateStr, days) {
  return addDaysToDateStr(dateStr, days);
}

module.exports = { analyzeCycles };
