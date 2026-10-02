const db = require("../db");
const { toLocalDateStr } = require("../utils/date");

exports.createDailyLog = async (req, res) => {
  try {
    const { logDate, mood, energy, symptoms, note } = req.body;
    const date = logDate || toLocalDateStr();

    const log = db.upsertDailyLog(req.user.id, {
      logDate: date,
      mood,
      energy,
      symptoms,
      note,
    });

    res.json({ success: true, data: log });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Could not save check-in" });
  }
};

exports.getRecentLogs = async (req, res) => {
  try {
    // Default to a large window so the check-in trend chart can show a
    // user's full history, not just the last couple of weeks. A client
    // can still ask for a smaller slice via ?limit=.
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 400;
    const logs = db.getRecentLogs(req.user.id, limit);
    res.json({ success: true, data: logs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Could not load logs" });
  }
};

exports.getTodayLog = async (req, res) => {
  try {
    const today = toLocalDateStr();
    const log = db.getDailyLogByDate(req.user.id, today);
    res.json({ success: true, data: log });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Could not load today's check-in" });
  }
};
