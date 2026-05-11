require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const ledRoutes = require("./routes/led");
const articleRoutes = require("./routes/articles");
const categoryRoutes = require("./routes/categories");

const app = express();

const HTTP_PORT = process.env.HTTP_PORT || 3000;

app.use(cors());
app.use(express.json());

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Neue API
app.use("/api/led", ledRoutes);
app.use("/api/articles", articleRoutes);
app.use("/api/categories", categoryRoutes);

// Kompatibilitaet fuer dein altes Frontend
app.use("/api", ledRoutes);

// React-Frontend ausliefern
const frontendDistPath = path.join(__dirname, "..", "frontend", "dist");

app.use(express.static(frontendDistPath));

app.get("*", (req, res) => {
  res.sendFile(path.join(frontendDistPath, "index.html"));
});

app.listen(HTTP_PORT, "0.0.0.0", () => {
  console.log(`Regalbeleuchtung-Webserver läuft auf Port ${HTTP_PORT}`);
  console.log(`Datenbank: ${process.env.DB_NAME || "regalbeleuchtung"}`);
  console.log(`Standard-Serial-Port: ${process.env.SERIAL_PORT || "/dev/ttyUSB0"}`);
  console.log(`Baudrate: ${process.env.BAUDRATE || 115200}`);
});
