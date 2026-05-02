import { Router } from "express";
import { z } from "zod";
import { uuid } from "../../db.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validateBody } from "../../middleware/validate.js";
import { ok, fail } from "../../shared/response.js";
import { insertAudit } from "../audit/audit.repo.js";

const createTeamSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  lead_id: z.string().uuid().nullable().optional(),
});

const patchTeamSchema = createTeamSchema.partial();

export function teamsRouter(db) {
  const r = Router();

  r.get("/", authenticate(db), authorize("agent", "admin"), (req, res) => {
    const rows = db.prepare(`SELECT * FROM teams ORDER BY name`).all();
    ok(res, rows);
  });

  r.post("/", authenticate(db), authorize("admin"), validateBody(createTeamSchema), (req, res) => {
    const id = uuid();
    db.prepare(`INSERT INTO teams (id, name, description, lead_id) VALUES (?, ?, ?, ?)`).run(
      id,
      req.validBody.name.trim(),
      req.validBody.description ?? null,
      req.validBody.lead_id ?? null
    );
    insertAudit(db, { entity_type: "team", entity_id: id, action: "created", actor_id: req.user.id });
    ok(res, { id }, {}, 201);
  });

  r.get("/:id", authenticate(db), authorize("agent", "admin"), (req, res) => {
    const team = db.prepare(`SELECT * FROM teams WHERE id = ?`).get(req.params.id);
    if (!team) return fail(res, 404, "NOT_FOUND", "Team not found");
    const members = db
      .prepare(`SELECT u.id, u.email, u.full_name FROM team_members m JOIN users u ON u.id = m.user_id WHERE m.team_id = ?`)
      .all(req.params.id);
    ok(res, { ...team, members });
  });

  r.patch("/:id", authenticate(db), authorize("admin"), validateBody(patchTeamSchema), (req, res) => {
    const dto = req.validBody;
    const updates = [];
    const vals = [];
    if (dto.name !== undefined) {
      updates.push("name = ?");
      vals.push(dto.name);
    }
    if (dto.description !== undefined) {
      updates.push("description = ?");
      vals.push(dto.description);
    }
    if (dto.lead_id !== undefined) {
      updates.push("lead_id = ?");
      vals.push(dto.lead_id);
    }
    if (!updates.length) return ok(res, { updated: false });
    updates.push("updated_at = datetime('now')");
    vals.push(req.params.id);
    const info = db.prepare(`UPDATE teams SET ${updates.join(", ")} WHERE id = ?`).run(...vals);
    if (info.changes === 0) return fail(res, 404, "NOT_FOUND", "Team not found");
    ok(res, { updated: true });
  });

  r.delete("/:id", authenticate(db), authorize("admin"), (req, res) => {
    const open = db
      .prepare(`SELECT COUNT(*) AS c FROM tickets WHERE team_id = ? AND deleted_at IS NULL AND status NOT IN ('resolved','closed')`)
      .get(req.params.id).c;
    if (open > 0) return fail(res, 400, "TEAM_HAS_TICKETS", "Team has active tickets");
    db.prepare(`UPDATE tickets SET team_id = NULL WHERE team_id = ?`).run(req.params.id);
    db.prepare(`DELETE FROM team_members WHERE team_id = ?`).run(req.params.id);
    db.prepare(`DELETE FROM teams WHERE id = ?`).run(req.params.id);
    ok(res, { deleted: true });
  });

  r.get("/:id/members", authenticate(db), authorize("agent", "admin"), (req, res) => {
    const rows = db
      .prepare(
        `SELECT u.id, u.email, u.full_name, m.joined_at FROM team_members m JOIN users u ON u.id = m.user_id WHERE m.team_id = ?`
      )
      .all(req.params.id);
    ok(res, rows);
  });

  const memberSchema = z.object({ user_id: z.string().uuid() });

  r.post("/:id/members", authenticate(db), authorize("admin"), validateBody(memberSchema), (req, res) => {
    db.prepare(`INSERT OR IGNORE INTO team_members (team_id, user_id) VALUES (?, ?)`).run(req.params.id, req.validBody.user_id);
    ok(res, { added: true });
  });

  r.delete("/:id/members/:uid", authenticate(db), authorize("admin"), (req, res) => {
    db.prepare(`DELETE FROM team_members WHERE team_id = ? AND user_id = ?`).run(req.params.id, req.params.uid);
    ok(res, { removed: true });
  });

  return r;
}
