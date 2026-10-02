// Standalone test for the check-in (daily log) save/merge logic - no test
// framework required, just run:
//
//   cd backend && node scripts/test-daily-log.js
//
// It runs against a throwaway SQLite file (deleted when the script
// finishes), never your real data.sqlite, so it's safe to run any time.
//
// What it covers (the bugs reported against the check-in page):
//  1. First save of the day writes exactly what was sent.
//  2. Saving ONLY energy later the same day does not erase the mood/
//     symptoms/note saved earlier that day.
//  3. Saving ONLY a note does not erase mood/energy/symptoms.
//  4. Explicitly clearing a field (e.g. deselecting mood) DOES clear it,
//     and nothing else.
//  5. Two different users' check-ins for the same date never collide.
//  6. Two different dates for the same user never bleed into each other.
//  7. Reading history (getRecentLogs) returns exactly what was saved,
//     oldest -> newest, after a mix of the above.

const fs = require("fs");
const path = require("path");
const os = require("os");
const assert = require("assert");

const tmpDbPath = path.join(os.tmpdir(), `aura-test-${Date.now()}.sqlite`);
process.env.AURA_DB_PATH = tmpDbPath;

const db = require("../src/db");

let passed = 0;
function check(label, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok - ${label}`);
  } catch (err) {
    console.error(`  FAIL - ${label}`);
    console.error(`         ${err.message}`);
    process.exitCode = 1;
  }
}

function makePhoneUser(phone) {
  const userId = db.createUserByPhone(phone);
  return userId;
}

console.log("Daily log save/merge tests\n");

// --- 1. First save writes exactly what was sent ---------------------------
const user1 = makePhoneUser("+910000000001");
const d1 = "2026-10-01";
check("first save stores mood/energy/symptoms/note as given", () => {
  const log = db.upsertDailyLog(user1, {
    logDate: d1,
    mood: "great",
    energy: 4,
    symptoms: ["cramps", "fatigue"],
    note: "felt good today",
  });
  assert.strictEqual(log.mood, "great");
  assert.strictEqual(log.energy, 4);
  assert.deepStrictEqual(log.symptoms.sort(), ["cramps", "fatigue"]);
  assert.strictEqual(log.note, "felt good today");
});

// --- 2. Saving only energy later doesn't erase mood/symptoms/note ---------
check("saving only energy preserves earlier mood/symptoms/note", () => {
  const log = db.upsertDailyLog(user1, {
    logDate: d1,
    energy: 2, // only energy provided - mood/symptoms/note omitted
  });
  assert.strictEqual(log.energy, 2, "energy should update");
  assert.strictEqual(log.mood, "great", "mood from the earlier save must survive");
  assert.deepStrictEqual(log.symptoms.sort(), ["cramps", "fatigue"], "symptoms must survive");
  assert.strictEqual(log.note, "felt good today", "note must survive");
});

// --- 3. Saving only a note doesn't erase mood/energy/symptoms -------------
check("saving only a note preserves mood/energy/symptoms", () => {
  const log = db.upsertDailyLog(user1, {
    logDate: d1,
    note: "updated note only",
  });
  assert.strictEqual(log.note, "updated note only");
  assert.strictEqual(log.mood, "great");
  assert.strictEqual(log.energy, 2);
  assert.deepStrictEqual(log.symptoms.sort(), ["cramps", "fatigue"]);
});

// --- 4. Explicitly clearing a field clears only that field -----------------
check("explicit null/empty clears exactly the touched field(s)", () => {
  const log = db.upsertDailyLog(user1, {
    logDate: d1,
    mood: null, // "deselected" mood this visit
    symptoms: [], // "cleared" all symptom chips this visit
  });
  assert.strictEqual(log.mood, null, "mood should be cleared");
  assert.deepStrictEqual(log.symptoms, [], "symptoms should be cleared");
  assert.strictEqual(log.energy, 2, "energy (untouched this save) must survive");
  assert.strictEqual(log.note, "updated note only", "note (untouched this save) must survive");
});

// --- 5. Two users, same date, no collision ---------------------------------
const user2 = makePhoneUser("+910000000002");
check("two users logging the same date don't collide", () => {
  db.upsertDailyLog(user1, { logDate: "2026-10-02", mood: "low", energy: 1 });
  db.upsertDailyLog(user2, { logDate: "2026-10-02", mood: "okay", energy: 5 });
  const log1 = db.getDailyLogByDate(user1, "2026-10-02");
  const log2 = db.getDailyLogByDate(user2, "2026-10-02");
  assert.strictEqual(log1.mood, "low");
  assert.strictEqual(log2.mood, "okay");
  assert.strictEqual(log1.energy, 1);
  assert.strictEqual(log2.energy, 5);
});

// --- 6. Two dates, same user, no bleed --------------------------------------
check("two dates for the same user stay independent", () => {
  db.upsertDailyLog(user1, { logDate: "2026-10-03", mood: "anxious", energy: 3, symptoms: ["headache"] });
  const oct1 = db.getDailyLogByDate(user1, d1);
  const oct3 = db.getDailyLogByDate(user1, "2026-10-03");
  assert.strictEqual(oct1.mood, null, "Oct 1 should keep its own (cleared) mood from test 4");
  assert.strictEqual(oct3.mood, "anxious");
  assert.deepStrictEqual(oct3.symptoms, ["headache"]);
});

// --- 7. getRecentLogs returns everything, oldest -> newest ------------------
check("getRecentLogs reflects every save, oldest to newest, per user", () => {
  const history = db.getRecentLogs(user1, 50);
  const dates = history.map((l) => l.log_date);
  assert.deepStrictEqual(dates, [...dates].sort(), "should already be oldest -> newest");
  assert.ok(dates.includes("2026-10-01"));
  assert.ok(dates.includes("2026-10-02"));
  assert.ok(dates.includes("2026-10-03"));
  // user2's Oct 2 entry must not leak into user1's history
  assert.ok(!db.getRecentLogs(user2, 50).some((l) => l.mood === "low"));
});

// --- cleanup -----------------------------------------------------------------
try {
  fs.unlinkSync(tmpDbPath);
  fs.unlinkSync(tmpDbPath + "-wal");
  fs.unlinkSync(tmpDbPath + "-shm");
} catch {
  // best effort
}

console.log(`\n${passed} test(s) passed${process.exitCode ? ", some FAILED (see above)" : ""}.`);
