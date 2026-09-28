const db = require("../db");
const { analyzeCycles } = require("../services/cycle/cycleEngine");
const { toLocalDateStr } = require("../utils/date");

exports.getCycleInfo = async (req, res) => {
  try {
    const cycles = db.getCycles(req.user.id);
    const info = analyzeCycles(cycles);
    res.json({ success: true, data: info });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Could not load cycle info" });
  }
};

exports.startPeriod = async (req, res) => {
  try {
    const { periodStart, flow } = req.body;
    if (!periodStart) {
      return res.status(400).json({ success: false, message: "periodStart is required (YYYY-MM-DD)" });
    }
    const cycle = db.logPeriodStart(req.user.id, { periodStart, flow });
    res.json({ success: true, data: cycle });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Could not log period" });
  }
};

exports.endPeriod = async (req, res) => {
  try {
    const { cycleId, periodEnd } = req.body;
    if (!cycleId || !periodEnd) {
      return res.status(400).json({ success: false, message: "cycleId and periodEnd are required" });
    }
    const cycle = db.logPeriodEnd(req.user.id, { cycleId, periodEnd });
    res.json({ success: true, data: cycle });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Could not update period" });
  }
};

// Logs a full period in one go: every day the user marked on the calendar,
// each with its own flow and color (0 dark brown .. 5 bright red).
exports.logPeriodDays = async (req, res) => {
  try {
    const { days } = req.body;
    if (!Array.isArray(days) || days.length === 0) {
      return res.status(400).json({ success: false, message: "days must be a non-empty array" });
    }
    const todayStr = toLocalDateStr();
    for (const d of days) {
      if (!d.date) {
        return res.status(400).json({ success: false, message: "Every day needs a date" });
      }
      // A period can't start in the future - this is what was producing
      // negative cycle-day numbers when a test/typo date landed after today.
      if (d.date > todayStr) {
        return res.status(400).json({
          success: false,
          message: "Period days can't be in the future. Pick a date up to today.",
        });
      }
    }
    const cycle = db.logPeriodDays(req.user.id, days);
    res.json({ success: true, data: cycle });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Could not save this period" });
  }
};

// Powers the calendar: which days in a given month were already logged as
// period days, with their flow + color, so past periods stay visible.
exports.getPeriodDays = async (req, res) => {
  try {
    const now = new Date();
    const year = parseInt(req.query.year, 10) || now.getFullYear();
    const month = parseInt(req.query.month, 10) || now.getMonth() + 1; // 1-12

    const daysInMonth = new Date(year, month, 0).getDate();
    const pad = (n) => String(n).padStart(2, "0");
    const startDate = `${year}-${pad(month)}-01`;
    const endDate = `${year}-${pad(month)}-${pad(daysInMonth)}`;

    const days = db.getPeriodDaysInRange(req.user.id, startDate, endDate);
    res.json({ success: true, data: days });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Could not load period days" });
  }
};
