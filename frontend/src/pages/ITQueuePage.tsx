import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

interface TicketRow {
  id: number;
  ticket_number: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  category: string | null;
  due_at: string | null;
  created_at: string;
}

export function ITQueuePage() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [type, setType] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState<'created_at' | 'due_at'>('created_at');

  async function load() {
    const params = new URLSearchParams({ limit: '100' });
    if (status) params.set('status', status);
    if (priority) params.set('priority', priority);
    if (type) params.set('type', type);
    if (category) params.set('category', category);
    const res = await api<{ tickets: TicketRow[] }>(`/tickets?${params.toString()}`);
    const sorted = [...res.tickets].sort((a, b) => {
      if (sort === 'due_at') {
        const da = a.due_at ? new Date(a.due_at).getTime() : Infinity;
        const db = b.due_at ? new Date(b.due_at).getTime() : Infinity;
        return da - db;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    setTickets(sorted);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        IT Queue
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
        <TextField label="Status" size="small" value={status} onChange={(e) => setStatus(e.target.value)} />
        <FormControl sx={{ minWidth: 120 }}>
          <InputLabel>Priority</InputLabel>
          <Select label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <MenuItem value="">Any</MenuItem>
            <MenuItem value="P1">P1</MenuItem>
            <MenuItem value="P2">P2</MenuItem>
            <MenuItem value="P3">P3</MenuItem>
            <MenuItem value="P4">P4</MenuItem>
          </Select>
        </FormControl>
        <FormControl sx={{ minWidth: 140 }}>
          <InputLabel>Type</InputLabel>
          <Select label="Type" value={type} onChange={(e) => setType(e.target.value)}>
            <MenuItem value="">Any</MenuItem>
            <MenuItem value="Incident">Incident</MenuItem>
            <MenuItem value="ServiceRequest">Service Request</MenuItem>
          </Select>
        </FormControl>
        <TextField label="Category" size="small" value={category} onChange={(e) => setCategory(e.target.value)} />
        <FormControl sx={{ minWidth: 160 }}>
          <InputLabel>Sort</InputLabel>
          <Select label="Sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <MenuItem value="created_at">Created date</MenuItem>
            <MenuItem value="due_at">Due date</MenuItem>
          </Select>
        </FormControl>
        <Button variant="contained" onClick={() => void load()}>
          Refresh
        </Button>
      </Box>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Number</TableCell>
            <TableCell>Title</TableCell>
            <TableCell>Type</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Prio</TableCell>
            <TableCell>Due</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {tickets.map((t) => (
            <TableRow key={t.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/it/tickets/${t.id}`)}>
              <TableCell>{t.ticket_number}</TableCell>
              <TableCell>{t.title}</TableCell>
              <TableCell>{t.type}</TableCell>
              <TableCell>{t.status}</TableCell>
              <TableCell>{t.priority}</TableCell>
              <TableCell>{t.due_at ? new Date(t.due_at).toLocaleString() : '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}
