const JSZip = require("jszip");
const db = require("../db");
const { toCsv } = require("../utils/csv");
const { runDeletionHooks } = require("../services/accountDeletion/thirdPartyHooks");

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes - same window as login's OTP

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// POST /account/delete/request-otp - sends a fresh OTP to the ALREADY
// LOGGED-IN user's own phone, as the "prove it's really you, right now"
// step right before a destructive action. Deliberately reuses the same
// otp_code/otp_expires_at columns and verification rule as login's OTP
// (see auth.controller.js) rather than inventing a second mechanism -
// one code path to trust, not two.
exports.requestDeleteOtp = async (req, res) => {
  try {
    const user = db.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "Account not found." });
    }
    if (!user.phone) {
      return res.status(400).json({
        success: false,
        message: "This account has no phone number on file to verify against.",
      });
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();
    db.setUserOtp(user.id, otp, expiresAt);

    const IS_DEV = (process.env.NODE_ENV || "development") !== "production";
    console.log(`[dev-otp] Account-deletion OTP for ${user.phone} is ${otp} (expires ${expiresAt})`);

    res.json({
      success: true,
      data: {
        phone: user.phone,
        expiresInSeconds: OTP_TTL_MS / 1000,
        ...(IS_DEV ? { devOtp: otp } : {}),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Could not send the verification code" });
  }
};

// GET /account/export - the user's own entered data (account/profile,
// check-ins, cycles, period days) as a ZIP of CSVs so it opens cleanly in
// Excel/Sheets rather than asking a non-technical person to read raw
// JSON. Deliberately scoped to what the user typed in, not the app's own
// generated output (habits, diet plans) - see getAllUserDataForExport.
// Export sizes here are small (one person's own health logs, not a data
// warehouse), so building the zip in memory with JSZip is simpler and
// plenty fast - no need for true streaming.
exports.exportData = async (req, res) => {
  try {
    const data = db.getAllUserDataForExport(req.user.id);
    if (!data) {
      return res.status(404).json({ success: false, message: "Account not found." });
    }

    const zip = new JSZip();

    zip.file("account.csv", toCsv([data.account], ["name", "email", "phone", "created_at"]));
    if (data.profile) {
      zip.file(
        "profile.csv",
        toCsv(
          [data.profile],
          ["goals", "food_preference", "regions", "has_pcod", "profile_type", "age", "gender", "height_cm", "weight_kg"]
        )
      );
    }
    zip.file("daily_logs.csv", toCsv(data.dailyLogs, ["log_date", "mood", "energy", "symptoms", "note", "created_at"]));
    zip.file("cycles.csv", toCsv(data.cycles, ["id", "period_start", "period_end", "flow", "created_at"]));
    zip.file("period_days.csv", toCsv(data.periodDays, ["log_date", "cycle_id", "flow", "color"]));
    // Habits, habit logs and diet plans are intentionally left out of the
    // export - see the comment on getAllUserDataForExport in db/index.js.

    const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="aura-my-data.zip"');
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Could not prepare your data export" });
  }
};

// POST /account/delete/confirm { otp, reasonCode?, note? } - the actual
// deletion. Verifies the OTP the same way login does, then performs the
// hard delete + feedback write as one atomic local transaction (see
// db.hardDeleteUserAccount) before best-effort notifying any third-party
// integrations. Idempotent: if the account is already gone (e.g. the
// client retrying after a dropped response on a previous successful
// call), this returns a clean "already deleted" result instead of an
// error, so a retry is always safe to send.
exports.confirmDelete = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = db.getUserById(userId);

    if (!user) {
      // Already gone - most likely a retry after the response to an
      // earlier successful call never made it back to the client.
      return res.json({ success: true, data: { alreadyDeleted: true } });
    }

    const otp = String(req.body.otp || "").trim();
    if (!otp) {
      return res.status(400).json({ success: false, message: "Enter the verification code to continue." });
    }
    if (!user.otp_code) {
      return res.status(400).json({ success: false, message: "Request a new code and try again." });
    }
    if (user.otp_expires_at && new Date(user.otp_expires_at).getTime() < Date.now()) {
      return res.status(400).json({ success: false, message: "That code has expired - request a new one." });
    }
    if (user.otp_code !== otp) {
      return res.status(400).json({ success: false, message: "Incorrect code. Please try again." });
    }

    const reasonCode = typeof req.body.reasonCode === "string" && req.body.reasonCode.trim()
      ? req.body.reasonCode.trim()
      : "not_specified";
    const note = typeof req.body.note === "string" && req.body.note.trim()
      ? req.body.note.trim().slice(0, 1000)
      : null;
    const appVersion = typeof req.body.appVersion === "string" ? req.body.appVersion.trim() : null;

    const createdAtMs = user.created_at ? new Date(user.created_at.replace(" ", "T") + "Z").getTime() : null;
    const accountAgeDays = createdAtMs ? Math.max(0, Math.floor((Date.now() - createdAtMs) / 86400000)) : null;

    const result = db.hardDeleteUserAccount(userId, { reasonCode, note, accountAgeDays, appVersion });

    // Best-effort, after the local deletion has already committed - see
    // thirdPartyHooks.js for why this never blocks or reverses it.
    await runDeletionHooks(userId);

    res.json({ success: true, data: { alreadyDeleted: !result.deleted } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Could not delete your account. Please try again." });
  }
};
