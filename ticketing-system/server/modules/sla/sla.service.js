/** Apply default SLA policy for ticket priority (SQLite dev — wall-clock minutes). */

export function pickPolicy(db, priority) {
  return db.prepare(`SELECT * FROM sla_policies WHERE priority = ? LIMIT 1`).get(priority);
}

export function computeDueDates(policy, now = new Date()) {
  const base = now.getTime();
  const resp = new Date(base + policy.response_time_minutes * 60 * 1000).toISOString();
  const res = new Date(base + policy.resolution_time_minutes * 60 * 1000).toISOString();
  return { sla_response_due_at: resp, sla_resolution_due_at: res };
}

export function applySlaToTicket(db, ticketId, priority) {
  const policy = pickPolicy(db, priority);
  if (!policy) return;
  const due = computeDueDates(policy);
  db.prepare(
    `UPDATE tickets SET sla_policy_id = ?, sla_response_due_at = ?, sla_resolution_due_at = ?,
     sla_response_breached = 0, sla_resolution_breached = 0, updated_at = datetime('now')
     WHERE id = ?`
  ).run(policy.id, due.sla_response_due_at, due.sla_resolution_due_at, ticketId);
}
