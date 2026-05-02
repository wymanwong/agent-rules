import { Box, Typography } from '@mui/material';
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

  if (!article) return <Typography>Loading…</Typography>;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        {article.title}
      </Typography>
      <Typography variant="caption" color="text.secondary" gutterBottom sx={{ display: 'block' }}>
        {article.category ?? 'General'} · {article.tags ?? ''}
      </Typography>
      <Typography sx={{ whiteSpace: 'pre-wrap' }}>{article.body}</Typography>
    </Box>
  );
}
