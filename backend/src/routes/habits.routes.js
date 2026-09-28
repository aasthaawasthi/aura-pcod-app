const router = require("express").Router();
const {
  getHabits,
  logHabit,
  saveHabitLogsBatch,
  getCalendar,
} = require("../controllers/habits.controller");

router.get("/", getHabits);
router.post("/log", logHabit);
router.post("/log-batch", saveHabitLogsBatch);
router.get("/calendar", getCalendar);

module.exports = router;