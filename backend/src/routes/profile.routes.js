const router = require("express").Router();
const { getProfile, saveProfile } = require("../controllers/profile.controller");

router.get("/", getProfile);
router.post("/", saveProfile);

module.exports = router;
