const Database = require("better-sqlite3");
const path = require("path");

// Overridable so test scripts can point at a throwaway file instead of
// the real app database - see scripts/test-daily-log.js.
const dbPath = process.env.AURA_DB_PATH || path.join(__dirname, "..", "..", "data.sqlite");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT,
  email TEXT,
  password_hash TEXT,
  name TEXT,
  otp_code TEXT,
  otp_expires_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  goal TEXT DEFAULT 'regular_cycle',              -- weight_loss | regular_cycle | skin_hair
  food_preference TEXT DEFAULT 'veg',             -- veg | non_veg
  region TEXT DEFAULT 'north',                    -- north | south | east | west
  has_pcod INTEGER DEFAULT 1,
  profile_type TEXT DEFAULT 'unclassified',       -- insulin_resistant | adrenal | inflammatory | post_pill | unclassified
  age INTEGER,
  height_cm REAL,
  weight_kg REAL,
  onboarding_complete INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS phenotype_answers (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  answers_json TEXT
);

CREATE TABLE IF NOT EXISTS daily_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  log_date TEXT NOT NULL,                         -- YYYY-MM-DD
  mood TEXT,
  energy INTEGER,                                 -- 1-5
  symptoms_json TEXT,                              -- array of symptom strings
  note TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, log_date)
);

CREATE TABLE IF NOT EXISTS cycles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  period_start TEXT NOT NULL,                     -- YYYY-MM-DD
  period_end TEXT,                                -- YYYY-MM-DD, nullable until logged
  flow TEXT,                                      -- light | medium | heavy
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS period_days (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  cycle_id INTEGER REFERENCES cycles(id) ON DELETE CASCADE,
  log_date TEXT NOT NULL,                         -- YYYY-MM-DD
  flow TEXT DEFAULT 'medium',                     -- light | medium | heavy
  color INTEGER DEFAULT 5,                        -- 0 (dark brown) .. 5 (bright red)
  UNIQUE(user_id, log_date)
);

CREATE TABLE IF NOT EXISTS habits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'circle',
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS habit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  habit_id INTEGER REFERENCES habits(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  log_date TEXT NOT NULL,
  completed INTEGER DEFAULT 0,
  UNIQUE(habit_id, log_date)
);

CREATE TABLE IF NOT EXISTS diets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  diet_date TEXT NOT NULL,
  diet_json TEXT NOT NULL,
  UNIQUE(user_id, diet_date)
);

-- Captured when someone deletes their account, so "why are people
-- leaving" stays answerable in aggregate even though the account itself
-- is gone. Deliberately has NO user_id/phone/email/name column at all -
-- not nullable, just absent - so a row here can never be linked back to
-- who wrote it, even by mistake later. Written in the same transaction
-- as the account deletion (see db/index.js's hardDeleteUserAccount), so
-- the feedback always exists exactly when the account doesn't, never the
-- other way around.
CREATE TABLE IF NOT EXISTS deletion_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reason_code TEXT NOT NULL,
  note TEXT,
  account_age_days INTEGER,
  app_version TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
`);

// --- Lightweight migrations -------------------------------------------
// CREATE TABLE IF NOT EXISTS above only helps on a brand-new database; an
// existing one needs these columns added explicitly. Guarded so re-running
// on an already-migrated DB is a no-op.
function addColumnIfMissing(table, column, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

// Users used to require email+password (NOT NULL). Phone+OTP login means
// both are now optional, which SQLite can't express via ALTER TABLE - so
// an existing DB with the old constraints gets its `users` table rebuilt
// once, preserving all rows and every other table's foreign keys (they
// reference the table by name, which is unchanged).
function usersTableNeedsRebuild() {
  const cols = db.prepare("PRAGMA table_info(users)").all();
  const passwordCol = cols.find((c) => c.name === "password_hash");
  return !!passwordCol && passwordCol.notnull === 1;
}

if (usersTableNeedsRebuild()) {
  db.pragma("foreign_keys = OFF");
  db.exec(`
    CREATE TABLE users_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT,
      email TEXT,
      password_hash TEXT,
      name TEXT,
      otp_code TEXT,
      otp_expires_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    INSERT INTO users_new (id, email, password_hash, name, created_at)
      SELECT id, email, password_hash, name, created_at FROM users;
    DROP TABLE users;
    ALTER TABLE users_new RENAME TO users;
  `);
  db.pragma("foreign_keys = ON");
}

addColumnIfMissing("users", "phone", "phone TEXT");
addColumnIfMissing("users", "profile_picture", "profile_picture TEXT");
addColumnIfMissing("users", "otp_code", "otp_code TEXT");
addColumnIfMissing("users", "otp_expires_at", "otp_expires_at TEXT");

// Phone is the primary login identifier now - enforce uniqueness (but only
// among rows that actually have one, since old email/password accounts may
// not). Same for email, which remains unique when present.
db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone) WHERE phone IS NOT NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;
`);
addColumnIfMissing("profiles", "gender", "gender TEXT");
// Goals and regional cuisine preference are now multi-select - stored as a
// JSON array string. The old singular `goal`/`region` columns are left in
// place (harmless) so nothing breaks if any old code path still reads them.
addColumnIfMissing("profiles", "goals_json", "goals_json TEXT DEFAULT '[\"regular_cycle\"]'");
addColumnIfMissing("profiles", "regions_json", "regions_json TEXT DEFAULT '[\"north\"]'");

const DEFAULT_HABITS = [
  { name: "Drink 8 glasses of water", icon: "droplet" },
  { name: "Walk 20 minutes", icon: "footprints" },
  { name: "Sleep by 11 PM", icon: "moon" },
  { name: "10 min strength / yoga", icon: "dumbbell" },
];

function seedDefaultHabits(userId) {
  const existing = db.prepare("SELECT COUNT(*) as c FROM habits WHERE user_id = ?").get(userId);
  if (existing.c > 0) return;
  const insert = db.prepare("INSERT INTO habits (user_id, name, icon) VALUES (?, ?, ?)");
  const tx = db.transaction((habits) => {
    for (const h of habits) insert.run(userId, h.name, h.icon);
  });
  tx(DEFAULT_HABITS);
}

module.exports = { db, seedDefaultHabits };
