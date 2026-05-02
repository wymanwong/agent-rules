import { uuid } from "../../db.js";

export async function notify(db, { recipient_id, type, title, body, payload, reference_type, reference_id }) {
  await db.query(
    `INSERT INTO notifications (id, recipient_id, type, channel, title, body, payload, reference_type, reference_id, sent_at)
     VALUES (?, ?, ?, 'in_app', ?, ?, ?::jsonb, ?, ?, NOW())`,
    [
      uuid(),
      recipient_id,
      type,
      title ?? null,
      body ?? null,
      JSON.stringify(payload ?? {}),
      reference_type ?? null,
      reference_id ?? null,
    ]
  );
}
