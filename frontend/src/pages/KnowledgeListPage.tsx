import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconBook } from '@tabler/icons-react';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { KNOWLEDGE_CATEGORY_LABELS } from '../constants/knowledgeCategories';
import { useLiveEvents } from '../hooks/useLiveEvents';

interface Article {
  id: number;
  title: string;
  category: string | null;
}

const SEARCH_DEBOUNCE_MS = 400;

export function KnowledgeListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [articles, setArticles] = useState<Article[]>([]);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const t = window.setTimeout(() => setSearchQuery(search), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (searchQuery) params.set('search', searchQuery);
    if (user?.role === 'Admin') params.set('publishedOnly', 'false');
    const res = await api<{ articles: Article[] }>(`/knowledge/articles?${params.toString()}`);
    setArticles(res.articles);
  }, [category, searchQuery, user?.role]);

  useEffect(() => {
    void load().catch(() => {
      /* ignore transient errors */
    });
  }, [load]);

  useLiveEvents(Boolean(user), (msg) => {
    if (msg.type === 'knowledge') void load().catch(() => {});
  });

  return (
    <>
      <div className="page-header mb-3">
        <h2 className="page-title mb-1">Knowledge Base</h2>
        <p className="text-secondary small mb-0">Self-service articles; filters update as you change them.</p>
      </div>

      <div className="card mb-4 shadow-sm">
        <div className="card-body py-3">
          <div className="row g-3 align-items-end">
            <div className="col-12 col-md-5 col-lg-4">
              <label className="form-label mb-1 small text-secondary">Category</label>
              <select className="form-select form-select-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">All categories</option>
                {KNOWLEDGE_CATEGORY_LABELS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <div className="form-hint mb-0">Pick a topic area (consistent naming helps users find answers).</div>
            </div>
            <div className="col-12 col-md-7 col-lg-8">
              <label className="form-label mb-1 small text-secondary">Search</label>
              <input
                type="search"
                className="form-control form-control-sm"
                placeholder="Search titles…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>
        </div>
      </div>

      {articles.length === 0 ? (
        <div className="card border-dashed">
          <div className="card-body text-center text-secondary py-5">
            <IconBook size={40} stroke={1} className="mb-2 opacity-50" aria-hidden />
            <p className="mb-0">No articles match these filters.</p>
          </div>
        </div>
      ) : (
        articles.map((a) => (
          <div key={a.id} className="card mb-3 shadow-sm">
            <div className="card-body">
              <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                <span className="badge text-bg-secondary">{a.category ?? 'General'}</span>
              </div>
              <h3 className="card-title mb-0">{a.title}</h3>
            </div>
            <div className="card-footer bg-transparent pt-0 border-top-0">
              <button type="button" className="btn btn-sm btn-primary" onClick={() => navigate(`/knowledge/${a.id}`)}>
                Read article
              </button>
            </div>
          </div>
        ))
      )}
    </>
  );
}
