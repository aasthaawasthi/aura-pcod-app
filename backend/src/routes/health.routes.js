const router = require("express").Router();

router.get("/", (req, res) => {
  res.json({ success: true, message: "API is running" });
});

module.exports = router;