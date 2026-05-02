const BASE = "/api/v1";

function lsGet(key) {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}
function lsSet(key, val) {
  try {
    localStorage.setItem(key, val);
  } catch {
    /* private mode / blocked storage */
  }
}
function lsRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

let accessToken = lsGet("accessToken");
let refreshToken = lsGet("refreshToken");

function hideBootStatic() {
  const b = document.getElementById("boot-static");
  if (b) b.hidden = true;
}

window.addEventListener("error", (e) => {
  const el = document.getElementById("boot-error");
  if (el && !el.textContent) el.textContent = e.message || String(e.error || "");
});

window.addEventListener("unhandledrejection", (e) => {
  const el = document.getElementById("boot-error");
  if (el && !el.textContent) el.textContent = e.reason?.message || String(e.reason || "");
});

async function api(path, opts = {}) {
  const headers = { "Content-Type": "application/json", ...opts.headers };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  let r = await fetch(`${BASE}${path}`, { ...opts, headers });

  if (r.status === 401 && refreshToken && !opts._retry) {
    try {
      const rr = await fetch(`${BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      const j = await rr.json();
      if (j.success && j.data?.accessToken) {
        accessToken = j.data.accessToken;
        refreshToken = j.data.refreshToken || refreshToken;
        lsSet("accessToken", accessToken);
        lsSet("refreshToken", refreshToken);
        return api(path, { ...opts, _retry: true });
      }
    } catch {
      /* fall through */
    }
    accessToken = "";
    refreshToken = "";
    lsRemove("accessToken");
    lsRemove("refreshToken");
  }

  const text = await r.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(text || r.statusText);
  }
  if (!data.success) {
    throw new Error(data.error?.message || data.error?.code || r.statusText);
  }
  return data.data;
}

let state = {
  user: null,
  view: "login",
  categories: [],
  tickets: [],
  meta: {},
  kbArticles: [],
  notifications: [],
  selectedTicketId: null,
  detail: null,
  error: "",
};

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function isStaff() {
  return state.user && (state.user.role === "agent" || state.user.role === "admin");
}

async function bootstrapUser() {
  if (!accessToken) {
    state.user = null;
    return;
  }
  try {
    state.user = (await api("/auth/me")).user;
  } catch {
    state.user = null;
    accessToken = "";
    refreshToken = "";
    lsRemove("accessToken");
    lsRemove("refreshToken");
  }
}

async function loadCategories() {
  state.categories = await api("/ticket-categories");
}

async function loadTickets() {
  const page = 1;
  const data = await api(`/tickets?page=${page}&per_page=50`);
  state.tickets = Array.isArray(data) ? data : [];
}

async function loadKb() {
  state.kbArticles = await api("/kb/articles");
}

async function loadNotifications() {
  state.notifications = await api("/notifications");
}

async function loadDetail(id) {
  state.detail = await api(`/tickets/${id}`);
}

function render() {
  const app = document.getElementById("app");
  if (!app) return;

  hideBootStatic();

  if (state.error && !state.user) {
    app.innerHTML = "";
    const wrap = el(`<div class="layout"><div class="card" style="max-width:520px;margin:2rem auto">
      <h2>Something went wrong</h2>
      <p class="error">${escapeHtml(state.error)}</p>
      <p class="muted">Make sure the API is running on the same host (e.g. open <code>http://localhost:3840/</code> not a different port).</p>
      <button class="primary" type="button" id="retryBoot">Retry</button>
    </div></div>`);
    wrap.querySelector("#retryBoot").onclick = () => {
      state.error = "";
      boot();
    };
    app.append(wrap);
    return;
  }

  if (!state.user) {
    app.innerHTML = "";
    app.append(loginView());
    return;
  }

  const layout = el(`<div class="layout">
    <header class="top">
      <div class="brand">IT Helpdesk <span class="muted" style="font-weight:400;font-size:0.85rem">/ api/v1</span></div>
      <div class="row">
        <span class="muted">${escapeHtml(state.user.full_name)} (${escapeHtml(state.user.role)})</span>
        <button class="secondary" type="button" id="logout">Log out</button>
      </div>
    </header>
    <nav class="tabs" id="nav"></nav>
    <main id="main"></main>
  </div>`);
  app.innerHTML = "";
  app.append(layout);

  document.getElementById("logout").onclick = async () => {
    try {
      await fetch(`${BASE}/auth/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: accessToken ? `Bearer ${accessToken}` : "",
        },
        body: JSON.stringify(refreshToken ? { refreshToken } : {}),
      });
    } catch {
      /* ignore */
    }
    accessToken = "";
    refreshToken = "";
    lsRemove("accessToken");
    lsRemove("refreshToken");
    state.user = null;
    state.view = "login";
    render();
  };

  const tabs = [
    { id: "portal", label: "Self-service" },
    { id: "tickets", label: state.user.role === "end_user" ? "My tickets" : "Tickets" },
    { id: "kb", label: "Knowledge base" },
    { id: "notifications", label: "Notifications" },
  ];
  if (isStaff()) tabs.push({ id: "forms", label: "Form customization" });
  if (state.user.role === "admin") tabs.push({ id: "reports", label: "Reports" });

  if (state.error) {
    const warn = el(`<div class="card" style="margin-bottom:1rem;border-color:var(--warn)"><p class="error" style="margin:0">${escapeHtml(state.error)}</p></div>`);
    layout.insertBefore(warn, layout.querySelector("nav.tabs"));
  }

  const nav = document.getElementById("nav");
  for (const t of tabs) {
    const b = document.createElement("button");
    b.textContent = t.label;
    b.className = state.view === t.id ? "active" : "";
    b.onclick = async () => {
      state.view = t.id;
      state.selectedTicketId = null;
      state.detail = null;
      await refreshViewData();
      render();
    };
    nav.append(b);
  }

  const main = document.getElementById("main");
  if (state.view === "portal") main.append(portalView());
  else if (state.view === "tickets") main.append(ticketsShell());
  else if (state.view === "kb") main.append(kbView());
  else if (state.view === "notifications") main.append(notificationsView());
  else if (state.view === "forms" && isStaff()) main.append(formsView());
  else if (state.view === "reports" && state.user.role === "admin") main.append(reportsView());
}

async function refreshViewData() {
  state.error = "";
  try {
    await loadCategories();
    if (state.view === "tickets" || state.view === "portal") await loadTickets();
    if (state.view === "kb") await loadKb();
    if (state.view === "notifications") await loadNotifications();
    if (state.selectedTicketId) await loadDetail(state.selectedTicketId);
  } catch (e) {
    state.error = e.message;
  }
}

function loginView() {
  const wrap = el(`<div class="layout"><div class="card" style="max-width:440px;margin:2rem auto">
    <h2>Sign in</h2>
    <p class="muted" style="margin-top:0">JWT + refresh (architecture §3). Demo password <code>demo123</code></p>
    <div id="err" class="error"></div>
    <label>Email</label><input type="email" id="email" />
    <label>Password</label><input type="password" id="pw" />
    <button class="primary" type="button" id="go">Sign in</button>
    <hr style="border:none;border-top:1px solid var(--border);margin:1rem 0" />
    <p class="muted" style="margin:0">No account? Register as end_user:</p>
    <label>Full name</label><input type="text" id="regName" placeholder="Jane Doe" />
    <button class="secondary" type="button" id="reg">Register</button>
  </div></div>`);

  wrap.querySelector("#go").onclick = async () => {
    wrap.querySelector("#err").textContent = "";
    try {
      const data = await fetch(`${BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: wrap.querySelector("#email").value,
          password: wrap.querySelector("#pw").value,
        }),
      }).then((r) => r.json());
      if (!data.success) throw new Error(data.error?.message || "Login failed");
      accessToken = data.data.accessToken;
      refreshToken = data.data.refreshToken;
      lsSet("accessToken", accessToken);
      lsSet("refreshToken", refreshToken);
      state.user = data.data.user;
      state.view = state.user.role === "end_user" ? "portal" : "tickets";
      await refreshViewData();
      render();
    } catch (e) {
      wrap.querySelector("#err").textContent = e.message;
    }
  };

  wrap.querySelector("#reg").onclick = async () => {
    wrap.querySelector("#err").textContent = "";
    try {
      const data = await fetch(`${BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: wrap.querySelector("#email").value,
          password: wrap.querySelector("#pw").value,
          full_name: wrap.querySelector("#regName").value || "New User",
        }),
      }).then((r) => r.json());
      if (!data.success) throw new Error(data.error?.message || "Register failed");
      accessToken = data.data.accessToken;
      refreshToken = data.data.refreshToken;
      lsSet("accessToken", accessToken);
      lsSet("refreshToken", refreshToken);
      state.user = data.data.user;
      state.view = "portal";
      await refreshViewData();
      render();
    } catch (e) {
      wrap.querySelector("#err").textContent = e.message;
    }
  };

  return wrap;
}

function portalView() {
  const card = el(`<div class="card"><h2>Create ticket</h2>
    <div id="e" class="error"></div>
    <label>Category (slug)</label><select id="cat"></select>
    <div id="dyn"></div>
    <label>Title</label><input type="text" id="title" />
    <label>Description</label><textarea id="desc"></textarea>
    <label>Priority</label><select id="pri"><option>low</option><option selected>medium</option><option>high</option><option>critical</option></select>
    <button class="primary" id="submit">Submit</button>
  </div>`);

  const sel = card.querySelector("#cat");
  const dyn = card.querySelector("#dyn");
  sel.innerHTML = state.categories.map((c) => `<option value="${escapeHtml(c.slug)}">${escapeHtml(c.name)}</option>`).join("");

  function dynFields() {
    dyn.innerHTML = "";
    const slug = sel.value;
    const cat = state.categories.find((c) => c.slug === slug);
    if (!cat?.form_schema?.length) return;
    for (const f of cat.form_schema) {
      const idAttr = `cf_${CSS.escape(f.id)}`;
      if (f.type === "textarea") {
        dyn.append(el(`<label>${escapeHtml(f.label)}${f.required ? " *" : ""}</label><textarea id="${idAttr}"></textarea>`));
      } else if (f.type === "select" && f.options?.length) {
        const opts = f.options.map((o) => `<option>${escapeHtml(o)}</option>`).join("");
        dyn.append(el(`<label>${escapeHtml(f.label)}</label><select id="${idAttr}">${opts}</select>`));
      } else if (f.type === "number") {
        dyn.append(el(`<label>${escapeHtml(f.label)}</label><input type="number" id="${idAttr}" />`));
      } else {
        dyn.append(el(`<label>${escapeHtml(f.label)}</label><input type="text" id="${idAttr}" />`));
      }
    }
  }
  dynFields();
  sel.onchange = dynFields;

  card.querySelector("#submit").onclick = async () => {
    card.querySelector("#e").textContent = "";
    const slug = sel.value;
    const cat = state.categories.find((c) => c.slug === slug);
    const metadata = {};
    if (cat?.form_schema) {
      for (const f of cat.form_schema) {
        const node = card.querySelector(`#cf_${CSS.escape(f.id)}`);
        if (node) metadata[f.id] = node.value;
      }
    }
    try {
      await api("/tickets", {
        method: "POST",
        body: JSON.stringify({
          title: card.querySelector("#title").value,
          description: card.querySelector("#desc").value,
          category: slug,
          priority: card.querySelector("#pri").value,
          metadata,
        }),
      });
      await loadTickets();
      state.view = "tickets";
      render();
    } catch (e) {
      card.querySelector("#e").textContent = e.message;
    }
  };
  return card;
}

function ticketsShell() {
  if (state.selectedTicketId && state.detail) return ticketDetailView();
  const wrap = el(`<div>
    ${state.error ? `<div class="error">${escapeHtml(state.error)}</div>` : ""}
    <div class="card"><h2>Tickets</h2>
    <table><thead><tr><th>#</th><th>Title</th><th>Status</th><th>Priority</th>${state.user.role !== "end_user" ? "<th>Requester</th>" : ""}</tr></thead><tbody id="tb"></tbody></table></div>
  </div>`);
  const tb = wrap.querySelector("#tb");
  for (const t of state.tickets) {
    const tr = document.createElement("tr");
    tr.style.cursor = "pointer";
    tr.innerHTML = `
      <td>${escapeHtml(t.ticket_display || "")}</td>
      <td>${escapeHtml(t.title)}</td>
      <td><span class="badge ${mapStatusClass(t.status)}">${escapeHtml(t.status)}</span></td>
      <td>${escapeHtml(t.priority)}</td>
      ${state.user.role !== "end_user" ? `<td class="muted">${escapeHtml(t.requester_name || "")}</td>` : ""}
    `;
    tr.onclick = async () => {
      state.selectedTicketId = t.id;
      await loadDetail(t.id);
      render();
    };
    tb.append(tr);
  }
  return wrap;
}

function mapStatusClass(st) {
  if (st === "open") return "new";
  if (st === "in_progress") return "assigned";
  if (st === "pending") return "pending";
  return "resolved";
}

function ticketDetailView() {
  const { ticket, comments, attachments, kb_links, children } = state.detail;
  const meta = ticket.metadata || {};

  const actions = isStaff()
    ? `<div class="card"><h2>Agent</h2>
      <div class="row" style="flex-wrap:wrap">
        <button class="secondary" id="toProg">→ in_progress</button>
        <button class="secondary" id="toPen">→ pending</button>
        <button class="secondary" id="toRes">→ resolved</button>
        <button class="secondary" id="close">Close</button>
        <button class="secondary" id="reopen">Reopen</button>
      </div>
      <hr style="border:none;border-top:1px solid var(--border);margin:1rem 0"/>
      <label>Assignee user id</label><input type="text" id="assignee" placeholder="uuid" />
      <button class="primary" id="btnAssign">Assign</button>
      <hr style="border:none;border-top:1px solid var(--border);margin:1rem 0"/>
      <h3 style="margin:0;font-size:1rem">Split</h3>
      <input type="text" id="splTitle" placeholder="Child title" />
      <label><input type="checkbox" id="splCopy"/> Copy comments</label>
      <button class="secondary" id="btnSplit">Split</button>
      <hr style="border:none;border-top:1px solid var(--border);margin:1rem 0"/>
      <h3 style="margin:0;font-size:1rem">Migrate category</h3>
      <select id="migCat">${state.categories.map((c) => `<option value="${escapeHtml(c.slug)}">${escapeHtml(c.name)}</option>`).join("")}</select>
      <textarea id="migNote" placeholder="Append to description"></textarea>
      <button class="secondary" id="btnMig">Migrate</button>
      <hr style="border:none;border-top:1px solid var(--border);margin:1rem 0"/>
      <h3 style="margin:0;font-size:1rem">Link KB article</h3>
      <input type="text" id="linkArt" placeholder="article uuid" />
      <button class="secondary" id="btnLink">Link</button>
      ${state.user.role === "admin" ? `<button class="secondary" id="delT" style="margin-top:1rem">Soft-delete ticket</button>` : ""}
    </div>`
    : `<div class="card"><h2>Actions</h2><button class="secondary" id="close">Close</button> <button class="secondary" id="reopen">Reopen</button></div>`;

  const slaBlock =
    isStaff() && ticket.sla_resolution_due_at
      ? `<p class="muted">SLA resolution due: ${escapeHtml(ticket.sla_resolution_due_at)}</p>`
      : "";

  const wrap = el(`<div>
    <p><button class="secondary" id="back">← List</button></p>
    <div class="card">
      <h2>${escapeHtml(ticket.ticket_display)} — ${escapeHtml(ticket.title)}</h2>
      <p class="muted">${escapeHtml(ticket.status)} · ${escapeHtml(ticket.priority)} · category: ${escapeHtml(ticket.category || "—")}</p>
      ${slaBlock}
      <div>${escapeHtml(ticket.description || "").replace(/\n/g, "<br/>")}</div>
      ${Object.keys(meta).length ? `<pre class="muted">${escapeHtml(JSON.stringify(meta, null, 2))}</pre>` : ""}
      ${children?.length ? `<p class="muted">Children: ${children.map((c) => c.ticket_number).join(", ")}</p>` : ""}
      ${kb_links?.length ? `<p class="muted">KB: ${kb_links.map((k) => escapeHtml(k.title)).join(", ")}</p>` : ""}
    </div>
    ${actions}
    <div class="card"><h2>Comments</h2><div id="clist"></div>
      <textarea id="cbody"></textarea>
      ${isStaff() ? `<label><input type="checkbox" id="internal"/> Internal</label>` : ""}
      <button class="primary" id="addc">Post</button></div>
    <div class="card"><h2>Attachments</h2><div id="alist"></div>
      <input type="file" id="file" /><button class="secondary" id="up">Upload</button></div>
  </div>`);

  wrap.querySelector("#back").onclick = () => {
    state.selectedTicketId = null;
    state.detail = null;
    render();
  };

  const clist = wrap.querySelector("#clist");
  for (const c of comments) {
    clist.append(el(`<div style="margin-bottom:0.75rem;border-bottom:1px solid var(--border);padding-bottom:0.5rem">
      <strong>${escapeHtml(c.author_name)}</strong> <span class="muted">${escapeHtml(c.created_at)}</span>
      ${c.is_internal ? '<span class="badge pending">internal</span>' : ""}
      <div>${escapeHtml(c.body).replace(/\n/g, "<br/>")}</div></div>`));
  }

  const alist = wrap.querySelector("#alist");
  for (const a of attachments || []) {
    alist.append(el(`<div class="muted">${escapeHtml(a.filename)} (${a.size_bytes} bytes)</div>`));
  }

  wrap.querySelector("#addc").onclick = async () => {
    await api(`/tickets/${ticket.id}/comments`, {
      method: "POST",
      body: JSON.stringify({
        body: wrap.querySelector("#cbody").value,
        is_internal: isStaff() && wrap.querySelector("#internal")?.checked,
      }),
    });
    await loadDetail(ticket.id);
    render();
  };

  wrap.querySelector("#up").onclick = async () => {
    const f = wrap.querySelector("#file").files[0];
    if (!f) return;
    const fd = new FormData();
    fd.append("file", f);
    const headers = {};
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    await fetch(`${BASE}/tickets/${ticket.id}/attachments`, { method: "POST", headers, body: fd });
    await loadDetail(ticket.id);
    render();
  };

  async function patchStatus(status) {
    await api(`/tickets/${ticket.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    await loadDetail(ticket.id);
    await loadTickets();
    render();
  }

  const btn = (id, fn) => {
    const n = wrap.querySelector(`#${id}`);
    if (n) n.onclick = fn;
  };

  btn("toProg", () => patchStatus("in_progress"));
  btn("toPen", () => patchStatus("pending"));
  btn("toRes", () => patchStatus("resolved"));
  btn("close", async () => {
    await api(`/tickets/${ticket.id}/close`, { method: "POST", body: "{}" });
    await loadDetail(ticket.id);
    render();
  });
  btn("reopen", async () => {
    await api(`/tickets/${ticket.id}/reopen`, { method: "POST", body: "{}" });
    await loadDetail(ticket.id);
    render();
  });

  btn("btnAssign", async () => {
    const uid = wrap.querySelector("#assignee").value.trim();
    await api(`/tickets/${ticket.id}/assign`, {
      method: "POST",
      body: JSON.stringify({ assignee_id: uid || null }),
    });
    await loadDetail(ticket.id);
    render();
  });

  btn("btnSplit", async () => {
    const title = wrap.querySelector("#splTitle").value.trim();
    if (!title) return;
    const r = await api(`/tickets/${ticket.id}/split`, {
      method: "POST",
      body: JSON.stringify({
        title,
        copy_comments: wrap.querySelector("#splCopy").checked,
      }),
    });
    state.selectedTicketId = r.id;
    await loadDetail(r.id);
    await loadTickets();
    render();
  });

  btn("btnMig", async () => {
    await api(`/tickets/${ticket.id}/migrate`, {
      method: "POST",
      body: JSON.stringify({
        category: wrap.querySelector("#migCat").value,
        append_description: wrap.querySelector("#migNote").value || undefined,
      }),
    });
    await loadDetail(ticket.id);
    render();
  });

  btn("btnLink", async () => {
    const aid = wrap.querySelector("#linkArt").value.trim();
    if (!aid) return;
    await api(`/tickets/${ticket.id}/link-article`, {
      method: "POST",
      body: JSON.stringify({ article_id: aid }),
    });
    await loadDetail(ticket.id);
    render();
  });

  btn("delT", async () => {
    if (!confirm("Soft-delete this ticket?")) return;
    await api(`/tickets/${ticket.id}`, { method: "DELETE" });
    state.selectedTicketId = null;
    state.detail = null;
    await loadTickets();
    render();
  });

  return wrap;
}

function kbView() {
  const w = el(`<div class="card"><h2>Published articles</h2><div id="lst"></div></div>`);
  const lst = w.querySelector("#lst");
  for (const a of state.kbArticles) {
    lst.append(el(`<p><a href="#" data-slug="${escapeHtml(a.slug)}">${escapeHtml(a.title)}</a></p>`));
  }
  lst.onclick = async (ev) => {
    const slug = ev.target?.getAttribute?.("data-slug");
    if (!slug) return;
    ev.preventDefault();
    const art = await api(`/kb/articles/${slug}`);
    alert(`${art.title}\n\n${art.body}`);
  };
  return w;
}

function notificationsView() {
  const w = el(`<div class="card"><h2>In-app notifications</h2><button class="secondary" id="ra">Mark all read</button><div id="n"></div></div>`);
  const n = w.querySelector("#n");
  for (const x of state.notifications) {
    n.append(el(`<div class="muted" style="margin:0.5rem 0">${escapeHtml(x.title || x.type)} — ${escapeHtml(x.body || "")}</div>`));
  }
  w.querySelector("#ra").onclick = async () => {
    await api("/notifications/read-all", { method: "POST", body: "{}" });
    await loadNotifications();
    render();
  };
  return w;
}

function formsView() {
  const card = el(`<div class="card"><h2>Category form schema (JSON)</h2>
    <select id="fcat"></select>
    <textarea class="schema-editor" id="schema"></textarea>
    <div id="fe" class="error"></div>
    <button class="primary" id="fsave">Save</button></div>`);
  const sel = card.querySelector("#fcat");
  sel.innerHTML = state.categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");

  function load() {
    const c = state.categories.find((x) => x.id === sel.value);
    card.querySelector("#schema").value = JSON.stringify(c?.form_schema || [], null, 2);
  }
  load();
  sel.onchange = load;
  card.querySelector("#fsave").onclick = async () => {
    let form_schema;
    try {
      form_schema = JSON.parse(card.querySelector("#schema").value);
    } catch {
      card.querySelector("#fe").textContent = "Invalid JSON";
      return;
    }
    await api(`/ticket-categories/${sel.value}/schema`, {
      method: "PUT",
      body: JSON.stringify({ form_schema }),
    });
    await loadCategories();
    card.querySelector("#fe").textContent = "Saved.";
    card.querySelector("#fe").className = "muted";
  };
  return card;
}

async function reportsView() {
  const o = await api("/reports/overview");
  const s = await api("/reports/sla");
  return el(`<div class="card"><h2>Admin reports</h2>
    <pre class="muted">${escapeHtml(JSON.stringify({ overview: o, sla: s }, null, 2))}</pre></div>`);
}

async function boot() {
  hideBootStatic();
  state.error = "";
  try {
    await bootstrapUser();
    if (state.user) {
      state.view = state.user.role === "end_user" ? "portal" : "tickets";
      try {
        await refreshViewData();
      } catch (e) {
        state.error = e.message || String(e);
        console.error(e);
      }
    }
  } catch (e) {
    state.error = e.message || String(e);
    console.error(e);
  }
  render();
}

boot().catch((e) => {
  const el = document.getElementById("boot-error");
  if (el) el.textContent = e?.message || String(e);
  console.error(e);
});
