const { getBaseDiet, pickRegionForDate } = require("./rules/baseDiet");
const { applyGoalRules } = require("./rules/goalRules");
const { applyProfileRules } = require("./rules/profileRules");
const { applySymptomRules } = require("./rules/symptomRules");
const { applyHabitRules } = require("./rules/habitRules");
const { extractRecentSymptoms } = require("./utils");
const { toLocalDateStr } = require("../../utils/date");

// `dailyLogs`/`habitLogs` are optional - when generating a plan for a
// FUTURE date (grocery planning for the week/month ahead) there's no log
// data for that day yet, so those personalization steps are simply
// skipped and the plan falls back to profile + goals only. For today (or
// any past date being regenerated), pass the real logs for the fuller,
// symptom-aware version.
async function generateDiet({ userProfile, dailyLogs, habitLogs, forDate }) {
  const date = forDate || toLocalDateStr();
  const regions = userProfile.regions && userProfile.regions.length ? userProfile.regions : [userProfile.region || "north"];
  const region = pickRegionForDate(regions, date);

  let diet = getBaseDiet(userProfile.food_preference, region);

  const goals = userProfile.goals && userProfile.goals.length ? userProfile.goals : userProfile.goal ? [userProfile.goal] : [];

  // Step 1: Goal-based modifications
  diet = applyGoalRules(diet, goals);

  // Step 2: PCOD profile rules
  diet = applyProfileRules(diet, userProfile.profile_type);

  // Step 3: Symptom-based rules (today/past only - needs real log data)
  if (dailyLogs) {
    const symptoms = extractRecentSymptoms(dailyLogs);
    diet = applySymptomRules(diet, symptoms);
  }

  // Step 4: Habit-based rules (today/past only - needs real log data)
  if (habitLogs) {
    diet = applyHabitRules(diet, habitLogs);
  }

  diet.region = region;
  return diet;
}

module.exports = {
  generateDiet
};
