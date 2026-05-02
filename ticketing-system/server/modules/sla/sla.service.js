export async function pickPolicy(db, priority) {
  const r = await db.query(`SELECT * FROM sla_policies WHERE priority = ? LIMIT 1`, [priority]);
  return r.rows[0] ?? null;
}

export function computeDueDates(policy, now = new Date()) {
  const base = now.getTime();
  const resp = new Date(base + policy.response_time_minutes * 60 * 1000).toISOString();
  const res = new Date(base + policy.resolution_time_minutes * 60 * 1000).toISOString();
  return { sla_response_due_at: resp, sla_resolution_due_at: res };
}

export async function applySlaToTicket(db, ticketId, priority) {
  const policy = await pickPolicy(db, priority);
  if (!policy) return;
  const due = computeDueDates(policy);
  await db.query(
    `UPDATE tickets SET sla_policy_id = ?, sla_response_due_at = ?, sla_resolution_due_at = ?,
     sla_response_breached = FALSE, sla_resolution_breached = FALSE, updated_at = NOW()
     WHERE id = ?`,
    [policy.id, due.sla_response_due_at, due.sla_resolution_due_at, ticketId]
  );
}
