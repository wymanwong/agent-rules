import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconFilter } from '@tabler/icons-react';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { useLiveEvents } from '../hooks/useLiveEvents';
import {
  INCIDENT_CATEGORY_LABELS,
  INCIDENT_SUBCATEGORIES,
  type IncidentCategory,
} from '../constants/incidentTaxonomy';

const SEARCH_DEBOUNCE_MS = 400;

interface TicketRow {
  id: number;
  ticket_number: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  category: string | null;
  subcategory: string | null;
  created_at: string;
}

export function MyRequestsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState<IncidentCategory | ''>('');
  const [subcategory, setSubcategory] = useState('');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [search, setSearch] = useState('');
  /** Search text applied to the API after debounce */
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const t = window.setTimeout(() => setSearchQuery(search), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (status) params.set('status', status);
    if (category) params.set('category', category);
    if (subcategory) params.set('subcategory', subcategory);
    if (createdFrom) params.set('createdFrom', new Date(createdFrom).toISOString());
    if (createdTo) params.set('createdTo', new Date(createdTo).toISOString());
    if (searchQuery) params.set('search', searchQuery);
    params.set('limit', '100');
    const res = await api<{ tickets: TicketRow[] }>(`/tickets?${params.toString()}`);
    setTickets(res.tickets);
  }, [type, status, category, subcategory, createdFrom, createdTo, searchQuery]);

  const subcategoryFilterOptions = category ? [...INCIDENT_SUBCATEGORIES[category]] : [];

  useEffect(() => {
    setSubcategory('');
  }, [category]);

  useEffect(() => {
    void load().catch(() => {
      /* keep existing rows on transient failure */
    });
  }, [load]);

  useLiveEvents(Boolean(user), () => {
    void load().catch(() => {});
  });

  return (
    <div className="my-requests-page">
      <div className="page-header pb-2 mb-2 border-bottom">
        <h1 className="page-title mb-0">My Requests</h1>
        <p className="text-secondary small mb-0 mt-1">Incidents and service requests you submitted.</p>
      </div>

      <div className="card mb-3 shadow-sm">
        <div className="card-body py-3">
          <div className="d-flex align-items-center gap-2 mb-2 text-secondary small fw-medium">
            <IconFilter size={16} stroke={1.5} aria-hidden />
            Filters
            <span className="fw-normal text-secondary opacity-75">· updates automatically</span>
          </div>
          <div className="row g-2 align-items-end">
            <div className="col-12 col-sm-6 col-md-4 col-lg-2">
              <label className="form-label mb-1 small text-secondary">Type</label>
              <select className="form-select form-select-sm" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="">Any type</option>
                <option value="Incident">Incident</option>
                <option value="ServiceRequest">Service request</option>
              </select>
            </div>
            <div className="col-12 col-sm-6 col-md-4 col-lg-2">
              <label className="form-label mb-1 small text-secondary">Status</label>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="e.g. Approved"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              />
            </div>
            <div className="col-12 col-sm-6 col-md-4 col-lg-2">
              <label className="form-label mb-1 small text-secondary">Incident category</label>
              <select className="form-select form-select-sm" value={category} onChange={(e) => setCategory(e.target.value as IncidentCategory | '')}>
                <option value="">Any</option>
                {INCIDENT_CATEGORY_LABELS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-sm-6 col-md-4 col-lg-2">
              <label className="form-label mb-1 small text-secondary">Incident subcategory</label>
              <select
                className="form-select form-select-sm"
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                disabled={!category}
              >
                <option value="">Any</option>
                {subcategoryFilterOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-6 col-md-4 col-lg-2">
              <label className="form-label mb-1 small text-secondary">From</label>
              <input type="date" className="form-control form-control-sm" value={createdFrom} onChange={(e) => setCreatedFrom(e.target.value)} />
            </div>
            <div className="col-6 col-md-4 col-lg-2">
              <label className="form-label mb-1 small text-secondary">To</label>
              <input type="date" className="form-control form-control-sm" value={createdTo} onChange={(e) => setCreatedTo(e.target.value)} />
            </div>
            <div className="col-12 col-md-8 col-lg-4">
              <label className="form-label mb-1 small text-secondary">Search</label>
              <input
                type="search"
                className="form-control form-control-sm"
                placeholder="Title or number…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="card shadow-sm">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-vcenter table-hover card-table table-striped mb-0">
              <thead className="bg-body-secondary">
                <tr>
                  <th>Number</th>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Subcategory</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {tickets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-secondary text-center py-4">
                      No tickets match these filters.
                    </td>
                  </tr>
                ) : (
                  tickets.map((t) => (
                    <tr key={t.id} role="button" className="cursor-pointer" onClick={() => navigate(`/tickets/${t.id}`)}>
                      <td className="text-secondary">{t.ticket_number}</td>
                      <td className="fw-medium">{t.title}</td>
                      <td>{t.type}</td>
                      <td className="text-secondary small">{t.category ?? '—'}</td>
                      <td className="text-secondary small">{t.subcategory ?? '—'}</td>
                      <td>{t.status}</td>
                      <td>{t.priority}</td>
                      <td className="text-secondary text-nowrap">{new Date(t.created_at).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
