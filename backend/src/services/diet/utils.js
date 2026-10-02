function extractRecentSymptoms(dailyLogs) {
    const lastLogs = dailyLogs.slice(-2); // last 2 days

    const symptomSet = new Set();

    lastLogs.forEach(log => {
        (log.symptoms || []).forEach(s => symptomSet.add(s));
    });

    return Array.from(symptomSet);
}

// Turns a calendar date into a stable integer - the same trick used
// across the diet/exercise engines (pickRegionForDate, exerciseEngine's
// dayIndexFor) to get variety that's deterministic (same date always
// plans the same meal, which matters for grocery planning) without any
// per-request computation heavier than array indexing. No randomness, no
// external calls, no per-user state to store - this is what keeps meal
// planning cheap at any number of users.
function dayIndexFor(dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

// Picks one entry from `list` for a given date. `salt` offsets different
// slots/rules so they don't all rotate in lockstep (e.g. breakfast and
// dinner landing on the same list index every day, which would look just
// as repetitive as not rotating at all). A single string is passed
// through unchanged, so existing single-option rules don't need to be
// converted to a 1-item array just to keep working.
function pickVariant(list, dateStr, salt = 0) {
    if (!Array.isArray(list)) return list;
    if (list.length === 0) return undefined;
    const index = (dayIndexFor(dateStr) + salt) % list.length;
    return list[((index % list.length) + list.length) % list.length];
}

module.exports = {
    extractRecentSymptoms,
    dayIndexFor,
    pickVariant,
};