const { db, seedDefaultHabits } = require("./sqlite");
const { toLocalDateStr, addDaysToDateStr } = require("../utils/date");
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

function getUserByPhone(phone) {
  return db.prepare("SELECT * FROM users WHERE phone = ?").get(phone);
}

// Phone+OTP signup: a user "registers" the first time they successfully
// verify an OTP for a phone number that isn't already on an account -
// there's no separate signup step, so this just creates a bare row (no
// name/email yet) plus the same default profile/habits a normal signup gets.
function createUserByPhone(phone) {
  const info = db.prepare("INSERT INTO users (phone) VALUES (?)").run(phone);
  const userId = info.lastInsertRowid;

  db.prepare("INSERT INTO profiles (user_id) VALUES (?)").run(userId);
  seedDefaultHabits(userId);

  return userId;
}

function setUserOtp(userId, otpCode, expiresAt) {
  db.prepare("UPDATE users SET otp_code = ?, otp_expires_at = ? WHERE id = ?").run(
    otpCode,
    expiresAt,
    userId
  );
}

function clearUserOtp(userId) {
  db.prepare("UPDATE users SET otp_code = NULL, otp_expires_at = NULL WHERE id = ?").run(userId);
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
// A field left `undefined` here means "the client didn't touch this field
// this save" and must NOT overwrite whatever's already stored for that
// day - only a field that's actually present (including an explicit
// `null`/empty value, meaning "clear it") gets written. This is what lets
// someone add just today's energy level later in the day without wiping
// the mood/symptoms/note they already logged that morning. The merge is
// resolved here in JS (against any existing row) before anything touches
// SQL, so there's no ambiguity between "untouched" and "explicitly
// cleared" the way relying on SQL NULL/COALESCE would have.
function upsertDailyLog(userId, { logDate, mood, energy, symptoms, note }) {
  const existing = getDailyLogByDate(userId, logDate);

  const finalMood = mood !== undefined ? mood : existing ? existing.mood : null;
  const finalEnergy = energy !== undefined ? energy : existing ? existing.energy : null;
  const finalSymptoms = symptoms !== undefined ? symptoms : existing ? existing.symptoms : [];
  const finalNote = note !== undefined ? note : existing ? existing.note : null;

  db.prepare(
    `INSERT INTO daily_logs (user_id, log_date, mood, energy, symptoms_json, note)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, log_date) DO UPDATE SET
       mood = excluded.mood,
       energy = excluded.energy,
       symptoms_json = excluded.symptoms_json,
       note = excluded.note`
  ).run(userId, logDate, finalMood, finalEnergy, JSON.stringify(finalSymptoms || []), finalNote || null);
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

// How far back a streak can possibly reach before we stop counting - caps
// the work below to one bounded query no matter how long someone's been
// using the app, instead of walking backward one day (and one DB round
// trip) at a time with no floor. A streak longer than this is vanishingly
// unlikely to matter to anyone, and the ring/UI never shows more than this
// anyway.
const MAX_STREAK_LOOKBACK_DAYS = 400;

// Consecutive complete days ending today (or yesterday, if today isn't
// finished yet - logging in the evening shouldn't zero out the streak).
//
// Previously this walked backward one calendar day at a time, running two
// fresh SQL queries per day via isDayComplete() with no lower bound - for
// an account with a long history that meant hundreds of synchronous
// round trips (and statement re-prepares) on every page load, which is
// exactly the kind of thing that makes a request crawl and trips the
// client's 20s timeout. Fetching one bounded window of "which dates had
// every habit done" up front and then just walking an in-memory Set is
// the same result with a single query.
function getDayStreak(userId, today = new Date()) {
  const activeHabitCount = db
    .prepare("SELECT COUNT(*) as c FROM habits WHERE user_id = ? AND active = 1")
    .get(userId).c;
  if (activeHabitCount === 0) return 0;

  const todayStr = toLocalDateStr(today);
  const lookbackStart = addDaysToDateStr(todayStr, -MAX_STREAK_LOOKBACK_DAYS);

  const rows = db
    .prepare(
      `SELECT log_date, COUNT(*) as completedCount
       FROM habit_logs
       WHERE user_id = ? AND completed = 1 AND log_date >= ? AND log_date <= ?
       GROUP BY log_date`
    )
    .all(userId, lookbackStart, todayStr);

  const completeDates = new Set(
    rows.filter((r) => r.completedCount >= activeHabitCount).map((r) => r.log_date)
  );

  const toDateStr = (d) => toLocalDateStr(d);
  let cursor = new Date(today);

  if (!completeDates.has(toDateStr(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (completeDates.has(toDateStr(cursor))) {
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

// Wipes cached diets from a date onward (today and any future planned
// days) - called whenever food_preference/regions/goals change, so the
// next fetch regenerates a diet that reflects the new preferences instead
// of silently reusing a stale cached one. Past days are left alone since
// they reflect what was actually planned/eaten under the old preferences.
function clearDietsFrom(userId, fromDate) {
  db.prepare("DELETE FROM diets WHERE user_id = ? AND diet_date >= ?").run(userId, fromDate);
}

// ---------- Account export & deletion ----------

// Same 0-5 dark-brown-to-bright-red scale the cycle calendar's color
// picker and legend use (mobile/lib/theme.ts's periodColorScale /
// periodColorLabels) - mirrored here so the export shows the same words
// the user picked on screen instead of the raw number underneath them.
const PERIOD_COLOR_LABELS = ["Dark brown", "Brown", "Rust", "Red-brown", "Red", "Bright red"];

// Every table a user's PERSONAL data lives in, unbounded (no 14/30-day
// limits like the normal app screens use) - this is specifically for the
// "download everything" export, so it has to be the full history, not a
// recent window. profile_picture is deliberately left out: it's a large
// base64 blob, not something that belongs in a CSV, and not the kind of
// thing someone downloading "my health data" is after.
//
// Deliberately does NOT include habits, habit_logs, or diets: those are
// this app's own recommendation output (which habits it suggested, what
// meals it planned), not something the user typed in - the export is for
// the user's own entered data, not a copy of the product's logic/output.
function getAllUserDataForExport(userId) {
  const user = getUserById(userId);
  if (!user) return null;

  const profile = getUserProfile(userId);

  const dailyLogs = db
    .prepare(
      `SELECT log_date, mood, energy, symptoms_json, note, created_at
       FROM daily_logs WHERE user_id = ? ORDER BY log_date`
    )
    .all(userId)
    .map((r) => ({
      log_date: r.log_date,
      mood: r.mood,
      energy: r.energy,
      symptoms: JSON.parse(r.symptoms_json || "[]").join("; "),
      note: r.note,
      created_at: r.created_at,
    }));

  const cycles = db
    .prepare(
      `SELECT id, period_start, period_end, flow, created_at
       FROM cycles WHERE user_id = ? ORDER BY period_start`
    )
    .all(userId);

  const periodDays = db
    .prepare(
      `SELECT log_date, cycle_id, flow, color
       FROM period_days WHERE user_id = ? ORDER BY log_date`
    )
    .all(userId)
    .map((r) => ({
      log_date: r.log_date,
      cycle_id: r.cycle_id,
      flow: r.flow,
      color: PERIOD_COLOR_LABELS[r.color] || r.color,
    }));

  return {
    account: {
      name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",
      created_at: user.created_at,
    },
    profile: profile
      ? {
          goals: (profile.goals || []).join("; "),
          food_preference: profile.food_preference,
          regions: (profile.regions || []).join("; "),
          has_pcod: profile.has_pcod,
          profile_type: profile.profile_type,
          age: profile.age,
          gender: profile.gender,
          height_cm: profile.height_cm,
          weight_kg: profile.weight_kg,
        }
      : null,
    dailyLogs,
    cycles,
    periodDays,
  };
}

// Deletes the account and everything tied to it, and records why in the
// same breath. Every child table (profiles, daily_logs, cycles,
// period_days, habits -> habit_logs, diets) cascades off `users` via
// ON DELETE CASCADE, so the single DELETE below is enough - see
// db/sqlite.js's schema and its `foreign_keys = ON` pragma.
//
// Both writes happen in one transaction: the feedback row and the account
// deletion either both commit or neither does, so there's never a moment
// where feedback exists for an account that's still there, or an account
// vanishes with no record of why. Idempotent by construction - if the
// user's already gone (e.g. a client retry after a dropped response),
// this is a no-op that reports alreadyGone instead of erroring.
function hardDeleteUserAccount(userId, feedback = {}) {
  const user = getUserById(userId);
  if (!user) return { deleted: false, alreadyGone: true };

  const insertFeedback = db.prepare(
    `INSERT INTO deletion_feedback (reason_code, note, account_age_days, app_version)
     VALUES (?, ?, ?, ?)`
  );
  const deleteUser = db.prepare("DELETE FROM users WHERE id = ?");

  const tx = db.transaction(() => {
    insertFeedback.run(
      feedback.reasonCode || "not_specified",
      feedback.note || null,
      feedback.accountAgeDays ?? null,
      feedback.appVersion || null
    );
    deleteUser.run(userId);
  });
  tx();

  return { deleted: true, alreadyGone: false };
}

module.exports = {
  createUser,
  getUserByEmail,
  getUserById,
  getUserByPhone,
  createUserByPhone,
  setUserOtp,
  clearUserOtp,
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
  clearDietsFrom,
  getAllUserDataForExport,
  hardDeleteUserAccount,
};
