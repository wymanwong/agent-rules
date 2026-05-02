import { uuid } from "../../db.js";

export function insertAudit(db, { entity_type, entity_id, action, actor_id, actor_ip, changes, metadata }) {
  db.prepare(
    `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_id, actor_ip, changes, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    uuid(),
    entity_type,
    entity_id,
    action,
    actor_id ?? null,
    actor_ip ?? null,
    changes != null ? JSON.stringify(changes) : null,
    JSON.stringify(metadata ?? {})
  );
}
