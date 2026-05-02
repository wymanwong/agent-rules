import { Box, Button, Card, CardActions, CardContent, Stack, TextField, Typography } from '@mui/material';
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
    <Box>
      <Typography variant="h4" gutterBottom>
        Self-Service Portal
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Search knowledge, report incidents, or request services from the catalog.
      </Typography>

      <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
        <TextField
          fullWidth
          label="Search knowledge & my tickets"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void search()}
        />
        <Button variant="contained" onClick={() => void search()}>
          Search
        </Button>
      </Box>

      {(articles.length > 0 || ticketHits.length > 0) && (
        <Stack sx={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2, mb: 3 }}>
          {articles.map((a) => (
            <Box key={`kb-${a.id}`} sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(33.33% - 11px)' } }}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1">{a.title}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {a.category ?? 'General'}
                  </Typography>
                </CardContent>
                <CardActions>
                  <Button size="small" onClick={() => navigate(`/knowledge/${a.id}`)}>
                    Open
                  </Button>
                </CardActions>
              </Card>
            </Box>
          ))}
          {ticketHits.map((t) => (
            <Box key={`tk-${t.id}`} sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(33.33% - 11px)' } }}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2">{t.ticket_number}</Typography>
                  <Typography variant="body2">{t.title}</Typography>
                </CardContent>
                <CardActions>
                  <Button size="small" onClick={() => navigate(`/tickets/${t.id}`)}>
                    View
                  </Button>
                </CardActions>
              </Card>
            </Box>
          ))}
        </Stack>
      )}

      <Stack sx={{ flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="h6">Report an Incident</Typography>
            <Typography variant="body2" color="text.secondary">
              Something is broken — we prioritize restoration.
            </Typography>
          </CardContent>
          <CardActions>
            <Button variant="contained" onClick={() => navigate('/incidents/new')} disabled={!user}>
              Start
            </Button>
          </CardActions>
        </Card>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="h6">Request a Service</Typography>
            <Typography variant="body2" color="text.secondary">
              Standard requests from the service catalog.
            </Typography>
          </CardContent>
          <CardActions>
            <Button variant="contained" color="secondary" onClick={() => navigate('/catalog')} disabled={!user}>
              Browse catalog
            </Button>
          </CardActions>
        </Card>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="h6">Knowledge Base</Typography>
            <Typography variant="body2" color="text.secondary">
              Self-help articles and guides.
            </Typography>
          </CardContent>
          <CardActions>
            <Button onClick={() => navigate('/knowledge')}>Browse</Button>
          </CardActions>
        </Card>
      </Stack>

      {!user && (
        <Typography sx={{ mt: 3 }} color="text.secondary">
          Sign in to create tickets and browse personalized results.
        </Typography>
      )}
      {user?.role === 'Admin' && (
        <Typography sx={{ mt: 2 }} variant="caption" color="text.secondary">
          Admin tip: Knowledge search includes unpublished articles when logged in as Admin.
        </Typography>
      )}
    </Box>
  );
}
