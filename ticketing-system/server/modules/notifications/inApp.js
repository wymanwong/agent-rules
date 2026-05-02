import { uuid } from "../../db.js";

export function notify(db, { recipient_id, type, title, body, payload, reference_type, reference_id }) {
  db.prepare(
    `INSERT INTO notifications (id, recipient_id, type, channel, title, body, payload, reference_type, reference_id, sent_at)
     VALUES (?, ?, ?, 'in_app', ?, ?, ?, ?, ?, datetime('now'))`
  ).run(
    uuid(),
    recipient_id,
    type,
    title ?? null,
    body ?? null,
    JSON.stringify(payload ?? {}),
    reference_type ?? null,
    reference_id ?? null
  );
}
