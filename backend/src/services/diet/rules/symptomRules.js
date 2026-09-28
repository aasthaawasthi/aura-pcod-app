function applySymptomRules(diet, symptoms) {
    let updated = { ...diet };

    if (symptoms.includes("fatigue")) {
        updated.breakfast = "Paneer chilla / protein-rich breakfast";
    }

    if (symptoms.includes("cravings")) {
        updated.snack = "Dates / dark chocolate (controlled portion)";
    }

    if (symptoms.includes("acne")) {
        updated.dinner = "Light veg dinner (avoid dairy)";
    }

    if (symptoms.includes("bloating")) {
        updated.dinner = "Khichdi / light meal";
    }

    return updated;
}

module.exports = { applySymptomRules };