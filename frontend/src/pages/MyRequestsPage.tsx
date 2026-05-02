import {
  Box,
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
  created_at: string;
}

export function MyRequestsPage() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [search, setSearch] = useState('');

  async function load() {
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (status) params.set('status', status);
    if (category) params.set('category', category);
    if (createdFrom) params.set('createdFrom', new Date(createdFrom).toISOString());
    if (createdTo) params.set('createdTo', new Date(createdTo).toISOString());
    if (search) params.set('search', search);
    params.set('limit', '100');
    const res = await api<{ tickets: TicketRow[] }>(`/tickets?${params.toString()}`);
    setTickets(res.tickets);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        My Requests
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
        <FormControl sx={{ minWidth: 140 }}>
          <InputLabel>Type</InputLabel>
          <Select label="Type" value={type} onChange={(e) => setType(e.target.value)}>
            <MenuItem value="">Any</MenuItem>
            <MenuItem value="Incident">Incident</MenuItem>
            <MenuItem value="ServiceRequest">Service Request</MenuItem>
          </Select>
        </FormControl>
        <TextField label="Status" value={status} onChange={(e) => setStatus(e.target.value)} />
        <TextField label="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
        <TextField
          label="Created from"
          type="date"
          slotProps={{ inputLabel: { shrink: true } }}
          value={createdFrom}
          onChange={(e) => setCreatedFrom(e.target.value)}
        />
        <TextField
          label="Created to"
          type="date"
          slotProps={{ inputLabel: { shrink: true } }}
          value={createdTo}
          onChange={(e) => setCreatedTo(e.target.value)}
        />
        <TextField label="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
      </Box>
      <button type="button" onClick={() => void load()} style={{ marginBottom: 16 }}>
        Apply filters
      </button>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Number</TableCell>
            <TableCell>Title</TableCell>
            <TableCell>Type</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Priority</TableCell>
            <TableCell>Created</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {tickets.map((t) => (
            <TableRow key={t.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/tickets/${t.id}`)}>
              <TableCell>{t.ticket_number}</TableCell>
              <TableCell>{t.title}</TableCell>
              <TableCell>{t.type}</TableCell>
              <TableCell>{t.status}</TableCell>
              <TableCell>{t.priority}</TableCell>
              <TableCell>{new Date(t.created_at).toLocaleString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}
