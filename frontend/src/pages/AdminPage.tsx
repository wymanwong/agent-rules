import {
  Alert,
  Box,
  Button,
  Divider,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { api } from '../api';

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
  const [tab, setTab] = useState(0);
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
    <Box>
      <Typography variant="h4" gutterBottom>
        Administration
      </Typography>
      {msg && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {msg}
        </Alert>
      )}
      <Tabs value={tab} onChange={(_, v) => setTab(v)}>
        <Tab label="Users" />
        <Tab label="Teams" />
        <Tab label="Service catalog" />
        <Tab label="Knowledge" />
      </Tabs>
      <Divider sx={{ mb: 2 }} />

      {tab === 0 && (
        <Box>
          <Typography variant="subtitle1">Users</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Use API or seed script for full CRUD; here is a read-only list.
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Team</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.id}</TableCell>
                  <TableCell>{u.name}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.role}</TableCell>
                  <TableCell>{u.team_id ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}

      {tab === 1 && (
        <Box>
          <StackRow>
            <Button onClick={() => void refreshTeams()}>Refresh</Button>
            <Button onClick={() => void seedTeam(`Team-${Date.now().toString(36)}`)}>Add sample team</Button>
          </StackRow>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Name</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {teams.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{t.id}</TableCell>
                  <TableCell>{t.name}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}

      {tab === 2 && (
        <Box>
          <Typography variant="subtitle1" gutterBottom>
            Service catalog configuration
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Create, edit, publish, and set defaults for catalog offerings on the self-service portal.
          </Typography>
          <Button variant="contained" component={RouterLink} to="/admin/catalog">
            Open catalog admin
          </Button>
        </Box>
      )}

      {tab === 3 && (
        <Box>
          <Button sx={{ mb: 2 }} onClick={() => void refreshKb()}>
            Refresh
          </Button>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Published</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {articles.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{a.id}</TableCell>
                  <TableCell>{a.title}</TableCell>
                  <TableCell>{a.is_published === 1 ? 'yes' : 'no'}</TableCell>
                  <TableCell>
                    <Button size="small" onClick={() => void toggleArticlePublished(a)}>
                      Toggle
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Typography variant="subtitle2" sx={{ mt: 3 }}>
            Quick create article
          </Typography>
          <MiniKbCreate onDone={() => void refreshKb()} />
        </Box>
      )}
    </Box>
  );
}

function StackRow({ children }: { children: React.ReactNode }) {
  return <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>{children}</Box>;
}

function MiniKbCreate({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState('New article');
  const [body, setBody] = useState('Body text');
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxWidth: 480 }}>
      <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <TextField label="Body" multiline minRows={3} value={body} onChange={(e) => setBody(e.target.value)} />
      <Button
        variant="contained"
        onClick={() =>
          void api('/knowledge/articles', {
            method: 'POST',
            json: { title, body, is_published: true },
          }).then(onDone)
        }
      >
        Create
      </Button>
    </Box>
  );
}
