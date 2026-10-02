const express = require("express");
const cors = require("cors");
require("dotenv").config();

const routes = require("./routes");

const app = express();

app.use(cors()); // mobile app has no fixed origin, so allow all for local dev
// Default limit is 100kb, which a base64-encoded profile photo blows past
// easily - raised so photo uploads from the camera/gallery picker succeed.
app.use(express.json({ limit: "15mb" }));

// Logs every incoming request. If you tap something in the app and nothing
// shows up here, the request never reached this server - that means the
// problem is network/Wi-Fi (a proxy, firewall, or the phone being on a
// different network), not this backend's code.
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  next();
});

app.use("/api/v1", routes);

// If a request reaches here, no route matched - still useful to see.
app.use((req, res) => {
  res.status(404).json({ success: false, message: `No route for ${req.method} ${req.originalUrl}` });
});

module.exports = app;