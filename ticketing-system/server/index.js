import express from "express";
import session from "express-session";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { openDb } from "./db.js";
import { registerRoutes } from "./routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");
const dataDir = path.join(__dirname, "..", "data");

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const app = express();
const db = openDb();

app.use(express.json({ limit: "1mb" }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-ticketing-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: "lax" },
  })
);

registerRoutes(app, db);

app.use(express.static(publicDir));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(publicDir, "index.html"));
});

const port = Number(process.env.PORT) || 3840;
app.listen(port, () => {
  console.log(`IT Ticketing listening on http://localhost:${port}`);
});
