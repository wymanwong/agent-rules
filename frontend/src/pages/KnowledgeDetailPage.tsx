import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { KnowledgeShareBar } from '../components/KnowledgeShareBar';
import { renderKbBody } from '../knowledge/renderKbBody';

interface Article {
  id: number;
  title: string;
  body: string;
  body_format?: string;
  category: string | null;
  tags: string | null;
}

export function KnowledgeDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [article, setArticle] = useState<Article | null>(null);

  useEffect(() => {
    if (!id) return;
    void api<{ article: Article }>(`/knowledge/articles/${id}`).then((r) => setArticle(r.article));
  }, [id]);

  const html = useMemo(() => {
    if (!article) return '';
    return renderKbBody(article.body, article.body_format);
  }, [article]);

  if (!article) return <div className="text-secondary">Loading…</div>;

  return (
    <>
      <div className="page-header mb-3">
        <h2 className="page-title">{article.title}</h2>
        <div className="text-secondary small mb-2">
          {article.category ?? 'General'}
          {article.tags ? ` · ${article.tags}` : ''}
        </div>
        <KnowledgeShareBar articleId={article.id} title={article.title} />
        {user?.role === 'Admin' && (
          <Link className="btn btn-sm btn-outline-secondary" to={`/admin/knowledge/${article.id}`}>
            Edit article
          </Link>
        )}
      </div>
      <div className="card">
        <div className="card-body kb-article-body">
          <div className="markdown" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </div>
    </>
  );
}
