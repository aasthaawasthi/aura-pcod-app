const router = require("express").Router();
const { requestOtp, verifyOtp, me } = require("../controllers/auth.controller");
const auth = require("../middleware/auth");

router.post("/otp/request", requestOtp);
router.post("/otp/verify", verifyOtp);
router.get("/me", auth, me);

module.exports = router;
