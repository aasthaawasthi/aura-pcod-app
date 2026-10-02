const db = require("../db");
const { getExercisesForDate, getExerciseById } = require("../services/exercise/exerciseEngine");
const { toLocalDateStr } = require("../utils/date");

// GET /exercise/today?date=YYYY-MM-DD - suggested exercises for a date
// (defaults to today), picked from the library based on the user's
// current goals. No caching needed (unlike diet) - this is a pure,
// cheap, deterministic lookup, so it's always in sync with whatever
// goals the profile currently has, with nothing to invalidate.
exports.getSuggestedExercises = async (req, res) => {
  try {
    const userProfile = db.getUserProfile(req.user.id);
    const date = req.query.date || toLocalDateStr();
    const exercises = getExercisesForDate({ goals: userProfile.goals, forDate: date });
    res.json({ success: true, data: exercises, date });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Could not load suggested exercises" });
  }
};

// GET /exercise/:id - full detail for one exercise (used as a fallback if
// the app ever needs to look one up by id instead of carrying the object
// forward from the suggestions list).
exports.getExercise = async (req, res) => {
  const exercise = getExerciseById(req.params.id);
  if (!exercise) return res.status(404).json({ success: false, message: "Exercise not found" });
  res.json({ success: true, data: exercise });
};
