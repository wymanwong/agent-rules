import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validateBody } from "../../middleware/validate.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { ok, fail } from "../../shared/response.js";
import { parseJson } from "../../shared/json.js";

const schemaPut = z.object({
  form_schema: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      type: z.enum(["text", "textarea", "select", "number"]),
      required: z.boolean().optional(),
      options: z.array(z.string()).optional(),
    })
  ),
});

export function categoriesRouter(db) {
  const r = Router();

  r.get(
    "/",
    authenticate(db),
    asyncHandler(async (req, res) => {
      const rows = (
        await db.query(`SELECT id, name, slug, description, form_schema FROM ticket_categories ORDER BY name`)
      ).rows;
      ok(
        res,
        rows.map((row) => ({ ...row, form_schema: parseJson(row.form_schema, []) }))
      );
    })
  );

  r.put(
    "/:id/schema",
    authenticate(db),
    authorize("agent", "admin"),
    validateBody(schemaPut),
    asyncHandler(async (req, res) => {
      const rup = await db.query(`UPDATE ticket_categories SET form_schema = ?, updated_at = NOW() WHERE id = ?`, [
        JSON.stringify(req.validBody.form_schema),
        req.params.id,
      ]);
      if (rup.rowCount === 0) return fail(res, 404, "NOT_FOUND", "Category not found");
      ok(res, { saved: true });
    })
  );

  return r;
}
