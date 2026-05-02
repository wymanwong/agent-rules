/** Spec Part 05 — controlled transitions */

const AGENT_ROLES = new Set(["agent", "admin"]);

export function canTransition({ from, to, actorRole, ticket }) {
  if (from === to) return { ok: true };

  const map = {
    open: {
      in_progress: AGENT_ROLES,
      resolved: AGENT_ROLES,
    },
    in_progress: {
      pending: AGENT_ROLES,
      resolved: AGENT_ROLES,
    },
    pending: {
      in_progress: AGENT_ROLES,
      closed: new Set(["agent", "admin", "end_user"]),
    },
    resolved: {
      closed: new Set(["agent", "admin", "end_user"]),
      open: new Set(["agent", "admin", "end_user"]),
    },
    closed: {
      open: AGENT_ROLES,
    },
  };

  const allowedRoles = map[from]?.[to];
  if (!allowedRoles) {
    return { ok: false, message: `Illegal transition ${from} → ${to}` };
  }
  if (!allowedRoles.has(actorRole)) {
    return { ok: false, message: `Role cannot perform ${from} → ${to}` };
  }

    if (actorRole === "end_user") {
      if (ticket.requester_id !== ticket.actor_id) {
        return { ok: false, message: "End users may only change their own tickets" };
      }
      if (from === "resolved" && to === "open") {
        return { ok: true };
      }
      if (from === "pending" && to === "closed") {
        return { ok: true };
      }
      if (from === "resolved" && to === "closed") {
        return { ok: true };
      }
      return { ok: false, message: "End user cannot perform this transition" };
    }

  return { ok: true };
}
