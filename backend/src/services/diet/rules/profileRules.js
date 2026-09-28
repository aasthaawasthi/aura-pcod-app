function applyProfileRules(diet, profileType) {
    let updated = { ...diet };

    if (profileType === "insulin_resistant") {
        updated.lunch = "2 roti + dal + sabzi (avoid rice)";
        updated.snack = "Nuts / roasted chana (low GI)";
    }

    return updated;
}

module.exports = { applyProfileRules };