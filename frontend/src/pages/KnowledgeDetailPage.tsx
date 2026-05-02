import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';

interface Article {
  id: number;
  title: string;
  body: string;
  category: string | null;
  tags: string | null;
}

export function KnowledgeDetailPage() {
  const { id } = useParams();
  const [article, setArticle] = useState<Article | null>(null);

  useEffect(() => {
    if (!id) return;
    void api<{ article: Article }>(`/knowledge/articles/${id}`).then((r) => setArticle(r.article));
  }, [id]);

  if (!article) return <div className="text-secondary">Loading…</div>;

  return (
    <>
      <div className="page-header mb-4">
        <h2 className="page-title">{article.title}</h2>
        <div className="text-secondary small">
          {article.category ?? 'General'} · {article.tags ?? ''}
        </div>
      </div>
      <div className="card">
        <div className="card-body">
          <div className="markdown" style={{ whiteSpace: 'pre-wrap' }}>
            {article.body}
          </div>
        </div>
      </div>
    </>
  );
}
