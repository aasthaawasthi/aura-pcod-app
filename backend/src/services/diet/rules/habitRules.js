function applyHabitRules(diet, habitLogs) {
    let updated = { ...diet };

    const hydrationLogs = habitLogs.filter(h =>
        (h.habit_name || "").toLowerCase().includes("water") ||
        (h.habit_name || "").toLowerCase().includes("hydration")
    );
    const hydrationMissed =
        hydrationLogs.length > 0 &&
        hydrationLogs.slice(-2).every(h => !h.completed);

    if (hydrationMissed) {
        updated.snack = updated.snack + " + coconut water";
    }

    return updated;
}

module.exports = { applyHabitRules };