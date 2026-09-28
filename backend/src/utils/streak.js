function calculateStreak(days) {
    let streak = 0;
    let currentDate = new Date();

    for (let day of days) {
        const logDate = new Date(day.log_date);

        if (logDate.toDateString() !== currentDate.toDateString()) {
            break;
        }

        if (day.completed_count < 1) {
            break;
        }

        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
    }

    return streak;
}