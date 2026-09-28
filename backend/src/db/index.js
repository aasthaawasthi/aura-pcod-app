const { db, seedDefaultHabits } = require("./sqlite");
const { toLocalDateStr } = require("../utils/date");
const { recommendHabitsForGoals } = require("../services/habits/habitRecommender");

// ---------- Users ----------
function createUser({ email, passwordHash, name }) {
  const stmt = db.prepare(
    "INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)"
  );
  const info = stmt.run(email, passwordHash, name || null);
  const userId = info.lastInsertRowid;

  db.prepare("INSERT INTO profiles (user_id) VALUES (?)").run(userId);

  seedDefaultHabits(userId);

  return userId;
}

function getUserByEmail(email) {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email);
}

function getUserById(id) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id);
}

// ---------- Profile ----------
// A "profile" for the app's purposes spans two tables: identity fields
// (name, email, phone, profile_picture) live on `users`, health/preference
// fields live on `profiles`. This merges both into one object so the
// client doesn't need to know about the split.
function getUserProfile(userId) {
  const row = db
    .prepare(
      `SELECT p.*, u.name, u.email, u.phone, u.profile_picture
       FROM profiles p JOIN users u ON u.id = p.user_id
       WHERE p.user_id = ?`
    )
    .get(userId);
  if (!row) return null;
  return {
    ...row,
    goals: JSON.parse(row.goals_json || "[]"),
    regions: JSON.parse(row.regions_json || "[]"),
  };
}

function saveUserProfile(userId, fields) {
  const current = getUserProfile(userId);
  // Only apply keys that were actually provided - `{...current, ...fields}`
  // would otherwise let an explicit `undefined` in fields wipe out a real
  // existing value (e.g. omitting has_pcod on a partial update resetting it).
  const definedFields = Object.fromEntries(
    Object.entries(fields).filter(([, v]) => v !== undefined)
  );
  const merged = { ...current, ...definedFields };

  const goals = Array.isArray(definedFields.goals) ? definedFields.goals : current.goals;
  const regions = Array.isArray(definedFields.regions) ? definedFields.regions : current.regions;

  db.prepare(
    `UPDATE profiles SET
      goals_json = ?, food_preference = ?, regions_json = ?, has_pcod = ?,
      profile_type = ?, age = ?, gender = ?, height_cm = ?, weight_kg = ?,
      onboarding_complete = ?, updated_at = datetime('now')
     WHERE user_id = ?`
  ).run(
    JSON.stringify(goals && goals.length ? goals : ["regular_cycle"]),
    merged.food_preference,
    JSON.stringify(regions && regions.length ? regions : ["north"]),
    merged.has_pcod ? 1 : 0,
    merged.profile_type,
    merged.age,
    merged.gender,
    merged.height_cm,
    merged.weight_kg,
    merged.onboarding_complete ? 1 : 0,
    userId
  );

  // Identity fields (name/email/phone/profile_picture) live on `users`.
  const userFields = {};
  if (definedFields.name !== undefined) userFields.name = definedFields.name;
  if (definedFields.email !== undefined) userFields.email = definedFields.email;
  if (definedFields.phone !== undefined) userFields.phone = definedFields.phone;
  if (definedFields.profile_picture !== undefined) userFields.profile_picture = definedFields.profile_picture;
  if (Object.keys(userFields).length > 0) {
    updateUserIdentity(userId, userFields);
  }

  return getUserProfile(userId);
}

function updateUserIdentity(userId, { name, email, phone, profile_picture }) {
  const current = getUserById(userId);
  db.prepare(
    `UPDATE users SET name = ?, email = ?, phone = ?, profile_picture = ? WHERE id = ?`
  ).run(
    name !== undefined ? name : current.name,
    email !== undefined ? email : current.email,
    phone !== undefined ? phone : current.phone,
    profile_picture !== undefined ? profile_picture : current.profile_picture,
    userId
  );
}

function savePhenotypeAnswers(userId, answers) {
  db.prepare(
    `INSERT INTO phenotype_answers (user_id, answers_json) VALUES (?, ?)
     ON CONFLICT(user_id) DO UPDATE SET answers_json = excluded.answers_json`
  ).run(userId, JSON.stringify(answers));
}

// ---------- Daily logs ----------
function upsertDailyLog(userId, { logDate, mood, energy, symptoms, note }) {
  db.prepare(
    `INSERT INTO daily_logs (user_id, log_date, mood, energy, symptoms_json, note)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, log_date) DO UPDATE SET
       mood = excluded.mood,
       energy = excluded.energy,
       symptoms_json = excluded.symptoms_json,
       note = excluded.note`
  ).run(userId, logDate, mood, energy, JSON.stringify(symptoms || []), note || null);
  return getDailyLogByDate(userId, logDate);
}

function getDailyLogByDate(userId, logDate) {
  const row = db
    .prepare("SELECT * FROM daily_logs WHERE user_id = ? AND log_date = ?")
    .get(userId, logDate);
  return row ? deserializeLog(row) : null;
}

function getRecentLogs(userId, limit = 14) {
  const rows = db
    .prepare(
      "SELECT * FROM daily_logs WHERE user_id = ? ORDER BY log_date DESC LIMIT ?"
    )
    .all(userId, limit);
  return rows.map(deserializeLog).reverse(); // oldest -> newest
}

function deserializeLog(row) {
  return { ...row, symptoms: JSON.parse(row.symptoms_json || "[]") };
}

// ---------- Cycles ----------
function logPeriodStart(userId, { periodStart, flow }) {
  const stmt = db.prepare(
    "INSERT INTO cycles (user_id, period_start, flow) VALUES (?, ?, ?)"
  );
  const info = stmt.run(userId, periodStart, flow || "medium");
  return db.prepare("SELECT * FROM cycles WHERE id = ?").get(info.lastInsertRowid);
}

function logPeriodEnd(userId, { cycleId, periodEnd }) {
  db.prepare(
    "UPDATE cycles SET period_end = ? WHERE id = ? AND user_id = ?"
  ).run(periodEnd, cycleId, userId);
  return db.prepare("SELECT * FROM cycles WHERE id = ?").get(cycleId);
}

function getCycles(userId, limit = 12) {
  return db
    .prepare(
      "SELECT * FROM cycles WHERE user_id = ? ORDER BY period_start DESC LIMIT ?"
    )
    .all(userId, limit);
}

// Logs a whole period at once - a start date plus every day the user marked
// as a period day (each with its own flow + color). Creates one `cycles`
// row spanning the marked range (for the prediction engine) and one
// `period_days` row per marked date (for the calendar / per-day detail).
function logPeriodDays(userId, days) {
  if (!Array.isArray(days) || days.length === 0) {
    throw new Error("days must be a non-empty array");
  }
  const sorted = [...days].sort((a, b) => (a.date < b.date ? -1 : 1));
  const periodStart = sorted[0].date;
  const periodEnd = sorted.length > 1 ? sorted[sorted.length - 1].date : null;
  const startFlow = sorted[0].flow || "medium";

  const insertCycle = db.prepare(
    "INSERT INTO cycles (user_id, period_start, period_end, flow) VALUES (?, ?, ?, ?)"
  );
  const upsertDay = db.prepare(
    `INSERT INTO period_days (user_id, cycle_id, log_date, flow, color)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, log_date) DO UPDATE SET
       cycle_id = excluded.cycle_id,
       flow = excluded.flow,
       color = excluded.color`
  );

  const tx = db.transaction((entries) => {
    const info = insertCycle.run(userId, periodStart, periodEnd, startFlow);
    const cycleId = info.lastInsertRowid;
    for (const entry of entries) {
      upsertDay.run(
        userId,
        cycleId,
        entry.date,
        entry.flow || "medium",
        entry.color != null ? entry.color : 5
      );
    }
    return db.prepare("SELECT * FROM cycles WHERE id = ?").get(cycleId);
  });

  return tx(sorted);
}

function getPeriodDaysInRange(userId, startDate, endDate) {
  return db
    .prepare(
      "SELECT log_date, flow, color FROM period_days WHERE user_id = ? AND log_date >= ? AND log_date <= ? ORDER BY log_date"
    )
    .all(userId, startDate, endDate);
}

// ---------- Habits ----------
function getHabits(userId) {
  return db
    .prepare("SELECT * FROM habits WHERE user_id = ? AND active = 1 ORDER BY id")
    .all(userId);
}

// Regenerates the user's habit checklist to match their selected goals.
// Habits that are still recommended stay active (or get reactivated if they
// were previously dropped); habits no longer recommended are deactivated
// rather than deleted, so past logs/streaks for them are preserved. Every
// habit here is system-recommended (there's no "add your own habit" UI
// yet), so it's safe to manage the whole active set this way.
function syncRecommendedHabits(userId, goals) {
  const recommended = recommendHabitsForGoals(goals);
  const recommendedNames = new Set(recommended.map((h) => h.name));

  const existing = db.prepare("SELECT * FROM habits WHERE user_id = ?").all(userId);
  const existingByName = new Map(existing.map((h) => [h.name, h]));

  const insert = db.prepare("INSERT INTO habits (user_id, name, icon, active) VALUES (?, ?, ?, 1)");
  const reactivate = db.prepare("UPDATE habits SET active = 1, icon = ? WHERE id = ?");
  const deactivate = db.prepare("UPDATE habits SET active = 0 WHERE id = ?");

  const tx = db.transaction(() => {
    for (const h of recommended) {
      const existingHabit = existingByName.get(h.name);
      if (!existingHabit) {
        insert.run(userId, h.name, h.icon);
      } else if (!existingHabit.active) {
        reactivate.run(h.icon, existingHabit.id);
      }
    }
    for (const h of existing) {
      if (h.active && !recommendedNames.has(h.name)) {
        deactivate.run(h.id);
      }
    }
  });
  tx();

  return getHabits(userId);
}

function getHabitLogs(userId, limit = 30) {
  return db
    .prepare(
      `SELECT hl.*, h.name as habit_name FROM habit_logs hl
       JOIN habits h ON h.id = hl.habit_id
       WHERE hl.user_id = ? ORDER BY hl.log_date DESC LIMIT ?`
    )
    .all(userId, limit);
}

function setHabitLog(userId, { habitId, logDate, completed }) {
  db.prepare(
    `INSERT INTO habit_logs (habit_id, user_id, log_date, completed)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(habit_id, log_date) DO UPDATE SET completed = excluded.completed`
  ).run(habitId, userId, logDate, completed ? 1 : 0);
}

function getHabitLogsForDate(userId, logDate) {
  return db
    .prepare("SELECT * FROM habit_logs WHERE user_id = ? AND log_date = ?")
    .all(userId, logDate);
}

function getHabitStreak(userId, habitId) {
  const rows = db
    .prepare(
      `SELECT log_date, completed FROM habit_logs
       WHERE user_id = ? AND habit_id = ? AND completed = 1
       ORDER BY log_date DESC`
    )
    .all(userId, habitId);

  let streak = 0;
  let cursor = new Date();
  for (const row of rows) {
    const rowDate = row.log_date;
    const expected = toLocalDateStr(cursor);
    if (rowDate === expected) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

// A "complete day" means every one of the user's active habits was logged
// as done for that date - this is the unit the monthly streak ring counts,
// as distinct from an individual habit's own streak.
function getCompleteDaysInRange(userId, startDate, endDate) {
  const activeHabitCount = db
    .prepare("SELECT COUNT(*) as c FROM habits WHERE user_id = ? AND active = 1")
    .get(userId).c;

  if (activeHabitCount === 0) return [];

  const rows = db
    .prepare(
      `SELECT log_date, COUNT(*) as completedCount
       FROM habit_logs
       WHERE user_id = ? AND completed = 1 AND log_date >= ? AND log_date <= ?
       GROUP BY log_date`
    )
    .all(userId, startDate, endDate);

  return rows
    .filter((r) => r.completedCount >= activeHabitCount)
    .map((r) => r.log_date);
}

function isDayComplete(userId, logDate) {
  const activeHabitCount = db
    .prepare("SELECT COUNT(*) as c FROM habits WHERE user_id = ? AND active = 1")
    .get(userId).c;
  if (activeHabitCount === 0) return false;

  const completedCount = db
    .prepare(
      "SELECT COUNT(*) as c FROM habit_logs WHERE user_id = ? AND log_date = ? AND completed = 1"
    )
    .get(userId, logDate).c;

  return completedCount >= activeHabitCount;
}

// Consecutive complete days ending today (or yesterday, if today isn't
// finished yet - logging in the evening shouldn't zero out the streak).
function getDayStreak(userId, today = new Date()) {
  const toDateStr = (d) => toLocalDateStr(d);
  let cursor = new Date(today);

  if (!isDayComplete(userId, toDateStr(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (isDayComplete(userId, toDateStr(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// Applies several habit-log changes for one date in a single transaction -
// used by the "Save changes" button so a batch of toggles commits atomically
// instead of firing one request per toggle.
function setHabitLogsBatch(userId, logDate, logs) {
  const upsert = db.prepare(
    `INSERT INTO habit_logs (habit_id, user_id, log_date, completed)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(habit_id, log_date) DO UPDATE SET completed = excluded.completed`
  );
  const tx = db.transaction((entries) => {
    for (const entry of entries) {
      upsert.run(entry.habitId, userId, logDate, entry.completed ? 1 : 0);
    }
  });
  tx(logs);
}

// ---------- Diet ----------
function getDietForToday(userId, todayDate) {
  const row = db
    .prepare("SELECT * FROM diets WHERE user_id = ? AND diet_date = ?")
    .get(userId, todayDate);
  return row ? JSON.parse(row.diet_json) : null;
}

function saveDiet(userId, todayDate, diet) {
  db.prepare(
    `INSERT INTO diets (user_id, diet_date, diet_json) VALUES (?, ?, ?)
     ON CONFLICT(user_id, diet_date) DO UPDATE SET diet_json = excluded.diet_json`
  ).run(userId, todayDate, JSON.stringify(diet));
}

// Which dates in a range already have a planned/cached diet - powers the
// diet calendar's dots, same idea as getPeriodDaysInRange for the cycle
// calendar.
function getDietDatesInRange(userId, startDate, endDate) {
  return db
    .prepare(
      "SELECT diet_date FROM diets WHERE user_id = ? AND diet_date >= ? AND diet_date <= ? ORDER BY diet_date"
    )
    .all(userId, startDate, endDate)
    .map((r) => r.diet_date);
}

module.exports = {
  createUser,
  getUserByEmail,
  getUserById,
  getUserProfile,
  saveUserProfile,
  savePhenotypeAnswers,
  upsertDailyLog,
  getDailyLogByDate,
  getRecentLogs,
  logPeriodStart,
  logPeriodEnd,
  getCycles,
  logPeriodDays,
  getPeriodDaysInRange,
  getHabits,
  syncRecommendedHabits,
  getHabitLogs,
  setHabitLog,
  getHabitLogsForDate,
  getHabitStreak,
  getCompleteDaysInRange,
  isDayComplete,
  getDayStreak,
  setHabitLogsBatch,
  getDietForToday,
  saveDiet,
  getDietDatesInRange,
};
