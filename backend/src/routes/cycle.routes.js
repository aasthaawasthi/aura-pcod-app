const router = require("express").Router();
const {
  getCycleInfo,
  startPeriod,
  endPeriod,
  logPeriodDays,
  getPeriodDays,
} = require("../controllers/cycle.controller");

router.get("/", getCycleInfo);
router.post("/start", startPeriod);
router.post("/end", endPeriod);
router.post("/log-days", logPeriodDays);
router.get("/period-days", getPeriodDays);

module.exports = router;
