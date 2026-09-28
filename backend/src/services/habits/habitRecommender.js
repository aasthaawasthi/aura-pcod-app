// Turns a user's selected goals into a suggested daily habit checklist.
// Deliberately simple and rule-based (a lookup table, not a model) so it's
// easy to see exactly why a habit was suggested and to extend later.
//
// A couple of habits are always included regardless of goals (hydration,
// movement) since they benefit almost every PCOD-related goal; everything
// else is added only when a matching goal is selected.

const BASE_HABITS = [
  { name: "Drink 8 glasses of water", icon: "droplet" },
];

const GOAL_HABITS = {
  regular_cycle: [
    { name: "Log today's symptoms & cycle day", icon: "calendar" },
    { name: "30 min moderate exercise", icon: "dumbbell" },
  ],
  weight_loss: [
    { name: "30 min brisk walk", icon: "footprints" },
    { name: "Avoid sugary drinks", icon: "ban" },
  ],
  sleep_cycle: [
    { name: "Sleep by 11 PM", icon: "moon" },
    { name: "No screens 30 min before bed", icon: "phone-off" },
  ],
  facial_hair: [
    { name: "Spearmint tea", icon: "leaf" },
  ],
  hairfall: [
    { name: "Scalp oil massage", icon: "droplet" },
    { name: "Protein-rich meal today", icon: "nutrition" },
  ],
  skin_balance: [
    { name: "Cleanse & moisturize routine", icon: "sparkles" },
    { name: "Avoid dairy today", icon: "ban" },
  ],
  mood_mental_health: [
    { name: "5 min mindfulness / breathing", icon: "happy" },
    { name: "Journal one thing you're grateful for", icon: "book" },
  ],
  insulin_balance: [
    { name: "10 min walk after meals", icon: "footprints" },
    { name: "Avoid refined sugar", icon: "ban" },
  ],
  fertility: [
    { name: "Track ovulation signs", icon: "calendar" },
    { name: "Take folic acid / prenatal vitamin", icon: "medkit" },
  ],
  thyroid: [
    { name: "Take thyroid meds at the same time daily", icon: "alarm" },
    { name: "Iodine-rich food today", icon: "nutrition" },
  ],
  // Legacy value from before goals became multi-select - kept so old
  // profiles that still have "skin_hair" saved don't lose their habits.
  skin_hair: [
    { name: "Cleanse & moisturize routine", icon: "sparkles" },
  ],
};

// Returns a deduped list of { name, icon } habits for the given goals,
// always including the base habits. Order is stable so the checklist
// doesn't reshuffle every time it's regenerated.
function recommendHabitsForGoals(goals = []) {
  const byName = new Map();
  for (const h of BASE_HABITS) byName.set(h.name, h);
  for (const goal of goals) {
    for (const h of GOAL_HABITS[goal] || []) {
      if (!byName.has(h.name)) byName.set(h.name, h);
    }
  }
  return Array.from(byName.values());
}

module.exports = { recommendHabitsForGoals, GOAL_HABITS, BASE_HABITS };
