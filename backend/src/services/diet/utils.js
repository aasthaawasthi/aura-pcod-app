function extractRecentSymptoms(dailyLogs) {
    const lastLogs = dailyLogs.slice(-2); // last 2 days

    const symptomSet = new Set();

    lastLogs.forEach(log => {
        (log.symptoms || []).forEach(s => symptomSet.add(s));
    });

    return Array.from(symptomSet);
}

module.exports = {
    extractRecentSymptoms
};