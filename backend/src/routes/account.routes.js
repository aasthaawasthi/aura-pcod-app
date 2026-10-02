const router = require("express").Router();
const { requestDeleteOtp, exportData, confirmDelete } = require("../controllers/account.controller");

router.get("/export", exportData);
router.post("/delete/request-otp", requestDeleteOtp);
router.post("/delete/confirm", confirmDelete);

module.exports = router;
