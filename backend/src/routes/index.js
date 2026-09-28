const router = require("express").Router();
const auth = require("../middleware/auth");

router.use("/health", require("./health.routes"));
router.use("/auth", require("./auth.routes"));

// Everything below requires a logged-in user
router.use("/profile", auth, require("./profile.routes"));
router.use("/daily-log", auth, require("./dailyLog.routes"));
router.use("/habits", auth, require("./habits.routes"));
router.use("/diet", auth, require("./diet.routes"));
router.use("/cycle", auth, require("./cycle.routes"));

module.exports = router;
