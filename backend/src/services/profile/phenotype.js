// Turns a short onboarding quiz into a starting `profile_type`.
// This is a self-report heuristic to personalize diet defaults - explicitly
// NOT a diagnosis. Users can always change it later, and the app should
// keep saying so.

function classifyPhenotype(answers = {}) {
  const scores = {
    insulin_resistant: 0,
    adrenal: 0,
    inflammatory: 0,
    post_pill: 0,
  };

  if (answers.weightGainAroundBelly) scores.insulin_resistant += 2;
  if (answers.sugarCravings) scores.insulin_resistant += 2;
  if (answers.darkSkinPatches) scores.insulin_resistant += 2;
  if (answers.familyDiabetesHistory) scores.insulin_resistant += 1;

  if (answers.highStressLevels) scores.adrenal += 2;
  if (answers.wiredButTired) scores.adrenal += 2;
  if (answers.thinBuildWithSymptoms) scores.adrenal += 1;

  if (answers.acneOrInflammation) scores.inflammatory += 2;
  if (answers.digestiveIssues) scores.inflammatory += 2;
  if (answers.jointOrBodyPain) scores.inflammatory += 1;

  if (answers.recentlyStoppedBirthControl) scores.post_pill += 3;

  const [topType, topScore] = Object.entries(scores).sort(
    (a, b) => b[1] - a[1]
  )[0];

  if (topScore === 0) return "unclassified";
  return topType;
}

module.exports = { classifyPhenotype };
