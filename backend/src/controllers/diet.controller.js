const { generateDiet } = require("../services/diet/dietEngine");
const { nextAlternative } = require("../services/diet/rules/alternates");
const db = require("../db");
const { toLocalDateStr, addDaysToDateStr } = require("../utils/date");

async function getTodayDiet(req, res) {
  try {
    const userId = req.user.id;
    const today = toLocalDateStr();

    const existing = db.getDietForToday(userId, today);
    if (existing) {
      return res.json({ success: true, data: existing });
    }

    const userProfile = db.getUserProfile(userId);
    const dailyLogs = db.getRecentLogs(userId, 14);
    const habitLogs = db.getHabitLogs(userId, 30);

    const diet = await generateDiet({ userProfile, dailyLogs, habitLogs, forDate: today });

    db.saveDiet(userId, today, diet);

    return res.json({ success: true, data: diet });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Could not generate diet" });
  }
}

// Get-or-generate a PLANNED diet for a given date - no daily-log/habit-log
// personalization (that data doesn't exist for future dates), just
// profile + goals. Deterministic for a given date, so it's safe to cache
// and reuse for grocery planning.
async function getOrGeneratePlannedDiet(userId, date, userProfile) {
  const existing = db.getDietForToday(userId, date);
  if (existing) return existing;
  const diet = await generateDiet({ userProfile, forDate: date });
  db.saveDiet(userId, date, diet);
  return diet;
}

// GET /diet?date=YYYY-MM-DD - a single day's plate (defaults to today).
async function getDietForDate(req, res) {
  try {
    const userId = req.user.id;
    const date = req.query.date || toLocalDateStr();
    const userProfile = db.getUserProfile(userId);
    const diet = await getOrGeneratePlannedDiet(userId, date, userProfile);
    res.json({ success: true, data: diet, date });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Could not load diet for this date" });
  }
}

// GET /diet/week?start=YYYY-MM-DD - 7 days from `start` (defaults to
// today), so the user can see the whole week's plate at once and buy
// groceries for it in advance.
async function getDietWeek(req, res) {
  try {
    const userId = req.user.id;
    const start = req.query.start || toLocalDateStr();
    const userProfile = db.getUserProfile(userId);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = addDaysToDateStr(start, i);
      const diet = await getOrGeneratePlannedDiet(userId, date, userProfile);
      days.push({ date, ...diet });
    }

    res.json({ success: true, data: days });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Could not load this week's plate" });
  }
}

// GET /diet/month?year=&month= - powers a month calendar view like the
// cycle page's summary calendar, one plate per day of the month.
//
// Days before the account was created have no history to show (the user
// wasn't on the app yet), so they're returned as empty entries instead
// of generating/caching a speculative plan for them - keeps the history
// honest and avoids wasted writes for dates nobody will ever look at.
async function getDietMonth(req, res) {
  try {
    const userId = req.user.id;
    const now = new Date();
    const year = parseInt(req.query.year, 10) || now.getFullYear();
    const month = parseInt(req.query.month, 10) || now.getMonth() + 1;

    const daysInMonth = new Date(year, month, 0).getDate();
    const pad = (n) => String(n).padStart(2, "0");
    const userProfile = db.getUserProfile(userId);
    const user = db.getUserById(userId);
    const joinedDate = user && user.created_at ? String(user.created_at).slice(0, 10) : null;

    const days = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${year}-${pad(month)}-${pad(d)}`;
      if (joinedDate && date < joinedDate) {
        days.push({ date, breakfast: null, lunch: null, snack: null, dinner: null });
        continue;
      }
      const diet = await getOrGeneratePlannedDiet(userId, date, userProfile);
      days.push({ date, ...diet });
    }

    res.json({ success: true, data: { year, month, daysInMonth, days, joinedDate } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Could not load this month's plate" });
  }
}

// POST /diet/swap { date, meal } - "I don't like this, suggest something
// else" for one meal slot on one date. Cycles to the next alternative in
// the pool and persists the swap so it survives a reload.
async function swapDietItem(req, res) {
  try {
    const userId = req.user.id;
    const { date, meal } = req.body;
    const VALID_MEALS = ["breakfast", "lunch", "snack", "dinner"];
    if (!date || !VALID_MEALS.includes(meal)) {
      return res.status(400).json({ success: false, message: "date and a valid meal are required" });
    }

    const userProfile = db.getUserProfile(userId);
    const diet = await getOrGeneratePlannedDiet(userId, date, userProfile);

    const updated = { ...diet, [meal]: nextAlternative(userProfile.food_preference, meal, diet[meal]) };
    db.saveDiet(userId, date, updated);

    res.json({ success: true, data: updated, date });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Could not swap this item" });
  }
}

module.exports = { getTodayDiet, getDietForDate, getDietWeek, getDietMonth, swapDietItem };
