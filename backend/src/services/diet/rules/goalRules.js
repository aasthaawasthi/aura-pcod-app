// Applies each selected goal's diet tweaks in turn. Goals are applied in
// the order the user picked them, so if two goals would touch the same
// meal, the later one wins - simple and predictable rather than trying to
// merge conflicting advice.
function applyGoalRules(diet, goals) {
  let updated = { ...diet };
  const goalList = Array.isArray(goals) ? goals : goals ? [goals] : [];

  for (const goal of goalList) {
    if (goal === "weight_loss") {
      updated.breakfast = "Besan chilla (high protein)";
      updated.snack = "Roasted chana / nuts";
      updated.dinner = "Light dinner (khichdi / soup)";
    }

    if (goal === "regular_cycle") {
      updated.snack = "Fruit + seeds (flax/pumpkin)";
    }

    if (goal === "skin_hair" || goal === "skin_balance") {
      updated.snack = "Fruits + nuts (omega rich)";
    }

    if (goal === "sleep_cycle") {
      updated.dinner = "Light early dinner (avoid caffeine after 4pm)";
    }

    if (goal === "hairfall") {
      updated.lunch = updated.lunch + " + extra protein (paneer/sprouts/egg)";
    }

    if (goal === "insulin_balance") {
      updated.lunch = updated.lunch.replace(/rice/i, "millet") ;
      updated.snack = "Nuts / roasted chana (low GI)";
    }

    if (goal === "fertility") {
      updated.breakfast = updated.breakfast + " + soaked almonds";
    }

    if (goal === "thyroid") {
      updated.dinner = updated.dinner + " (iodine-rich - add a pinch of sea salt)";
    }

    if (goal === "mood_mental_health") {
      updated.snack = "Dark chocolate square + herbal tea";
    }
  }

  return updated;
}

module.exports = { applyGoalRules };
