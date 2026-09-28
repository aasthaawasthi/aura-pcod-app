const router = require("express").Router();
const { getTodayDiet, getDietForDate, getDietWeek, getDietMonth, swapDietItem } = require("../controllers/diet.controller");

router.get("/today", getTodayDiet);
router.get("/week", getDietWeek);
router.get("/month", getDietMonth);
router.post("/swap", swapDietItem);
router.get("/", getDietForDate);

module.exports = router;
