// Applies each selected goal's diet tweaks in turn. Goals are applied in
// the order the user picked them, so if two goals would touch the same
// meal, the later one wins - simple and predictable rather than trying to
// merge conflicting advice.
//
// Each override picks from a small pool of realistic options instead of
// one fixed string, rotated by calendar date via pickVariant (see
// ../utils.js) - a static array lookup, so this stays just as cheap as
// the single-string version was, with no network/AI call per request.
const { pickVariant } = require("../utils");

function applyGoalRules(diet, goals, dateStr, foodPreference) {
  let updated = { ...diet };
  const goalList = Array.isArray(goals) ? goals : goals ? [goals] : [];
  const date = dateStr || new Date().toISOString().slice(0, 10);
  const isVeg = foodPreference !== "non_veg";

  for (const goal of goalList) {
    if (goal === "weight_loss") {
      const breakfastPool = isVeg
        ? ["Besan chilla (high protein)", "Vegetable oats upma", "Moong dal cheela", "Sprouts salad + multigrain toast", "Paneer bhurji (light)"]
        : ["Besan chilla (high protein)", "Vegetable oats upma", "Moong dal cheela", "Sprouts salad + multigrain toast", "Egg white omelette + veggies"];
      updated.breakfast = pickVariant(breakfastPool, date, 30);
      updated.snack = pickVariant(
        ["Roasted chana", "Roasted makhana", "Cucumber & carrot sticks", "Buttermilk", "Seasonal fruit"],
        date,
        31
      );
      updated.dinner = pickVariant(
        ["Light khichdi + salad", "Clear vegetable soup", "Grilled paneer + sauteed vegetables", "Moong dal soup + salad", "Steamed vegetables + small dal"],
        date,
        32
      );
    }

    if (goal === "regular_cycle") {
      updated.snack = pickVariant(
        ["Fruit + flax seeds", "Fruit + pumpkin seeds", "Roasted chana + seeds", "Sprouts salad with seeds"],
        date,
        33
      );
    }

    if (goal === "skin_hair" || goal === "skin_balance") {
      updated.snack = pickVariant(
        ["Walnuts + fruit (omega rich)", "Flaxseed + fruit bowl", "Almonds + orange slices", "Pumpkin seeds + papaya"],
        date,
        34
      );
    }

    if (goal === "sleep_cycle") {
      updated.dinner = pickVariant(
        ["Light early dinner (avoid caffeine after 4pm)", "Warm soup + steamed vegetables (early dinner)", "Khichdi (light, early) + herbal tea", "Dal soup + salad (early, avoid heavy spice)"],
        date,
        35
      );
    }

    if (goal === "hairfall") {
      updated.lunch = updated.lunch + (isVeg ? " + extra protein (paneer/sprouts)" : " + extra protein (paneer/sprouts/egg)");
    }

    if (goal === "insulin_balance") {
      updated.lunch = updated.lunch.replace(/rice/i, "millet");
      updated.snack = pickVariant(
        ["Nuts / roasted chana (low GI)", "Roasted makhana (low GI)", "Cucumber sticks + hummus (low GI)", "Sprouts chaat (low GI)"],
        date,
        36
      );
    }

    if (goal === "fertility") {
      updated.breakfast = updated.breakfast + " + soaked almonds";
    }

    if (goal === "thyroid") {
      updated.dinner = updated.dinner + " (iodine-rich - add a pinch of sea salt)";
    }

    if (goal === "mood_mental_health") {
      updated.snack = pickVariant(
        ["Dark chocolate square + herbal tea", "Banana + warm turmeric milk", "Handful of walnuts + chamomile tea", "Dark chocolate square + fruit"],
        date,
        37
      );
    }
  }

  return updated;
}

module.exports = { applyGoalRules };
