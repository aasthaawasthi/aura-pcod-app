const db = require("../db");
const { classifyPhenotype } = require("../services/profile/phenotype");
const { toLocalDateStr } = require("../utils/date");

exports.getProfile = async (req, res) => {
  try {
    const profile = db.getUserProfile(req.user.id);
    res.json({ success: true, data: profile });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error loading profile" });
  }
};

// Saves any subset of profile fields - identity (name/email/phone/
// profile_picture), health basics (age/gender/height/weight), and
// preferences (goals[], food_preference, regions[]). Used by onboarding
// AND by the profile screen's "Save changes", so every field is optional -
// only what's provided gets updated.
exports.saveProfile = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      profile_picture,
      goals,
      food_preference,
      regions,
      has_pcod,
      age,
      gender,
      height_cm,
      weight_kg,
      phenotype_answers,
      onboarding_complete,
    } = req.body;

    if (goals !== undefined && !Array.isArray(goals)) {
      return res.status(400).json({ success: false, message: "goals must be an array" });
    }
    if (regions !== undefined && !Array.isArray(regions)) {
      return res.status(400).json({ success: false, message: "regions must be an array" });
    }

    // Treat a blank email as "no email", not as a real value to be
    // unique-checked - otherwise two accounts that both simply haven't
    // set an email (phone-only sign-ups included) collide with each
    // other on an empty string and block an unrelated save.
    const normalizedEmail = email !== undefined ? (String(email).trim() || null) : undefined;
    if (normalizedEmail) {
      const existing = db.getUserByEmail(normalizedEmail);
      if (existing && existing.id !== req.user.id) {
        return res.status(400).json({ success: false, message: "That email is already in use." });
      }
    }

    let profile_type;
    if (phenotype_answers) {
      db.savePhenotypeAnswers(req.user.id, phenotype_answers);
      profile_type = classifyPhenotype(phenotype_answers);
    }

    let updated = db.saveUserProfile(req.user.id, {
      name,
      email: normalizedEmail,
      phone,
      profile_picture,
      goals,
      food_preference,
      regions,
      has_pcod,
      age,
      gender,
      height_cm,
      weight_kg,
      ...(profile_type ? { profile_type } : {}),
      onboarding_complete,
    });

    // Goals drive the recommended habit checklist - regenerate it whenever
    // goals were part of this save, so the checklist stays in sync with
    // what the user is actually trying to work on.
    if (goals !== undefined) {
      db.syncRecommendedHabits(req.user.id, updated.goals);
    }

    // Food preference/regions/goals all feed the diet generator. Diets are
    // cached per date (see diet.controller.js) for consistency and
    // performance, but that means a stale cached diet would otherwise keep
    // showing on Home even after the user changes their preferences here.
    // Clear today's (and any future planned) cached diet so the next
    // fetch regenerates one that reflects the new preferences.
    if (food_preference !== undefined || regions !== undefined || goals !== undefined) {
      db.clearDietsFrom(req.user.id, toLocalDateStr());
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    if (err && err.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(400).json({ success: false, message: "That email is already in use." });
    }
    res.status(500).json({ success: false, message: "Could not save profile" });
  }
};
