import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { useLiveEvents } from '../hooks/useLiveEvents';

interface ItStaffMember {
  id: number;
  name: string;
  email: string;
  department: string | null;
  role: string;
  team_id: number | null;
  team_name: string | null;
  active_tickets: number;
  online: boolean;
}

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
  const [staff, setStaff] = useState<ItStaffMember[]>([]);

  const loadStaff = useCallback(async () => {
    try {
      const res = await api<{ staff: ItStaffMember[] }>('/it/staff');
      setStaff(res.staff);
    } catch {
      setStaff([]);
    }
  }, []);

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

  useEffect(() => {
    if (user?.role === 'IT' || user?.role === 'Admin') void loadStaff();
  }, [user?.role, loadStaff]);

  useLiveEvents(Boolean(user), (msg) => {
    if (msg.type === 'staff') {
      void loadStaff();
      return;
    }
    void load().catch(() => {});
    void loadStaff();
  });

  const loadLabel = (count: number) => {
    if (count <= 2) return { label: 'Optimal', cls: 'text-success' };
    if (count <= 5) return { label: 'High load', cls: 'text-primary' };
    return { label: 'Heavy', cls: 'text-danger' };
  };

  return (
    <>
      <div className="page-header mb-4">
        <h2 className="page-title">IT Queue</h2>
        <p className="text-secondary small mb-0">
          Tickets and team presence stay in sync over the live stream (same pattern as NexusDesk dispatch).
        </p>
      </div>
      <div className="row g-3 mb-3">
        <div className="col-lg-8">
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
        </div>
        <div className="col-lg-4">
          <div className="card bg-dark text-white border-0 h-100">
            <div className="card-header border-secondary text-white">
              <strong>Team &amp; staff</strong>
              <div className="text-secondary small">Online = live app connection · workload = open assignee tickets</div>
            </div>
            <div className="card-body overflow-auto" style={{ maxHeight: '70vh' }}>
              {staff.length === 0 ? (
                <p className="text-secondary small mb-0">No IT staff loaded.</p>
              ) : (
                staff.map((s) => {
                  const load = loadLabel(s.active_tickets);
                  return (
                    <div key={s.id} className="mb-3 pb-3 border-bottom border-secondary">
                      <div className="d-flex align-items-start justify-content-between gap-2">
                        <div className="d-flex align-items-center gap-2 min-w-0">
                          <div className="position-relative flex-shrink-0">
                            <span className="avatar avatar-md bg-primary text-white">{s.name.charAt(0)}</span>
                            <span
                              className={`position-absolute bottom-0 end-0 p-1 border border-dark rounded-circle ${
                                s.online ? 'bg-success' : 'bg-secondary'
                              }`}
                              title={s.online ? 'Online' : 'Offline'}
                              style={{ width: '0.65rem', height: '0.65rem' }}
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="fw-medium text-truncate">{s.name}</div>
                            <div className="text-secondary text-uppercase small" style={{ fontSize: '0.65rem' }}>
                              {s.team_name ?? 'No team'} · {s.role}
                            </div>
                          </div>
                        </div>
                        <div className="text-end flex-shrink-0">
                          <div className="fs-4 fw-bold lh-1">{s.active_tickets}</div>
                          <div className="text-secondary" style={{ fontSize: '0.65rem' }}>
                            OPEN
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 small">
                        <span className="text-secondary">Load</span>{' '}
                        <span className={load.cls}>{load.label}</span>
                      </div>
                      <div className="progress progress-sm mt-1 bg-secondary">
                        <div
                          className={`progress-bar ${s.active_tickets > 5 ? 'bg-danger' : s.active_tickets > 2 ? 'bg-primary' : 'bg-success'}`}
                          style={{ width: `${Math.min(s.active_tickets * 16.6, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
