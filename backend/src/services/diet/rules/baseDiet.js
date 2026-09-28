// Regional Indian base diets. This is the biggest lever for making diet
// advice feel personal rather than generic - "avoid rice" lands very
// differently for someone in Kerala vs someone in Punjab.

const REGIONAL_DIETS = {
  north: {
    veg: {
      breakfast: "Besan chilla / vegetable paratha (light oil)",
      lunch: "2 roti + dal + sabzi + salad",
      snack: "Roasted chana / fruit",
      dinner: "Khichdi or sabzi + 1 roti",
    },
    non_veg: {
      breakfast: "Egg bhurji + 1 roti",
      lunch: "Roti + chicken curry + salad",
      snack: "Boiled eggs / roasted nuts",
      dinner: "Grilled chicken + sauteed vegetables",
    },
  },
  south: {
    veg: {
      breakfast: "Vegetable oats idli / ragi dosa",
      lunch: "Brown rice (small portion) + sambar + poriyal + curd",
      snack: "Roasted makhana / boiled peanuts",
      dinner: "Millet (ragi/jowar) dosa + chutney",
    },
    non_veg: {
      breakfast: "Egg dosa",
      lunch: "Brown rice (small portion) + fish curry + vegetable poriyal",
      snack: "Boiled eggs",
      dinner: "Grilled fish + vegetable stir-fry",
    },
  },
  east: {
    veg: {
      breakfast: "Poha / vegetable dalia",
      lunch: "Brown rice (small portion) + dal + shukto (mixed veg)",
      snack: "Roasted chana / seasonal fruit",
      dinner: "Light vegetable curry + 1 roti",
    },
    non_veg: {
      breakfast: "Egg omelette + roti",
      lunch: "Brown rice (small portion) + fish curry + vegetables",
      snack: "Boiled eggs",
      dinner: "Light fish curry + sauteed greens",
    },
  },
  west: {
    veg: {
      breakfast: "Besan chilla / moong dal cheela",
      lunch: "Bajra roti + dal + sabzi + salad",
      snack: "Roasted chana / sprouts salad",
      dinner: "Vegetable khichdi + kadhi (light)",
    },
    non_veg: {
      breakfast: "Egg bhurji + bajra roti",
      lunch: "Bajra roti + chicken curry + salad",
      snack: "Boiled eggs / nuts",
      dinner: "Grilled chicken + sauteed vegetables",
    },
  },
};

function getBaseDiet(foodPreference = "veg", region = "north") {
  const regionDiets = REGIONAL_DIETS[region] || REGIONAL_DIETS.north;
  const pref = foodPreference === "non_veg" ? "non_veg" : "veg";
  return { ...regionDiets[pref] };
}

// A user can like more than one regional cuisine (e.g. both North and
// South Indian) - this rotates through their chosen regions by calendar
// day, so the week's plate has some variety instead of repeating one
// region every day, but is still fully deterministic for a given date
// (so the same date always plans the same meal, which is the point of
// planning groceries in advance).
function pickRegionForDate(regions, dateStr) {
  const list = Array.isArray(regions) && regions.length ? regions : ["north"];
  if (list.length === 1) return list[0];
  const [y, m, d] = dateStr.split("-").map(Number);
  const dayIndex = Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  return list[((dayIndex % list.length) + list.length) % list.length];
}

module.exports = { getBaseDiet, pickRegionForDate };
