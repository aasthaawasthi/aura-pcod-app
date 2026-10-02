const { EXERCISES } = require("./exerciseLibrary");

const THUMBNAIL_BASE = "https://i.ytimg.com/vi";

function withMedia(exercise) {
  return {
    ...exercise,
    thumbnailUrl: `${THUMBNAIL_BASE}/${exercise.youtubeId}/hqdefault.jpg`,
    watchUrl: `https://www.youtube.com/watch?v=${exercise.youtubeId}`,
  };
}

// Same day-index rotation trick as the diet engine's pickRegionForDate -
// deterministic per date (so reloading today shows the same exercises,
// but tomorrow's are different), no randomness or DB state needed.
function dayIndexFor(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

// Picks `count` exercises for a date, favoring ones tagged with the
// user's goals. Falls back to the full library (still date-rotated) when
// the user has no goals set yet or their goals don't match anything
// tagged, so the section is never empty.
function getExercisesForDate({ goals, forDate, count = 2 }) {
  const goalList = Array.isArray(goals) && goals.length ? goals : [];

  let pool = goalList.length
    ? EXERCISES.filter((ex) => ex.goals.some((g) => goalList.includes(g)))
    : [];
  if (pool.length === 0) pool = EXERCISES;

  const dayIndex = dayIndexFor(forDate);
  const n = pool.length;
  const start = ((dayIndex % n) + n) % n;

  const picked = [];
  const seen = new Set();
  for (let i = 0; i < n && picked.length < count; i++) {
    const ex = pool[(start + i) % n];
    if (!seen.has(ex.id)) {
      seen.add(ex.id);
      picked.push(ex);
    }
  }

  return picked.map(withMedia);
}

function getExerciseById(id) {
  const ex = EXERCISES.find((e) => e.id === id);
  return ex ? withMedia(ex) : null;
}

module.exports = { getExercisesForDate, getExerciseById };
