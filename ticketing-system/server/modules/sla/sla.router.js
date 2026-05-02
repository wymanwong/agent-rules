import { Router } from "express";
import { z } from "zod";
import { uuid } from "../../db.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validateBody } from "../../middleware/validate.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { ok, fail } from "../../shared/response.js";

const policySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "critical"]),
  response_time_minutes: z.number().int().positive(),
  resolution_time_minutes: z.number().int().positive(),
  business_hours_only: z.boolean().optional(),
  is_default: z.boolean().optional(),
});

export function slaRouter(db) {
  const r = Router();

  r.get(
    "/policies",
    authenticate(db),
    authorize("admin"),
    asyncHandler(async (req, res) => {
      ok(res, (await db.query(`SELECT * FROM sla_policies ORDER BY priority`)).rows);
    })
  );

  r.post(
    "/policies",
    authenticate(db),
    authorize("admin"),
    validateBody(policySchema),
    asyncHandler(async (req, res) => {
      const id = uuid();
      const dto = req.validBody;
      await db.query(
        `INSERT INTO sla_policies (id, name, description, priority, response_time_minutes, resolution_time_minutes, business_hours_only, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          dto.name,
          dto.description ?? null,
          dto.priority,
          dto.response_time_minutes,
          dto.resolution_time_minutes,
          dto.business_hours_only ?? false,
          dto.is_default ?? false,
        ]
      );
      ok(res, { id }, {}, 201);
    })
  );

  r.get(
    "/policies/:id",
    authenticate(db),
    authorize("admin"),
    asyncHandler(async (req, res) => {
      const row = (await db.query(`SELECT * FROM sla_policies WHERE id = ?`, [req.params.id])).rows[0];
      if (!row) return fail(res, 404, "NOT_FOUND", "Not found");
      ok(res, row);
    })
  );

  r.get(
    "/breaches",
    authenticate(db),
    authorize("admin"),
    asyncHandler(async (req, res) => {
      ok(res, (await db.query(`SELECT * FROM sla_escalation_events ORDER BY triggered_at DESC LIMIT 500`)).rows);
    })
  );

  r.get(
    "/report",
    authenticate(db),
    authorize("admin"),
    asyncHandler(async (req, res) => {
      const breached = (await db.query(`SELECT COUNT(*)::int AS c FROM tickets WHERE sla_resolution_breached = TRUE AND deleted_at IS NULL`)).rows[0].c;
      const total = (await db.query(`SELECT COUNT(*)::int AS c FROM tickets WHERE deleted_at IS NULL`)).rows[0].c;
      ok(res, {
        tickets_total: total,
        resolution_breached_count: breached,
        compliance_rate: total ? 1 - breached / total : 1,
      });
    })
  );

  return r;
}
