// Regional Indian base diets. This is the biggest lever for making diet
// advice feel personal rather than generic - "avoid rice" lands very
// differently for someone in Kerala vs someone in Punjab.
//
// Each meal slot is a POOL of options, not a single fixed string - a real
// week of eating doesn't repeat the same breakfast seven times, so
// getBaseDiet() below picks a different one per calendar date. The pool
// is still 100% static data (no web calls, no per-request AI call), so
// this stays O(1) and trivially cheap at any number of users - see
// pickVariant() in ../utils.js for the rotation itself.

const { pickVariant, dayIndexFor } = require("../utils");

const REGIONAL_DIETS = {
  north: {
    veg: {
      breakfast: [
        "Besan chilla with mint chutney",
        "Vegetable daliya (broken wheat porridge)",
        "Moong dal cheela with vegetables",
        "Vegetable oats upma",
        "Sprouts salad + multigrain toast",
        "Paneer bhurji + 1 roti",
        "Vegetable poha (light oil)",
      ],
      lunch: [
        "2 roti + dal + mixed vegetable sabzi + salad",
        "2 roti + rajma (kidney bean curry) + salad",
        "2 roti + chana masala + cucumber raita",
        "2 roti + palak paneer + salad",
        "2 roti + lauki sabzi + dal + salad",
        "Quinoa pulao + dal + salad",
        "2 roti + bhindi sabzi + dal",
      ],
      snack: [
        "Roasted chana",
        "Seasonal fruit (apple/guava/papaya)",
        "Roasted makhana (fox nuts)",
        "Sprouts chaat",
        "Almonds and walnuts (small handful)",
        "Cucumber & carrot sticks with hummus",
        "Buttermilk (chaas) with roasted cumin",
      ],
      dinner: [
        "Khichdi + salad",
        "1 roti + mixed vegetable sabzi + salad",
        "Vegetable soup + 1 roti",
        "Moong dal khichdi + curd",
        "Grilled paneer + sauteed vegetables",
        "1 roti + lauki sabzi + salad",
        "Vegetable daliya (light)",
      ],
    },
    non_veg: {
      breakfast: [
        "Egg bhurji + 1 roti",
        "Boiled eggs + vegetable upma",
        "Egg white omelette + multigrain toast",
        "Chicken keema (small portion) + 1 roti",
        "Egg paratha (light oil)",
        "Masala omelette + salad",
      ],
      lunch: [
        "1 roti + chicken curry + salad",
        "1 roti + egg curry + salad",
        "Grilled chicken + dal + salad",
        "Chicken tikka + sauteed vegetables",
        "1 roti + mutton curry (small portion) + salad",
        "Egg bhurji + dal + salad",
      ],
      snack: [
        "Boiled eggs",
        "Roasted chicken strips",
        "Roasted nuts",
        "Clear chicken soup",
        "Grilled chicken skewers (small)",
        "Buttermilk",
      ],
      dinner: [
        "Grilled chicken + sauteed vegetables",
        "Egg curry + salad",
        "Chicken soup + salad",
        "1 roti + chicken curry (light) + salad",
        "Egg bhurji + salad",
        "Chicken stir-fry with vegetables",
      ],
    },
  },
  south: {
    veg: {
      breakfast: [
        "Vegetable oats idli with sambar",
        "Ragi dosa with coconut chutney",
        "Vegetable upma with coconut chutney",
        "Pesarattu (moong dal dosa)",
        "Idiyappam + vegetable stew",
        "Rava idli + sambar",
        "Vegetable semiya upma",
      ],
      lunch: [
        "Brown rice (small portion) + sambar + poriyal + curd",
        "Brown rice + rasam + beans poriyal + curd",
        "Millet (ragi) rice + avial + curd",
        "Lemon rice (small portion) + vegetable kootu",
        "Brown rice + vegetable sambar + cabbage thoran",
        "Curd rice (small portion) + pickle + poriyal",
      ],
      snack: [
        "Roasted makhana",
        "Boiled peanuts (sundal)",
        "Seasonal fruit",
        "Roasted chana sundal",
        "Buttermilk (sambharam)",
        "Steamed corn with lime and chili",
      ],
      dinner: [
        "Millet (ragi/jowar) dosa + chutney",
        "Vegetable upma (light)",
        "Idli (2-3) + sambar",
        "Vegetable oats khichdi",
        "Ragi dosa + tomato chutney",
        "Light vegetable rasam + 1 small idli",
      ],
    },
    non_veg: {
      breakfast: [
        "Egg dosa",
        "Egg appam",
        "Boiled eggs + idli",
        "Egg omelette + vegetable upma",
        "Chicken keema dosa (small portion)",
      ],
      lunch: [
        "Brown rice (small portion) + fish curry + vegetable poriyal",
        "Brown rice + chicken chettinad (light) + curd",
        "Fish moilee + brown rice (small portion)",
        "Brown rice + egg curry + poriyal",
        "Chicken curry + millet rice + salad",
      ],
      snack: [
        "Boiled eggs",
        "Grilled fish strips",
        "Roasted peanuts",
        "Buttermilk",
      ],
      dinner: [
        "Grilled fish + vegetable stir-fry",
        "Egg curry + 1 idli",
        "Fish moilee (light) + salad",
        "Chicken soup + steamed vegetables",
      ],
    },
  },
  east: {
    veg: {
      breakfast: [
        "Vegetable poha",
        "Vegetable dalia (broken wheat porridge)",
        "Luchi (1-2, light oil) + aloo sabzi",
        "Chirer pulao (flattened rice pulao)",
        "Vegetable khichuri (light)",
        "Sattu paratha (light oil)",
      ],
      lunch: [
        "Brown rice (small portion) + dal + shukto (mixed veg)",
        "Brown rice + cholar dal + vegetable curry",
        "Brown rice + dal + posto (poppy seed) vegetable",
        "Khichuri + labra (mixed vegetable) + salad",
        "Brown rice + dal + begun bhaja (light) + salad",
      ],
      snack: [
        "Roasted chana",
        "Seasonal fruit",
        "Muri (puffed rice) chaat",
        "Steamed corn",
        "Roasted makhana",
      ],
      dinner: [
        "Light vegetable curry + 1 roti + salad",
        "Vegetable khichuri (light)",
        "Dalia + mixed vegetables",
        "Light dal soup + 1 roti",
        "Steamed vegetables + small portion rice",
      ],
    },
    non_veg: {
      breakfast: [
        "Egg omelette + roti",
        "Boiled eggs + chirer pulao",
        "Egg curry (light) + 1 luchi",
        "Egg paratha",
      ],
      lunch: [
        "Brown rice (small portion) + fish curry + vegetables",
        "Brown rice + machher jhol (light fish curry) + salad",
        "Brown rice + chicken curry + shukto",
        "Brown rice + egg curry + vegetables",
      ],
      snack: [
        "Boiled eggs",
        "Roasted fish strips",
        "Roasted nuts",
      ],
      dinner: [
        "Light fish curry + sauteed greens",
        "Egg curry (light) + salad",
        "Chicken soup + steamed vegetables",
        "Grilled fish + vegetables",
      ],
    },
  },
  west: {
    veg: {
      breakfast: [
        "Besan chilla",
        "Moong dal cheela",
        "Vegetable thepla (light oil)",
        "Handvo (steamed, light oil)",
        "Khakra with vegetable raita",
        "Vegetable dhokla (steamed)",
      ],
      lunch: [
        "Bajra roti + dal + sabzi + salad",
        "Bajra roti + gujarati kadhi (light) + sabzi",
        "Jowar roti + dal + bhindi sabzi",
        "Bajra roti + chana sabzi + salad",
        "Vegetable khichdi + kadhi (light) + salad",
      ],
      snack: [
        "Roasted chana / sprouts salad",
        "Seasonal fruit",
        "Steamed dhokla (small portion)",
        "Roasted makhana",
        "Buttermilk (chaas)",
      ],
      dinner: [
        "Vegetable khichdi + kadhi (light) + salad",
        "Jowar roti + light sabzi + salad",
        "Vegetable soup + khakra",
        "Moong dal khichdi + curd",
        "Light vegetable curry + 1 bajra roti",
      ],
    },
    non_veg: {
      breakfast: [
        "Egg bhurji + bajra roti",
        "Boiled eggs + thepla",
        "Egg white omelette + khakra",
        "Chicken keema (small) + 1 roti",
      ],
      lunch: [
        "Bajra roti + chicken curry + salad",
        "Jowar roti + egg curry + salad",
        "Grilled chicken + dal + salad",
        "Bajra roti + mutton curry (small portion) + salad",
      ],
      snack: [
        "Boiled eggs / nuts",
        "Roasted chicken strips",
        "Clear chicken soup",
      ],
      dinner: [
        "Grilled chicken + sauteed vegetables",
        "Egg curry (light) + salad",
        "Chicken soup + steamed vegetables",
        "Grilled fish + vegetables",
      ],
    },
  },
};

// A day-rotated pick per meal slot, within whichever region/food
// preference the profile resolves to. Each slot uses a different salt so
// breakfast/lunch/snack/dinner don't all land on the same pool index
// every day (which, with equal-length pools, would otherwise make the
// four meals change in lockstep and still feel repetitive).
function getBaseDiet(foodPreference = "veg", region = "north", dateStr) {
  const regionDiets = REGIONAL_DIETS[region] || REGIONAL_DIETS.north;
  const pref = foodPreference === "non_veg" ? "non_veg" : "veg";
  const meals = regionDiets[pref];
  const date = dateStr || new Date().toISOString().slice(0, 10);

  return {
    breakfast: pickVariant(meals.breakfast, date, 0),
    lunch: pickVariant(meals.lunch, date, 2),
    snack: pickVariant(meals.snack, date, 5),
    dinner: pickVariant(meals.dinner, date, 9),
  };
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
  const dayIndex = dayIndexFor(dateStr);
  return list[((dayIndex % list.length) + list.length) % list.length];
}

module.exports = { REGIONAL_DIETS, getBaseDiet, pickRegionForDate };
