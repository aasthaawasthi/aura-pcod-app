const jwt = require("jsonwebtoken");
const db = require("../db");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const TOKEN_EXPIRY = "30d";
const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const IS_DEV = (process.env.NODE_ENV || "development") !== "production";

function issueToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

// Normalizes to a consistent storage/lookup key: strips everything but
// digits and a leading "+", and assumes a bare 10-digit number is Indian
// (prepends +91) since that's this app's primary market. A number already
// given with a country code (+...) is left as-is.
function normalizePhone(raw) {
  if (!raw) return "";
  let cleaned = String(raw).trim().replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+")) {
    cleaned = "+" + cleaned.slice(1).replace(/\+/g, "");
  } else {
    cleaned = cleaned.replace(/\+/g, "");
    if (cleaned.length === 10) cleaned = "91" + cleaned;
    cleaned = "+" + cleaned;
  }
  return cleaned;
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// POST /auth/otp/request { phone } - generates and "sends" an OTP for the
// given phone number, creating the account on first use (there's no
// separate signup step - phone+OTP login doubles as registration).
//
// No SMS provider is wired up yet, so in dev the OTP is logged to the
// server console and also returned in the response (devOtp) so you can
// test the flow end-to-end without receiving a real text. Swap this out
// for a real provider (Twilio/MSG91/etc.) before shipping - see the
// IS_DEV guard below, which is the only thing to change.
exports.requestOtp = async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    if (!phone || phone.replace(/\D/g, "").length < 10) {
      return res.status(400).json({ success: false, message: "Enter a valid phone number." });
    }

    let user = db.getUserByPhone(phone);
    if (!user) {
      const userId = db.createUserByPhone(phone);
      user = db.getUserById(userId);
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();
    db.setUserOtp(user.id, otp, expiresAt);

    // Stand-in for actually sending an SMS.
    console.log(`[dev-otp] OTP for ${phone} is ${otp} (expires ${expiresAt})`);

    res.json({
      success: true,
      data: {
        phone,
        expiresInSeconds: OTP_TTL_MS / 1000,
        ...(IS_DEV ? { devOtp: otp } : {}),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Could not send the OTP" });
  }
};

// POST /auth/otp/verify { phone, otp } - checks the code and logs the
// user in, issuing the same JWT the rest of the API expects.
exports.verifyOtp = async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const otp = String(req.body.otp || "").trim();
    if (!phone || !otp) {
      return res.status(400).json({ success: false, message: "Phone number and code are required" });
    }

    const user = db.getUserByPhone(phone);
    if (!user || !user.otp_code) {
      return res.status(400).json({ success: false, message: "Request a new code and try again." });
    }
    if (user.otp_expires_at && new Date(user.otp_expires_at).getTime() < Date.now()) {
      return res.status(400).json({ success: false, message: "That code has expired - request a new one." });
    }
    if (user.otp_code !== otp) {
      return res.status(400).json({ success: false, message: "Incorrect code. Please try again." });
    }

    db.clearUserOtp(user.id);

    const token = issueToken(user.id);
    res.json({ success: true, data: { token, userId: user.id } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Could not verify the code" });
  }
};

exports.me = async (req, res) => {
  const user = db.getUserById(req.user.id);
  if (!user) return res.status(404).json({ success: false });
  res.json({
    success: true,
    data: { id: user.id, phone: user.phone, email: user.email, name: user.name },
  });
};

module.exports.JWT_SECRET = JWT_SECRET;
