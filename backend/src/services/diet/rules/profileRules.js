// PCOD profile-type diet tweaks. Overrides rotate through a small pool of
// realistic options by calendar date (pickVariant, see ../utils.js) so
// an insulin-resistant user doesn't see the exact same lunch/snack text
// every single day - still a plain static array lookup, no added cost.
const { pickVariant } = require("../utils");

function applyProfileRules(diet, profileType, dateStr) {
  let updated = { ...diet };
  const date = dateStr || new Date().toISOString().slice(0, 10);

  if (profileType === "insulin_resistant") {
    updated.lunch = pickVariant(
      [
        "2 roti + dal + sabzi (avoid rice)",
        "2 jowar roti + dal + bhindi sabzi",
        "Millet khichdi + salad (avoid white rice)",
        "2 bajra roti + dal + lauki sabzi",
        "Quinoa pulao + dal + salad",
      ],
      date,
      40
    );
    updated.snack = pickVariant(
      ["Nuts / roasted chana (low GI)", "Roasted makhana (low GI)", "Cucumber sticks + hummus (low GI)", "Sprouts chaat (low GI)"],
      date,
      41
    );
  }

  return updated;
}

module.exports = { applyProfileRules };
