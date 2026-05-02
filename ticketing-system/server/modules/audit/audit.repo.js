import { uuid } from "../../db.js";

export async function insertAudit(db, { entity_type, entity_id, action, actor_id, actor_ip, changes, metadata }) {
  await db.query(
    `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_id, actor_ip, changes, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb)`,
    [
      uuid(),
      entity_type,
      entity_id,
      action,
      actor_id ?? null,
      actor_ip ?? null,
      changes != null ? JSON.stringify(changes) : null,
      JSON.stringify(metadata ?? {}),
    ]
  );
}
