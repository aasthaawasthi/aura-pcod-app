const db = require("../db");
const { classifyPhenotype } = require("../services/profile/phenotype");

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

    if (email !== undefined) {
      const existing = db.getUserByEmail(email);
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
      ...(profile_type ? { profile_type } : {}),
      onboarding_complete,
    });

    // Goals drive the recommended habit checklist - regenerate it whenever
    // goals were part of this save, so the checklist stays in sync with
    // what the user is actually trying to work on.
    if (goals !== undefined) {
      db.syncRecommendedHabits(req.user.id, updated.goals);
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
