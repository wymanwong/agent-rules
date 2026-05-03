import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { useLiveEvents } from '../hooks/useLiveEvents';

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
  const { user } = useAuth();
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [type, setType] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState<'created_at' | 'due_at'>('created_at');

  const load = useCallback(async () => {
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
  }, [status, priority, type, category, sort]);

  useEffect(() => {
    void load().catch(() => {});
  }, [load]);

  useLiveEvents(Boolean(user), () => {
    void load().catch(() => {});
  });

  return (
    <>
      <div className="page-header mb-4">
        <h2 className="page-title">IT Queue</h2>
        <p className="text-secondary small mb-0">Updates automatically when tickets change.</p>
      </div>
      <div className="row g-2 mb-3">
        <div className="col-md-3">
          <input type="text" className="form-control form-control-sm" placeholder="Status" value={status} onChange={(e) => setStatus(e.target.value)} />
        </div>
        <div className="col-md-3">
          <select className="form-select form-select-sm" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="">Any priority</option>
            <option value="P1">P1</option>
            <option value="P2">P2</option>
            <option value="P3">P3</option>
            <option value="P4">P4</option>
          </select>
        </div>
        <div className="col-md-3">
          <select className="form-select form-select-sm" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Any type</option>
            <option value="Incident">Incident</option>
            <option value="ServiceRequest">Service Request</option>
          </select>
        </div>
        <div className="col-md-3">
          <input type="text" className="form-control form-control-sm" placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
        </div>
        <div className="col-md-6">
          <select className="form-select form-select-sm" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="created_at">Sort: Created</option>
            <option value="due_at">Sort: Due date</option>
          </select>
        </div>
      </div>
      <div className="table-responsive">
        <table className="table table-vcenter card-table table-striped">
          <thead>
            <tr>
              <th>Number</th>
              <th>Title</th>
              <th>Type</th>
              <th>Status</th>
              <th>Prio</th>
              <th>Due</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id} role="button" onClick={() => navigate(`/it/tickets/${t.id}`)}>
                <td>{t.ticket_number}</td>
                <td>{t.title}</td>
                <td>{t.type}</td>
                <td>{t.status}</td>
                <td>{t.priority}</td>
                <td>{t.due_at ? new Date(t.due_at).toLocaleString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
