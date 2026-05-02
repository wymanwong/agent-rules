import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { authRouter } from "./modules/auth/auth.router.js";
import { ticketsRouter } from "./modules/tickets/tickets.router.js";
import { usersRouter } from "./modules/users/users.router.js";
import { teamsRouter } from "./modules/teams/teams.router.js";
import { slaRouter } from "./modules/sla/sla.router.js";
import { kbRouter } from "./modules/kb/kb.router.js";
import { notificationsRouter } from "./modules/notifications/notifications.router.js";
import { reportsRouter } from "./modules/reports/reports.router.js";
import { categoriesRouter } from "./modules/categories/categories.router.js";
import { ok } from "./shared/response.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp(db) {
  const app = express();
  const started = Date.now();

  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_req, res) => {
    ok(res, { status: "ok", uptime_ms: Date.now() - started });
  });

  app.get("/api/v1/health", (_req, res) => {
    ok(res, { status: "ok", uptime_ms: Date.now() - started });
  });

  app.get("/api/v1/health/ready", (_req, res) => {
    try {
      db.prepare(`SELECT 1`).get();
      ok(res, { status: "ready", database: "sqlite" });
    } catch {
      res.status(503).json({ success: false, error: { code: "NOT_READY", message: "Database unavailable" } });
    }
  });

  const v1 = express.Router();
  v1.use("/auth", authRouter(db));
  v1.use("/ticket-categories", categoriesRouter(db));
  v1.use("/users", usersRouter(db));
  v1.use("/teams", teamsRouter(db));
  v1.use("/sla", slaRouter(db));
  v1.use("/kb", kbRouter(db));
  v1.use("/notifications", notificationsRouter(db));
  v1.use("/reports", reportsRouter(db));
  v1.use("/tickets", ticketsRouter(db));

  app.use("/api/v1", v1);

  const publicDir = path.join(__dirname, "..", "public");
  app.use(express.static(publicDir));

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(publicDir, "index.html"));
  });

  return app;
}
