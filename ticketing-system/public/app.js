const api = (path, opts = {}) =>
  fetch(path, {
    ...opts,
    headers: { "Content-Type": "application/json", ...opts.headers },
    credentials: "same-origin",
  }).then(async (r) => {
    const text = await r.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: text };
    }
    if (!r.ok) throw new Error(data.error || r.statusText);
    return data;
  });

let state = {
  user: null,
  view: "login",
  tickets: [],
  categories: [],
  users: [],
  selectedTicket: null,
  ticketDetail: null,
  error: "",
};

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function render() {
  const app = document.getElementById("app");
  if (!state.user) {
    app.innerHTML = "";
    app.append(loginView());
    return;
  }

  const isAgent = state.user.role === "agent" || state.user.role === "admin";
  app.innerHTML = "";
  const layout = el(`
    <div class="layout">
      <header class="top">
        <div class="brand">IT Helpdesk</div>
        <div class="row">
          <span class="muted">${escapeHtml(state.user.name)} (${state.user.role})</span>
          <button class="secondary" type="button" id="logout">Log out</button>
        </div>
      </header>
      <nav class="tabs" id="nav"></nav>
      <main id="main"></main>
    </div>
  `);
  app.append(layout);

  document.getElementById("logout").onclick = async () => {
    await api("/api/auth/logout", { method: "POST" });
    state.user = null;
    state.view = "login";
    render();
  };

  const nav = document.getElementById("nav");
  const tabs = [
    { id: "portal", label: "Self-service" },
    { id: "tickets", label: isAgent ? "All tickets" : "My tickets" },
  ];
  if (isAgent) tabs.push({ id: "forms", label: "Form customization" });
  for (const t of tabs) {
    const b = document.createElement("button");
    b.textContent = t.label;
    b.className = state.view === t.id ? "active" : "";
    b.onclick = () => {
      state.view = t.id;
      state.selectedTicket = null;
      state.ticketDetail = null;
      loadView().then(render);
    };
    nav.append(b);
  }

  const main = document.getElementById("main");
  if (state.view === "portal") main.append(portalView());
  else if (state.view === "tickets") main.append(ticketsView());
  else if (state.view === "forms" && isAgent) main.append(formsView());
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function loginView() {
  const wrap = el(`<div class="layout"><div class="card" style="max-width:400px;margin:3rem auto">
    <h2>Sign in</h2>
    <p class="muted" style="margin-top:0">Demo: admin@local.test / agent@local.test / user@local.test — password <code>demo123</code></p>
    <div id="err" class="error"></div>
    <label>Email</label>
    <input type="email" id="email" autocomplete="username" />
    <label>Password</label>
    <input type="password" id="pw" autocomplete="current-password" />
    <button class="primary" type="button" id="go">Sign in</button>
  </div></div>`);

  wrap.querySelector("#go").onclick = async () => {
    wrap.querySelector("#err").textContent = "";
    try {
      const { user } = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: wrap.querySelector("#email").value,
          password: wrap.querySelector("#pw").value,
        }),
      });
      state.user = user;
      state.view = user.role === "user" ? "portal" : "tickets";
      await loadView();
      render();
    } catch (e) {
      wrap.querySelector("#err").textContent = e.message;
    }
  };
  return wrap;
}

async function loadView() {
  state.error = "";
  try {
    if (state.user) {
      const path = state.user.role === "user" ? "/api/tickets" : "/api/tickets";
      const [cats, tix] = await Promise.all([api("/api/categories"), api(path)]);
      state.categories = cats;
      state.tickets = tix;
      if (state.user.role === "agent" || state.user.role === "admin") {
        state.users = await api("/api/users");
      }
      if (state.selectedTicket) {
        state.ticketDetail = await api(`/api/tickets/${state.selectedTicket}`);
      }
    }
  } catch (e) {
    state.error = e.message;
  }
}

function portalView() {
  const card = el(`<div class="card"><h2>Create a ticket (self-service)</h2>
    <div id="e" class="error"></div>
    <label>Category</label>
    <select id="cat"></select>
    <div id="dyn"></div>
    <label>Title</label>
    <input type="text" id="title" />
    <label>Description</label>
    <textarea id="desc"></textarea>
    <button class="primary" id="submit">Submit ticket</button>
    <p class="muted" style="margin-bottom:0">Fields below the category change per category (GLPI-style custom forms).</p>
  </div>`);

  const sel = card.querySelector("#cat");
  const dyn = card.querySelector("#dyn");

  function fillCategories() {
    sel.innerHTML = state.categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
  }

  function renderDynamicFields() {
    const id = Number(sel.value);
    const cat = state.categories.find((c) => c.id === id);
    dyn.innerHTML = "";
    if (!cat || !cat.form_schema?.length) return;
    for (const f of cat.form_schema) {
      const idAttr = `cf_${escapeHtml(f.id)}`;
      if (f.type === "textarea") {
        dyn.append(el(`<label>${escapeHtml(f.label)}${f.required ? " *" : ""}</label><textarea id="${idAttr}"></textarea>`));
      } else if (f.type === "select" && Array.isArray(f.options)) {
        const opts = f.options.map((o) => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join("");
        dyn.append(el(`<label>${escapeHtml(f.label)}${f.required ? " *" : ""}</label><select id="${idAttr}">${opts}</select>`));
      } else if (f.type === "number") {
        dyn.append(el(`<label>${escapeHtml(f.label)}${f.required ? " *" : ""}</label><input type="number" id="${idAttr}" />`));
      } else {
        dyn.append(el(`<label>${escapeHtml(f.label)}${f.required ? " *" : ""}</label><input type="text" id="${idAttr}" />`));
      }
    }
  }

  fillCategories();
  renderDynamicFields();
  sel.onchange = renderDynamicFields;

  card.querySelector("#submit").onclick = async () => {
    card.querySelector("#e").textContent = "";
    const cat = state.categories.find((c) => c.id === Number(sel.value));
    const custom_fields = {};
    if (cat?.form_schema) {
      for (const f of cat.form_schema) {
        const node = card.querySelector(`#cf_${CSS.escape(f.id)}`);
        if (node) custom_fields[f.id] = node.value;
      }
    }
    try {
      await api("/api/tickets", {
        method: "POST",
        body: JSON.stringify({
          title: card.querySelector("#title").value,
          description: card.querySelector("#desc").value,
          category_id: Number(sel.value),
          custom_fields,
        }),
      });
      card.querySelector("#title").value = "";
      card.querySelector("#desc").value = "";
      await loadView();
      state.view = "tickets";
      render();
    } catch (e) {
      card.querySelector("#e").textContent = e.message;
    }
  };

  return card;
}

function ticketsView() {
  if (state.selectedTicket && state.ticketDetail) {
    return ticketDetailView();
  }

  const wrap = el(`<div>
    <div id="err" class="error">${state.error ? escapeHtml(state.error) : ""}</div>
    <div class="card"><h2>Ticket queue</h2>
    <div class="table-wrap"><table><thead><tr>
      <th>#</th><th>Title</th><th>Category</th><th>Status</th><th>Priority</th>
      ${state.user.role !== "user" ? "<th>Requester</th>" : ""}
    </tr></thead><tbody id="tb"></tbody></table></div></div>
  </div>`);

  const tb = wrap.querySelector("#tb");
  for (const t of state.tickets) {
    const tr = document.createElement("tr");
    tr.style.cursor = "pointer";
    tr.innerHTML = `
      <td>${t.number}</td>
      <td>${escapeHtml(t.title)}</td>
      <td>${escapeHtml(t.category_name)}</td>
      <td><span class="badge ${t.status}">${t.status}</span></td>
      <td><span class="badge priority-${t.priority}">${t.priority}</span></td>
      ${state.user.role !== "user" ? `<td>${escapeHtml(t.requester_name || "")}</td>` : ""}
    `;
    tr.onclick = async () => {
      state.selectedTicket = t.id;
      await loadView();
      render();
    };
    tb.append(tr);
  }
  return wrap;
}

function ticketDetailView() {
  const { ticket, comments, history, children } = state.ticketDetail;
  const isAgent = state.user.role === "agent" || state.user.role === "admin";

  const wrap = el(`<div>
    <p><button class="secondary" type="button" id="back">← Back to list</button></p>
    <div class="card">
      <h2>#${ticket.number} — ${escapeHtml(ticket.title)}</h2>
      <p class="muted">Category: ${escapeHtml(ticket.category_name)} · Requester: ${escapeHtml(ticket.requester_name)}</p>
      <p>${escapeHtml(ticket.description || "").replace(/\n/g, "<br/>")}</p>
      ${Object.keys(ticket.custom_fields || {}).length ? `<p><strong>Custom fields</strong><pre class="muted" style="white-space:pre-wrap;margin:0.5rem 0">${escapeHtml(JSON.stringify(ticket.custom_fields, null, 2))}</pre></p>` : ""}
      ${children?.length ? `<p class="muted">Child tickets (split): ${children.map((c) => `#${c.number}`).join(", ")}</p>` : ""}
    </div>
    ${isAgent ? agentPanel(ticket) : ""}
    <div class="card"><h2>Comments</h2><div id="clist"></div>
      <label>Add comment</label>
      <textarea id="cbody"></textarea>
      ${isAgent ? `<div class="checkbox-row"><input type="checkbox" id="internal" /><label for="internal" style="margin:0">Internal note (not visible to requester)</label></div>` : ""}
      <button class="primary" id="addc">Post</button>
    </div>
    <div class="card"><h2>History</h2><div id="hist"></div></div>
  </div>`);

  wrap.querySelector("#back").onclick = () => {
    state.selectedTicket = null;
    state.ticketDetail = null;
    render();
  };

  const clist = wrap.querySelector("#clist");
  for (const c of comments) {
    clist.append(
      el(`<div style="margin-bottom:0.75rem;padding-bottom:0.75rem;border-bottom:1px solid var(--border)">
        <strong>${escapeHtml(c.user_name)}</strong> <span class="muted">${c.created_at}</span>
        ${c.is_internal ? ' <span class="badge pending">internal</span>' : ""}
        <div>${escapeHtml(c.body).replace(/\n/g, "<br/>")}</div>
      </div>`)
    );
  }

  const hist = wrap.querySelector("#hist");
  for (const h of history) {
    hist.append(
      el(`<div class="history-item"><strong>${escapeHtml(h.action)}</strong> ${h.detail ? "— " + escapeHtml(h.detail) : ""} <span class="muted">${h.created_at}</span></div>`)
    );
  }

  wrap.querySelector("#addc").onclick = async () => {
    const body = wrap.querySelector("#cbody").value;
    const is_internal = isAgent && wrap.querySelector("#internal")?.checked;
    await api(`/api/tickets/${ticket.id}/comments`, {
      method: "POST",
      body: JSON.stringify({ body, is_internal }),
    });
    state.ticketDetail = await api(`/api/tickets/${ticket.id}`);
    render();
  };

  if (isAgent) bindAgentPanel(wrap, ticket);

  return wrap;
}

function agentPanel(ticket) {
  const assigneeOpts = state.users
    .filter((u) => u.role === "agent" || u.role === "admin")
    .map((u) => `<option value="${u.id}" ${ticket.assignee_id === u.id ? "selected" : ""}>${escapeHtml(u.name)}</option>`)
    .join("");
  const statusOpts = ["new", "assigned", "pending", "resolved", "closed"]
    .map((s) => `<option value="${s}" ${ticket.status === s ? "selected" : ""}>${s}</option>`)
    .join("");
  const priOpts = ["low", "normal", "high", "critical"]
    .map((p) => `<option value="${p}" ${ticket.priority === p ? "selected" : ""}>${p}</option>`)
    .join("");
  const catOpts = state.categories.map((c) => `<option value="${c.id}" ${ticket.category_id === c.id ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join("");

  return `<div class="card"><h2>Agent actions</h2>
    <div class="row" style="margin-bottom:1rem;align-items:flex-end">
      <div style="flex:1;min-width:140px"><label>Status</label><select id="st">${statusOpts}</select></div>
      <div style="flex:1;min-width:140px"><label>Assignee</label><select id="as"><option value="">—</option>${assigneeOpts}</select></div>
      <div style="flex:1;min-width:120px"><label>Priority</label><select id="pr">${priOpts}</select></div>
      <button class="primary" type="button" id="saveTicket">Save</button>
    </div>
    <hr style="border:none;border-top:1px solid var(--border);margin:1rem 0" />
    <h3 style="margin:0 0 0.5rem;font-size:1rem">Split ticket</h3>
    <p class="muted" style="margin-top:0">Creates a linked child ticket (same requester / assignee).</p>
    <label>Child title</label><input type="text" id="splTitle" />
    <label>Child description (optional)</label><textarea id="splDesc"></textarea>
    <div class="checkbox-row"><input type="checkbox" id="splCopy" /><label for="splCopy" style="margin:0">Copy comments</label></div>
    <button class="secondary" type="button" id="btnSplit">Split</button>
    <hr style="border:none;border-top:1px solid var(--border);margin:1rem 0" />
    <h3 style="margin:0 0 0.5rem;font-size:1rem">Migrate category</h3>
    <p class="muted" style="margin-top:0">Move ticket to another category; custom fields are validated against the target form.</p>
    <label>New category</label><select id="migCat">${catOpts}</select>
    <label>Append to description (optional)</label><textarea id="migNote"></textarea>
    <button class="secondary" type="button" id="btnMig">Migrate</button>
  </div>`;
}

function bindAgentPanel(wrap, ticket) {
  wrap.querySelector("#saveTicket").onclick = async () => {
    const assigneeVal = wrap.querySelector("#as").value;
    await api(`/api/tickets/${ticket.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: wrap.querySelector("#st").value,
        assignee_id: assigneeVal === "" ? null : Number(assigneeVal),
        priority: wrap.querySelector("#pr").value,
      }),
    });
    await loadView();
    render();
  };

  wrap.querySelector("#btnSplit").onclick = async () => {
    const title = wrap.querySelector("#splTitle").value.trim();
    if (!title) return;
    const r = await api(`/api/tickets/${ticket.id}/split`, {
      method: "POST",
      body: JSON.stringify({
        title,
        description: wrap.querySelector("#splDesc").value,
        copy_comments: wrap.querySelector("#splCopy").checked,
      }),
    });
    state.selectedTicket = r.id;
    await loadView();
    render();
  };

  wrap.querySelector("#btnMig").onclick = async () => {
    const category_id = Number(wrap.querySelector("#migCat").value);
    await api(`/api/tickets/${ticket.id}/migrate`, {
      method: "POST",
      body: JSON.stringify({
        category_id,
        append_description: wrap.querySelector("#migNote").value || undefined,
      }),
    });
    await loadView();
    render();
  };
}

function formsView() {
  const card = el(`<div class="card"><h2>Category form customization</h2>
    <p class="muted">Edit JSON array of fields. Each field: <code>id</code>, <code>label</code>, <code>type</code> (<code>text</code>|<code>textarea</code>|<code>number</code>|<code>select</code>), <code>required</code> boolean, and for <code>select</code>: <code>options</code> string array.</p>
    <label>Category</label><select id="fcat"></select>
    <label>Form schema (JSON)</label>
    <textarea class="schema-editor" id="schema"></textarea>
    <div id="fe" class="error"></div>
    <button class="primary" id="fsave">Save schema</button>
  </div>`);

  const sel = card.querySelector("#fcat");
  sel.innerHTML = state.categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");

  function loadSchema() {
    const c = state.categories.find((x) => x.id === Number(sel.value));
    card.querySelector("#schema").value = JSON.stringify(c?.form_schema || [], null, 2);
  }
  loadSchema();
  sel.onchange = loadSchema;

  card.querySelector("#fsave").onclick = async () => {
    card.querySelector("#fe").textContent = "";
    let form_schema;
    try {
      form_schema = JSON.parse(card.querySelector("#schema").value);
    } catch {
      card.querySelector("#fe").textContent = "Invalid JSON";
      return;
    }
    try {
      await api(`/api/categories/${sel.value}/schema`, {
        method: "PUT",
        body: JSON.stringify({ form_schema }),
      });
      state.categories = await api("/api/categories");
      loadSchema();
      card.querySelector("#fe").textContent = "Saved.";
      card.querySelector("#fe").className = "muted";
    } catch (e) {
      card.querySelector("#fe").textContent = e.message;
      card.querySelector("#fe").className = "error";
    }
  };

  return card;
}

async function boot() {
  try {
    const { user } = await api("/api/auth/me");
    state.user = user;
    if (user) state.view = user.role === "user" ? "portal" : "tickets";
    await loadView();
  } catch {
    state.user = null;
  }
  render();
}

boot();
