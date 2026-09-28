// A small pool of swappable alternatives per meal slot, so "I don't like
// millets" has somewhere to go. Kept food-preference-aware (veg/non-veg)
// but not region-specific - simpler, and a user who dislikes an item
// usually just wants *a* different option, not necessarily one tied to
// the same regional cuisine.

const ALTERNATE_POOL = {
  veg: {
    breakfast: ["Vegetable poha", "Moong dal cheela", "Oats idli", "Sprouts salad", "Besan chilla"],
    lunch: ["2 roti + dal + sabzi + salad", "Brown rice + sambar + poriyal + curd", "Quinoa khichdi + curd", "Bajra roti + dal + sabzi"],
    snack: ["Roasted chana", "Seasonal fruit", "Boiled peanuts", "Roasted makhana", "Sprouts chaat"],
    dinner: ["Vegetable khichdi", "Grilled paneer + salad", "Light soup + roti", "Millet dosa + chutney"],
  },
  non_veg: {
    breakfast: ["Egg bhurji + roti", "Egg dosa", "Boiled eggs + fruit", "Egg omelette + roti"],
    lunch: ["Roti + chicken curry + salad", "Brown rice + fish curry + vegetables", "Grilled chicken salad"],
    snack: ["Boiled eggs", "Roasted nuts", "Grilled chicken strips"],
    dinner: ["Grilled chicken + sauteed vegetables", "Grilled fish + vegetable stir-fry", "Egg curry + 1 roti"],
  },
};

// Cycles a meal's text to the next alternative in the pool (wrapping
// around), skipping whatever's currently shown so a swap always changes
// something visible.
function nextAlternative(foodPreference, meal, currentText) {
  const pref = foodPreference === "non_veg" ? "non_veg" : "veg";
  const pool = (ALTERNATE_POOL[pref] && ALTERNATE_POOL[pref][meal]) || [];
  if (pool.length === 0) return currentText;
  const currentIndex = pool.indexOf(currentText);
  const nextIndex = (currentIndex + 1) % pool.length;
  return pool[nextIndex];
}

module.exports = { ALTERNATE_POOL, nextAlternative };
