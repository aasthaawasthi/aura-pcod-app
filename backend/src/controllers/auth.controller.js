const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const TOKEN_EXPIRY = "30d";

function issueToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

exports.register = async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Email and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    const existing = db.getUserByEmail(email.toLowerCase().trim());
    if (existing) {
      return res
        .status(409)
        .json({ success: false, message: "An account with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = db.createUser({
      email: email.toLowerCase().trim(),
      passwordHash,
      name,
    });

    const token = issueToken(userId);
    res.json({ success: true, data: { token, userId } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Could not create account" });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Email and password are required" });
    }

    const user = db.getUserByEmail(email.toLowerCase().trim());
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    const token = issueToken(user.id);
    res.json({ success: true, data: { token, userId: user.id } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Could not log in" });
  }
};

exports.me = async (req, res) => {
  const user = db.getUserById(req.user.id);
  if (!user) return res.status(404).json({ success: false });
  res.json({
    success: true,
    data: { id: user.id, email: user.email, name: user.name },
  });
};

module.exports.JWT_SECRET = JWT_SECRET;
