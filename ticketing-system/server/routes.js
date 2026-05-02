import bcrypt from "bcryptjs";

function parseJson(s, fallback) {
  try {
    return JSON.parse(s || "");
  } catch {
    return fallback;
  }
}

export function registerRoutes(app, db) {
  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(String(email).trim().toLowerCase());
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    req.session.userId = user.id;
    req.session.role = user.role;
    req.session.email = user.email;
    req.session.name = user.name;
    res.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  app.get("/api/auth/me", (req, res) => {
    if (!req.session.userId) return res.json({ user: null });
    res.json({
      user: {
        id: req.session.userId,
        email: req.session.email,
        name: req.session.name,
        role: req.session.role,
      },
    });
  });

  app.get("/api/categories", (req, res) => {
    const rows = db.prepare("SELECT id, name, slug, description, form_schema FROM categories ORDER BY name").all();
    res.json(
      rows.map((r) => ({
        ...r,
        form_schema: parseJson(r.form_schema, []),
      }))
    );
  });

  app.get("/api/categories/:id", (req, res) => {
    const r = db
      .prepare("SELECT id, name, slug, description, form_schema FROM categories WHERE id = ?")
      .get(req.params.id);
    if (!r) return res.status(404).json({ error: "Not found" });
    res.json({ ...r, form_schema: parseJson(r.form_schema, []) });
  });

  app.put("/api/categories/:id/schema", requireSession, requireAgent(), (req, res) => {
    const { form_schema } = req.body || {};
    if (!Array.isArray(form_schema)) return res.status(400).json({ error: "form_schema must be an array" });
    for (const f of form_schema) {
      if (!f.id || !f.label || !f.type) {
        return res.status(400).json({ error: "Each field needs id, label, type" });
      }
      if (!["text", "textarea", "select", "number"].includes(f.type)) {
        return res.status(400).json({ error: "Invalid field type" });
      }
    }
    const info = db
      .prepare("UPDATE categories SET form_schema = ? WHERE id = ?")
      .run(JSON.stringify(form_schema), req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  });

  app.get("/api/users", requireSession, requireAgent(), (req, res) => {
    const rows = db.prepare("SELECT id, email, name, role FROM users ORDER BY name").all();
    res.json(rows);
  });

  app.get("/api/tickets", requireSession, (req, res) => {
    const mine = req.query.mine === "1";
    const status = req.query.status;
    let sql = `
      SELECT t.*, c.name AS category_name, c.slug AS category_slug,
        rq.name AS requester_name, rq.email AS requester_email,
        ag.name AS assignee_name
      FROM tickets t
      JOIN categories c ON c.id = t.category_id
      JOIN users rq ON rq.id = t.requester_id
      LEFT JOIN users ag ON ag.id = t.assignee_id
      WHERE 1=1
    `;
    const params = [];
    if (req.session.role === "user") {
      sql += " AND t.requester_id = ?";
      params.push(req.session.userId);
    } else if (mine) {
      sql += " AND t.assignee_id = ?";
      params.push(req.session.userId);
    }
    if (status) {
      sql += " AND t.status = ?";
      params.push(status);
    }
    sql += " ORDER BY t.updated_at DESC";
    const rows = db.prepare(sql).all(...params);
    res.json(rows.map(serializeTicket));
  });

  app.get("/api/tickets/:id", requireSession, (req, res) => {
    const t = getTicket(db, req.params.id);
    if (!t) return res.status(404).json({ error: "Not found" });
    if (req.session.role === "user" && t.requester_id !== req.session.userId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const comments = db
      .prepare(
        `SELECT c.*, u.name AS user_name, u.email AS user_email
         FROM ticket_comments c JOIN users u ON u.id = c.user_id
         WHERE c.ticket_id = ?
         ORDER BY c.created_at ASC`
      )
      .all(t.id);

    const visibleComments = comments.filter((c) => {
      if (c.is_internal) return req.session.role === "agent" || req.session.role === "admin";
      return true;
    });

    const history = db
      .prepare(
        `SELECT h.*, u.name AS user_name
         FROM ticket_history h LEFT JOIN users u ON u.id = h.user_id
         WHERE h.ticket_id = ?
         ORDER BY h.created_at ASC`
      )
      .all(t.id);

    const children = db
      .prepare(
        `SELECT id, number, title, status FROM tickets WHERE parent_ticket_id = ? ORDER BY id`
      )
      .all(t.id);

    res.json({
      ticket: serializeTicket(t),
      comments: visibleComments,
      history,
      children,
    });
  });

  app.post("/api/tickets", requireSession, (req, res) => {
    const { title, description, category_id, priority, custom_fields } = req.body || {};
    if (!title || !category_id) return res.status(400).json({ error: "title and category_id required" });

    const cat = db.prepare("SELECT * FROM categories WHERE id = ?").get(category_id);
    if (!cat) return res.status(400).json({ error: "Invalid category" });

    const schema = parseJson(cat.form_schema, []);
    const cf = typeof custom_fields === "object" && custom_fields !== null ? custom_fields : {};
    const validation = validateCustomFields(schema, cf);
    if (!validation.ok) return res.status(400).json({ error: validation.message });

    const maxRow = db.prepare("SELECT COALESCE(MAX(number), 0) + 1 AS n FROM tickets").get();
    const number = maxRow.n;
    const requester_id = req.session.role === "user" ? req.session.userId : Number(req.body.requester_id) || req.session.userId;

    if (req.session.role === "user" && requester_id !== req.session.userId) {
      return res.status(403).json({ error: "Cannot create for another user" });
    }

    const pri = ["low", "normal", "high", "critical"].includes(priority) ? priority : "normal";
    const info = db
      .prepare(
        `INSERT INTO tickets (number, title, description, status, priority, category_id, requester_id, custom_fields)
         VALUES (?, ?, ?, 'new', ?, ?, ?, ?)`
      )
      .run(number, String(title).trim(), String(description || "").trim(), pri, category_id, requester_id, JSON.stringify(cf));

    const id = info.lastInsertRowid;
    logHistory(db, id, req.session.userId, "created", JSON.stringify({ number }));
    res.status(201).json({ id, number });
  });

  app.patch("/api/tickets/:id", requireSession, requireAgent(), (req, res) => {
    const t = getTicket(db, req.params.id);
    if (!t) return res.status(404).json({ error: "Not found" });

    const updates = [];
    const vals = [];

    if (req.body.status !== undefined) {
      if (!["new", "assigned", "pending", "resolved", "closed"].includes(req.body.status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      updates.push("status = ?");
      vals.push(req.body.status);
      logHistory(db, t.id, req.session.userId, "status", req.body.status);
    }
    if (req.body.assignee_id !== undefined) {
      updates.push("assignee_id = ?");
      vals.push(req.body.assignee_id === null ? null : Number(req.body.assignee_id));
      logHistory(db, t.id, req.session.userId, "assignee", String(req.body.assignee_id));
    }
    if (req.body.priority !== undefined) {
      if (!["low", "normal", "high", "critical"].includes(req.body.priority)) {
        return res.status(400).json({ error: "Invalid priority" });
      }
      updates.push("priority = ?");
      vals.push(req.body.priority);
      logHistory(db, t.id, req.session.userId, "priority", req.body.priority);
    }
    if (req.body.title !== undefined) {
      updates.push("title = ?");
      vals.push(String(req.body.title).trim());
    }
    if (req.body.description !== undefined) {
      updates.push("description = ?");
      vals.push(String(req.body.description));
    }

    if (updates.length === 0) return res.json({ ok: true });

    updates.push("updated_at = datetime('now')");
    vals.push(t.id);
    db.prepare(`UPDATE tickets SET ${updates.join(", ")} WHERE id = ?`).run(...vals);
    res.json({ ok: true });
  });

  /** Split: create child ticket(s) linked via parent_ticket_id; optional move description snippet */
  app.post("/api/tickets/:id/split", requireSession, requireAgent(), (req, res) => {
    const parent = getTicket(db, req.params.id);
    if (!parent) return res.status(404).json({ error: "Not found" });

    const { title, description, category_id, copy_comments } = req.body || {};
    if (!title) return res.status(400).json({ error: "title required for split child" });

    const catId = category_id ? Number(category_id) : parent.category_id;
    const cat = db.prepare("SELECT * FROM categories WHERE id = ?").get(catId);
    if (!cat) return res.status(400).json({ error: "Invalid category" });

    const maxRow = db.prepare("SELECT COALESCE(MAX(number), 0) + 1 AS n FROM tickets").get();
    const number = maxRow.n;
    const desc =
      String(description || "").trim() ||
      `(Split from ticket #${parent.number})\n\n${parent.description || ""}`.trim();

    const info = db
      .prepare(
        `INSERT INTO tickets (number, title, description, status, priority, category_id, requester_id, assignee_id, parent_ticket_id, custom_fields)
         VALUES (?, ?, ?, 'new', ?, ?, ?, ?, ?, ?)`
      )
      .run(
        number,
        String(title).trim(),
        desc,
        parent.priority,
        catId,
        parent.requester_id,
        parent.assignee_id,
        parent.id,
        parent.custom_fields
      );

    const childId = info.lastInsertRowid;
    logHistory(db, parent.id, req.session.userId, "split", JSON.stringify({ child_id: childId, number }));
    logHistory(db, childId, req.session.userId, "created_from_split", JSON.stringify({ parent_id: parent.id, parent_number: parent.number }));

    if (copy_comments) {
      const comments = db.prepare("SELECT user_id, body, is_internal FROM ticket_comments WHERE ticket_id = ?").all(parent.id);
      const ins = db.prepare(
        `INSERT INTO ticket_comments (ticket_id, user_id, body, is_internal) VALUES (?, ?, ?, ?)`
      );
      for (const c of comments) {
        ins.run(childId, c.user_id, `[Copied] ${c.body}`, c.is_internal);
      }
    }

    res.status(201).json({ id: childId, number });
  });

  /** Migrate: change category (and optionally merge custom fields); logs history */
  app.post("/api/tickets/:id/migrate", requireSession, requireAgent(), (req, res) => {
    const t = getTicket(db, req.params.id);
    if (!t) return res.status(404).json({ error: "Not found" });

    const { category_id, custom_fields, append_description } = req.body || {};
    if (!category_id) return res.status(400).json({ error: "category_id required" });

    const cat = db.prepare("SELECT * FROM categories WHERE id = ?").get(Number(category_id));
    if (!cat) return res.status(400).json({ error: "Invalid category" });

    const oldCat = db.prepare("SELECT name FROM categories WHERE id = ?").get(t.category_id);
    const schema = parseJson(cat.form_schema, []);
    let merged = parseJson(t.custom_fields, {});
    if (custom_fields && typeof custom_fields === "object") merged = { ...merged, ...custom_fields };
    const validation = validateCustomFields(schema, merged);
    if (!validation.ok) return res.status(400).json({ error: validation.message });

    let description = t.description;
    if (append_description) {
      description = `${t.description || ""}\n\n--- Migrated to ${cat.name} ---\n${String(append_description)}`.trim();
    }

    db.prepare(
      `UPDATE tickets SET category_id = ?, custom_fields = ?, description = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(Number(category_id), JSON.stringify(merged), description, t.id);

    logHistory(
      db,
      t.id,
      req.session.userId,
      "migrated",
      JSON.stringify({ from_category: oldCat?.name, to_category: cat.name, to_category_id: cat.id })
    );
    res.json({ ok: true });
  });

  app.post("/api/tickets/:id/comments", requireSession, (req, res) => {
    const t = getTicket(db, req.params.id);
    if (!t) return res.status(404).json({ error: "Not found" });
    if (req.session.role === "user" && t.requester_id !== req.session.userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { body, is_internal } = req.body || {};
    if (!body || !String(body).trim()) return res.status(400).json({ error: "body required" });

    const internal = (req.session.role === "agent" || req.session.role === "admin") && !!is_internal;
    db.prepare(`INSERT INTO ticket_comments (ticket_id, user_id, body, is_internal) VALUES (?, ?, ?, ?)`).run(
      t.id,
      req.session.userId,
      String(body).trim(),
      internal ? 1 : 0
    );
    db.prepare(`UPDATE tickets SET updated_at = datetime('now') WHERE id = ?`).run(t.id);
    res.status(201).json({ ok: true });
  });
}

function requireSession(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: "Unauthorized" });
  next();
}

function requireAgent() {
  return (req, res, next) => {
    if (req.session.role !== "agent" && req.session.role !== "admin") {
      return res.status(403).json({ error: "Agent or admin only" });
    }
    next();
  };
}

function getTicket(db, id) {
  return db
    .prepare(
      `SELECT t.*, c.name AS category_name, c.slug AS category_slug, c.form_schema AS category_form_schema,
        rq.name AS requester_name, ag.name AS assignee_name
       FROM tickets t
       JOIN categories c ON c.id = t.category_id
       JOIN users rq ON rq.id = t.requester_id
       LEFT JOIN users ag ON ag.id = t.assignee_id
       WHERE t.id = ?`
    )
    .get(id);
}

function serializeTicket(t) {
  if (!t) return null;
  return {
    ...t,
    custom_fields: parseJson(t.custom_fields, {}),
    category_form_schema: t.category_form_schema != null ? parseJson(t.category_form_schema, []) : [],
  };
}

function validateCustomFields(schema, values) {
  for (const f of schema) {
    const v = values[f.id];
    if (f.required && (v === undefined || v === null || String(v).trim() === "")) {
      return { ok: false, message: `Missing required field: ${f.label}` };
    }
    if (f.type === "number" && v !== undefined && v !== "" && Number.isNaN(Number(v))) {
      return { ok: false, message: `Invalid number: ${f.label}` };
    }
  }
  return { ok: true };
}

function logHistory(db, ticketId, userId, action, detail) {
  db.prepare(`INSERT INTO ticket_history (ticket_id, user_id, action, detail) VALUES (?, ?, ?, ?)`).run(
    ticketId,
    userId,
    action,
    detail
  );
}
