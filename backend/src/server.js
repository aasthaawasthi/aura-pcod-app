const app = require("./app");

// 5000 is deliberately avoided: on modern macOS, Apple's AirPlay Receiver
// service claims port 5000 by default and answers external requests with
// "403 Forbidden" before they ever reach this app - a well-known gotcha for
// local dev servers on Mac. 4000 sidesteps it entirely.
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});