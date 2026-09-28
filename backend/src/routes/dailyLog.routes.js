const router = require("express").Router();
const {
  createDailyLog,
  getRecentLogs,
  getTodayLog,
} = require("../controllers/dailyLog.controller");

router.post("/", createDailyLog);
router.get("/", getRecentLogs);
router.get("/today", getTodayLog);

module.exports = router;
