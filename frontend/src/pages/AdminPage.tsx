import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { KNOWLEDGE_CATEGORY_LABELS } from '../constants/knowledgeCategories';
import { useLiveEvents } from '../hooks/useLiveEvents';

interface UserRow {
  id: number;
  name: string;
  email: string;
  role: string;
  team_id: number | null;
}

interface TeamRow {
  id: number;
  name: string;
}

interface ArticleRow {
  id: number;
  title: string;
  is_published: number;
}

export function AdminPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'users' | 'teams' | 'catalog' | 'kb'>('users');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [articles, setArticles] = useState<ArticleRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  async function refreshUsers() {
    const r = await api<{ users: UserRow[] }>('/admin/users');
    setUsers(r.users);
  }
  async function refreshTeams() {
    const r = await api<{ teams: TeamRow[] }>('/admin/teams');
    setTeams(r.teams);
  }
  async function refreshKb() {
    const r = await api<{ articles: ArticleRow[] }>('/knowledge/articles?publishedOnly=false');
    setArticles(r.articles);
  }

  useEffect(() => {
    void refreshUsers().catch(() => {});
    void refreshTeams().catch(() => {});
    void refreshKb().catch(() => {});
  }, []);

  useLiveEvents(user?.role === 'Admin', (msg) => {
    if (msg.type === 'tickets' && (tab === 'users' || tab === 'teams')) {
      void refreshUsers().catch(() => {});
      void refreshTeams().catch(() => {});
    }
    if (msg.type === 'knowledge' && tab === 'kb') void refreshKb().catch(() => {});
  });

  async function seedTeam(name: string) {
    setMsg(null);
    try {
      await api('/admin/teams', {
        method: 'POST',
        json: { name, description: '' },
      });
      await refreshTeams();
      setMsg(`Team ${name} created`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error');
    }
  }

  async function toggleArticlePublished(row: ArticleRow) {
    await api(`/knowledge/articles/${row.id}`, {
      method: 'PATCH',
      json: { is_published: row.is_published !== 1 },
    });
    await refreshKb();
  }

  return (
    <>
      <div className="page-header mb-4">
        <h2 className="page-title">Administration</h2>
      </div>
      {msg && <div className="alert alert-info">{msg}</div>}

      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button type="button" className={`nav-link ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>
            Users
          </button>
        </li>
        <li className="nav-item">
          <button type="button" className={`nav-link ${tab === 'teams' ? 'active' : ''}`} onClick={() => setTab('teams')}>
            Teams
          </button>
        </li>
        <li className="nav-item">
          <button type="button" className={`nav-link ${tab === 'catalog' ? 'active' : ''}`} onClick={() => setTab('catalog')}>
            Service catalog
          </button>
        </li>
        <li className="nav-item">
          <button type="button" className={`nav-link ${tab === 'kb' ? 'active' : ''}`} onClick={() => setTab('kb')}>
            Knowledge
          </button>
        </li>
      </ul>

      {tab === 'users' && (
        <>
          <p className="text-secondary">Read-only list; full user CRUD via API or seed script.</p>
          <div className="table-responsive">
            <table className="table table-vcenter card-table table-striped">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Team</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.id}</td>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>{u.role}</td>
                    <td>{u.team_id ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'teams' && (
        <>
          <div className="btn-list mb-3">
            <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => void refreshTeams()}>
              Refresh
            </button>
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => void seedTeam(`Team-${Date.now().toString(36)}`)}>
              Add sample team
            </button>
          </div>
          <div className="table-responsive">
            <table className="table table-vcenter card-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((t) => (
                  <tr key={t.id}>
                    <td>{t.id}</td>
                    <td>{t.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'catalog' && (
        <>
          <p className="text-secondary mb-3">Configure catalog offerings for the self-service portal.</p>
          <Link className="btn btn-primary" to="/admin/catalog">
            Open catalog admin
          </Link>
        </>
      )}

      {tab === 'kb' && (
        <>
          <button type="button" className="btn btn-outline-primary btn-sm mb-3" onClick={() => void refreshKb()}>
            Refresh
          </button>
          <div className="table-responsive mb-4">
            <table className="table table-vcenter card-table table-striped">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Published</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {articles.map((a) => (
                  <tr key={a.id}>
                    <td>{a.id}</td>
                    <td>{a.title}</td>
                    <td>{a.is_published === 1 ? 'yes' : 'no'}</td>
                    <td>
                      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => void toggleArticlePublished(a)}>
                        Toggle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h4 className="mb-2">Quick create article</h4>
          <MiniKbCreate onDone={() => void refreshKb()} />
        </>
      )}
    </>
  );
}

function MiniKbCreate({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState('New article');
  const [body, setBody] = useState('Body text');
  const [category, setCategory] = useState<string>(KNOWLEDGE_CATEGORY_LABELS[KNOWLEDGE_CATEGORY_LABELS.length - 1] ?? 'General');
  return (
    <div className="row g-2" style={{ maxWidth: 480 }}>
      <div className="col-12">
        <label className="form-label">Title</label>
        <input type="text" className="form-control" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="col-12">
        <label className="form-label">Category</label>
        <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
          {KNOWLEDGE_CATEGORY_LABELS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div className="col-12">
        <label className="form-label">Body</label>
        <textarea className="form-control" rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
      </div>
      <div className="col-12">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() =>
            void api('/knowledge/articles', {
              method: 'POST',
              json: { title, body, category, is_published: true },
            }).then(onDone)
          }
        >
          Create
        </button>
      </div>
    </div>
  );
}
