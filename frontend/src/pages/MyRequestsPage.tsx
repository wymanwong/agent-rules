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
    <>
      <div className="page-header mb-4">
        <h2 className="page-title">My Requests</h2>
      </div>
      <div className="row g-2 mb-3">
        <div className="col-md-2">
          <select className="form-select form-select-sm" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Any type</option>
            <option value="Incident">Incident</option>
            <option value="ServiceRequest">Service Request</option>
          </select>
        </div>
        <div className="col-md-2">
          <input type="text" className="form-control form-control-sm" placeholder="Status" value={status} onChange={(e) => setStatus(e.target.value)} />
        </div>
        <div className="col-md-2">
          <input type="text" className="form-control form-control-sm" placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
        </div>
        <div className="col-md-2">
          <input type="date" className="form-control form-control-sm" value={createdFrom} onChange={(e) => setCreatedFrom(e.target.value)} />
        </div>
        <div className="col-md-2">
          <input type="date" className="form-control form-control-sm" value={createdTo} onChange={(e) => setCreatedTo(e.target.value)} />
        </div>
        <div className="col-md-2">
          <input type="search" className="form-control form-control-sm" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>
      <button type="button" className="btn btn-outline-primary btn-sm mb-3" onClick={() => void load()}>
        Apply filters
      </button>
      <div className="table-responsive">
        <table className="table table-vcenter card-table table-striped">
          <thead>
            <tr>
              <th>Number</th>
              <th>Title</th>
              <th>Type</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id} role="button" className="cursor-pointer" onClick={() => navigate(`/tickets/${t.id}`)}>
                <td>{t.ticket_number}</td>
                <td>{t.title}</td>
                <td>{t.type}</td>
                <td>{t.status}</td>
                <td>{t.priority}</td>
                <td>{new Date(t.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
