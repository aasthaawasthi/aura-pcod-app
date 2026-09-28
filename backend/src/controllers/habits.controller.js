const db = require("../db");
const { toLocalDateStr } = require("../utils/date");

// Returns the habit checklist for a given date (defaults to today) - the
// `date` query param lets the app show a past day's record for reference.
// `editable` tells the client whether this date's completion state can be
// changed (only ever true for today - see the guards in logHabit and
// saveHabitLogsBatch below, which are the real enforcement).
exports.getHabits = async (req, res) => {
  try {
    const today = toLocalDateStr();
    const date = req.query.date || today;
    const habits = db.getHabits(req.user.id);
    const logsForDate = db.getHabitLogsForDate(req.user.id, date);
    const logMap = new Map(logsForDate.map((l) => [l.habit_id, l.completed]));

    const data = habits.map((h) => ({
      id: h.id,
      name: h.name,
      icon: h.icon,
      done: !!logMap.get(h.id),
      streak: db.getHabitStreak(req.user.id, h.id),
    }));

    res.json({ success: true, data, date, editable: date === today });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Could not load habits" });
  }
};

exports.logHabit = async (req, res) => {
  try {
    const { habitId, completed, logDate } = req.body;
    if (!habitId) {
      return res.status(400).json({ success: false, message: "habitId is required" });
    }
    const today = toLocalDateStr();
    const date = logDate || today;
    // Habits can only be logged for today - editing a past day's checklist
    // after the fact would quietly rewrite history.
    if (date !== today) {
      return res.status(400).json({ success: false, message: "You can only log habits for today." });
    }
    db.setHabitLog(req.user.id, { habitId, logDate: date, completed: !!completed });
    const streak = db.getHabitStreak(req.user.id, habitId);
    res.json({ success: true, data: { habitId, completed: !!completed, streak } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Could not update habit" });
  }
};

// Saves every habit's completed/not-completed state for one date in a
// single request - backs the "Save changes" button so toggling several
// habits doesn't fire a request per tap.
exports.saveHabitLogsBatch = async (req, res) => {
  try {
    const { logDate, logs } = req.body;
    if (!Array.isArray(logs) || logs.length === 0) {
      return res.status(400).json({ success: false, message: "logs must be a non-empty array" });
    }
    const today = toLocalDateStr();
    const date = logDate || today;
    // Habits can only be logged for today - editing a past day's checklist
    // after the fact would quietly rewrite history.
    if (date !== today) {
      return res.status(400).json({ success: false, message: "You can only log habits for today." });
    }
    db.setHabitLogsBatch(req.user.id, date, logs);
    res.json({ success: true, data: { logDate: date, saved: logs.length } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Could not save habit changes" });
  }
};

// Powers the monthly streak ring: which days this month had every habit
// completed, plus the current day-streak (consecutive fully-completed days).
exports.getCalendar = async (req, res) => {
  try {
    const now = new Date();
    const year = parseInt(req.query.year, 10) || now.getFullYear();
    const month = parseInt(req.query.month, 10) || now.getMonth() + 1; // 1-12

    const daysInMonth = new Date(year, month, 0).getDate();
    const pad = (n) => String(n).padStart(2, "0");
    const startDate = `${year}-${pad(month)}-01`;
    const endDate = `${year}-${pad(month)}-${pad(daysInMonth)}`;

    const completeDates = db.getCompleteDaysInRange(req.user.id, startDate, endDate);
    const completedDays = completeDates.map((d) => parseInt(d.slice(8, 10), 10));

    const todayStr = toLocalDateStr(now);
    const todayCompleted = db.isDayComplete(req.user.id, todayStr);
    const streak = db.getDayStreak(req.user.id, now);

    res.json({
      success: true,
      data: { year, month, daysInMonth, completedDays, streak, todayCompleted },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Could not load habit calendar" });
  }
};
