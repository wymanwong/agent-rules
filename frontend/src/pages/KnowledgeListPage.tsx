import { Box, Button, Card, CardActions, CardContent, TextField, Typography } from '@mui/material';
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
    <Box>
      <Typography variant="h4" gutterBottom>
        Knowledge Base
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <TextField label="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
        <TextField label="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button variant="contained" onClick={() => void load()}>
          Apply
        </Button>
      </Box>
      {articles.map((a) => (
        <Card key={a.id} sx={{ mb: 2 }} variant="outlined">
          <CardContent>
            <Typography variant="h6">{a.title}</Typography>
            <Typography variant="caption" color="text.secondary">
              {a.category ?? 'General'}
            </Typography>
          </CardContent>
          <CardActions>
            <Button onClick={() => navigate(`/knowledge/${a.id}`)}>Read</Button>
          </CardActions>
        </Card>
      ))}
    </Box>
  );
}
