const jwt = require("jsonwebtoken");
const db = require("../db");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

// JWTs here are stateless - there's no server-side session table to
// revoke from - so verifying the signature alone isn't enough once
// account deletion exists: a token issued before someone deletes their
// account would otherwise stay "valid" (and keep working on every
// device) until it naturally expires, up to 30 days later. The one cheap
// DB lookup below is what actually makes "deleting the account instantly
// logs it out everywhere" true, the moment the row is gone.
module.exports = (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.getUserById(payload.userId);
    if (!user) {
      return res.status(401).json({ success: false, message: "This account no longer exists." });
    }
    req.user = { id: payload.userId };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid or expired session" });
  }
};
