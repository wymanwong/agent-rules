import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';

interface Article {
  id: number;
  title: string;
  category: string | null;
}

export function PortalHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [articles, setArticles] = useState<Article[]>([]);
  const [ticketHits, setTicketHits] = useState<{ id: number; ticket_number: string; title: string }[]>([]);

  async function search() {
    const kb = await api<{ articles: Article[] }>(
      `/knowledge/articles?search=${encodeURIComponent(q)}${user?.role === 'Admin' ? '&publishedOnly=false' : ''}`,
    );
    setArticles(kb.articles.slice(0, 8));
    if (user && q.trim()) {
      try {
        const t = await api<{ tickets: { id: number; ticket_number: string; title: string }[] }>(
          `/tickets?search=${encodeURIComponent(q)}&limit=8`,
        );
        setTicketHits(t.tickets);
      } catch {
        setTicketHits([]);
      }
    } else setTicketHits([]);
  }

  return (
    <>
      <div className="page-header d-print-none mb-4">
        <div className="row align-items-center">
          <div className="col">
            <h2 className="page-title">Self-Service Portal</h2>
            <div className="text-secondary">Search knowledge, report incidents, or request services from the catalog.</div>
          </div>
        </div>
      </div>

      <div className="input-group mb-4">
        <input
          type="search"
          className="form-control"
          placeholder="Search knowledge & my tickets"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void search()}
        />
        <button type="button" className="btn btn-primary" onClick={() => void search()}>
          Search
        </button>
      </div>

      {(articles.length > 0 || ticketHits.length > 0) && (
        <div className="row row-cards mb-4">
          {articles.map((a) => (
            <div key={`kb-${a.id}`} className="col-sm-6 col-lg-4">
              <div className="card">
                <div className="card-body">
                  <h3 className="card-title">{a.title}</h3>
                  <p className="text-secondary small mb-0">{a.category ?? 'General'}</p>
                </div>
                <div className="card-footer">
                  <button type="button" className="btn btn-sm btn-primary" onClick={() => navigate(`/knowledge/${a.id}`)}>
                    Open
                  </button>
                </div>
              </div>
            </div>
          ))}
          {ticketHits.map((t) => (
            <div key={`tk-${t.id}`} className="col-sm-6 col-lg-4">
              <div className="card">
                <div className="card-body">
                  <div className="text-secondary small">{t.ticket_number}</div>
                  <div>{t.title}</div>
                </div>
                <div className="card-footer">
                  <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => navigate(`/tickets/${t.id}`)}>
                    View
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="row row-cards">
        <div className="col-md-4 mb-3 mb-md-0">
          <div className="card h-100">
            <div className="card-body">
              <h3 className="card-title">Report an Incident</h3>
              <p className="text-secondary">Something is broken — we prioritize restoration.</p>
            </div>
            <div className="card-footer">
              <button type="button" className="btn btn-primary" onClick={() => navigate('/incidents/new')} disabled={!user}>
                Start
              </button>
            </div>
          </div>
        </div>
        <div className="col-md-4 mb-3 mb-md-0">
          <div className="card h-100">
            <div className="card-body">
              <h3 className="card-title">Request a Service</h3>
              <p className="text-secondary">Standard requests from the service catalog.</p>
            </div>
            <div className="card-footer">
              <button type="button" className="btn btn-azure" onClick={() => navigate('/catalog')} disabled={!user}>
                Browse catalog
              </button>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card h-100">
            <div className="card-body">
              <h3 className="card-title">Knowledge Base</h3>
              <p className="text-secondary">Self-help articles and guides.</p>
            </div>
            <div className="card-footer">
              <button type="button" className="btn btn-outline-primary" onClick={() => navigate('/knowledge')}>
                Browse
              </button>
            </div>
          </div>
        </div>
      </div>

      {!user && <p className="text-secondary mt-4">Sign in to create tickets and browse personalized results.</p>}
      {user?.role === 'Admin' && (
        <p className="text-secondary small mt-3 mb-0">
          Admin tip: Knowledge search includes unpublished articles when logged in as Admin.
        </p>
      )}
    </>
  );
}
