import { Router } from "express";
import { z } from "zod";
import { uuid } from "../../db.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validateBody } from "../../middleware/validate.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
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

  r.get(
    "/",
    authenticate(db),
    authorize("agent", "admin"),
    asyncHandler(async (req, res) => {
      ok(res, (await db.query(`SELECT * FROM teams ORDER BY name`)).rows);
    })
  );

  r.post(
    "/",
    authenticate(db),
    authorize("admin"),
    validateBody(createTeamSchema),
    asyncHandler(async (req, res) => {
      const id = uuid();
      await db.query(`INSERT INTO teams (id, name, description, lead_id) VALUES (?, ?, ?, ?)`, [
        id,
        req.validBody.name.trim(),
        req.validBody.description ?? null,
        req.validBody.lead_id ?? null,
      ]);
      await insertAudit(db, { entity_type: "team", entity_id: id, action: "created", actor_id: req.user.id });
      ok(res, { id }, {}, 201);
    })
  );

  r.get(
    "/:id",
    authenticate(db),
    authorize("agent", "admin"),
    asyncHandler(async (req, res) => {
      const team = (await db.query(`SELECT * FROM teams WHERE id = ?`, [req.params.id])).rows[0];
      if (!team) return fail(res, 404, "NOT_FOUND", "Team not found");
      const members = (
        await db.query(
          `SELECT u.id, u.email, u.full_name FROM team_members m JOIN users u ON u.id = m.user_id WHERE m.team_id = ?`,
          [req.params.id]
        )
      ).rows;
      ok(res, { ...team, members });
    })
  );

  r.patch(
    "/:id",
    authenticate(db),
    authorize("admin"),
    validateBody(patchTeamSchema),
    asyncHandler(async (req, res) => {
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
      updates.push("updated_at = NOW()");
      vals.push(req.params.id);
      const info = await db.query(`UPDATE teams SET ${updates.join(", ")} WHERE id = ?`, vals);
      if (info.rowCount === 0) return fail(res, 404, "NOT_FOUND", "Team not found");
      ok(res, { updated: true });
    })
  );

  r.delete(
    "/:id",
    authenticate(db),
    authorize("admin"),
    asyncHandler(async (req, res) => {
      const open = (
        await db.query(
          `SELECT COUNT(*)::int AS c FROM tickets WHERE team_id = ? AND deleted_at IS NULL AND status NOT IN ('resolved','closed')`,
          [req.params.id]
        )
      ).rows[0].c;
      if (open > 0) return fail(res, 400, "TEAM_HAS_TICKETS", "Team has active tickets");
      await db.query(`UPDATE tickets SET team_id = NULL WHERE team_id = ?`, [req.params.id]);
      await db.query(`DELETE FROM team_members WHERE team_id = ?`, [req.params.id]);
      await db.query(`DELETE FROM teams WHERE id = ?`, [req.params.id]);
      ok(res, { deleted: true });
    })
  );

  r.get(
    "/:id/members",
    authenticate(db),
    authorize("agent", "admin"),
    asyncHandler(async (req, res) => {
      const rows = (
        await db.query(
          `SELECT u.id, u.email, u.full_name, m.joined_at FROM team_members m JOIN users u ON u.id = m.user_id WHERE m.team_id = ?`,
          [req.params.id]
        )
      ).rows;
      ok(res, rows);
    })
  );

  const memberSchema = z.object({ user_id: z.string().uuid() });

  r.post(
    "/:id/members",
    authenticate(db),
    authorize("admin"),
    validateBody(memberSchema),
    asyncHandler(async (req, res) => {
      await db.query(
        `INSERT INTO team_members (team_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING`,
        [req.params.id, req.validBody.user_id]
      );
      ok(res, { added: true });
    })
  );

  r.delete(
    "/:id/members/:uid",
    authenticate(db),
    authorize("admin"),
    asyncHandler(async (req, res) => {
      await db.query(`DELETE FROM team_members WHERE team_id = ? AND user_id = ?`, [req.params.id, req.params.uid]);
      ok(res, { removed: true });
    })
  );

  return r;
}
