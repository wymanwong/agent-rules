import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';

interface Article {
  id: number;
  title: string;
  category: string | null;
}

export function KnowledgeListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [articles, setArticles] = useState<Article[]>([]);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');

  async function load() {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (search) params.set('search', search);
    if (user?.role === 'Admin') params.set('publishedOnly', 'false');
    const res = await api<{ articles: Article[] }>(`/knowledge/articles?${params.toString()}`);
    setArticles(res.articles);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div className="page-header mb-4">
        <h2 className="page-title">Knowledge Base</h2>
      </div>
      <div className="row g-2 mb-3">
        <div className="col-md-4">
          <input type="text" className="form-control" placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
        </div>
        <div className="col-md-4">
          <input type="search" className="form-control" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="col-md-4">
          <button type="button" className="btn btn-primary" onClick={() => void load()}>
            Apply
          </button>
        </div>
      </div>
      {articles.map((a) => (
        <div key={a.id} className="card mb-3">
          <div className="card-body">
            <h3 className="card-title">{a.title}</h3>
            <p className="text-secondary small mb-0">{a.category ?? 'General'}</p>
          </div>
          <div className="card-footer">
            <button type="button" className="btn btn-sm btn-primary" onClick={() => navigate(`/knowledge/${a.id}`)}>
              Read
            </button>
          </div>
        </div>
      ))}
    </>
  );
}
