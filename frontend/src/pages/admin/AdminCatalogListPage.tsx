import { IconEdit, IconPlus } from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../auth/AuthContext';
import { useLiveEvents } from '../../hooks/useLiveEvents';

export interface CatalogItemDto {
  id: number;
  name: string;
  description: string;
  type: string;
  default_category: string | null;
  default_subcategory: string | null;
  default_impact: string | null;
  default_urgency: string | null;
  default_priority: string | null;
  requires_manager_approval: number;
  is_published: number;
  updated_at: string;
}

export function AdminCatalogListPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<CatalogItemDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await api<{ items: CatalogItemDto[] }>('/catalog/items');
      setItems(r.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load catalog');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useLiveEvents(user?.role === 'Admin', (msg) => {
    if (msg.type === 'catalog') void load();
  });

  return (
    <>
      <div className="page-header d-print-none mb-4">
        <div className="row align-items-center">
          <div className="col">
            <h2 className="page-title">Service Catalog</h2>
            <div className="text-secondary">
              Configure offerings, defaults, approval, and extra questions for the self-service portal.
            </div>
          </div>
          <div className="col-auto ms-auto btn-list">
            <Link to="/admin" className="btn btn-outline-secondary">
              Back to Admin
            </Link>
            <Link to="/admin/catalog/new" className="btn btn-primary">
              <IconPlus size={18} className="me-1" />
              New catalog item
            </Link>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card">
        <div className="table-responsive">
          <table className="table table-vcenter card-table table-striped">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th className="d-none d-md-table-cell">Category</th>
                <th className="d-none d-sm-table-cell">Impact / Urgency</th>
                <th>Published</th>
                <th>Approval</th>
                <th className="w-1" />
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>
                    <div className="fw-medium">{row.name}</div>
                    <div className="text-secondary small d-md-none">
                      {[row.default_category, row.default_subcategory].filter(Boolean).join(' · ') || '—'}
                    </div>
                  </td>
                  <td className="d-none d-md-table-cell">
                    {[row.default_category, row.default_subcategory].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="d-none d-sm-table-cell">
                    {(row.default_impact ?? '—') + ' / ' + (row.default_urgency ?? '—')}
                  </td>
                  <td>
                    <span className={`badge ${row.is_published === 1 ? 'bg-success' : 'bg-secondary'}`}>
                      {row.is_published === 1 ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${row.requires_manager_approval === 1 ? 'bg-warning text-warning-fg' : 'bg-secondary-lt'}`}>
                      {row.requires_manager_approval === 1 ? 'Required' : 'No'}
                    </span>
                  </td>
                  <td>
                    <Link className="btn btn-sm btn-primary" to={`/admin/catalog/${row.id}`}>
                      <IconEdit size={16} className="me-1" />
                      Configure
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {items.length === 0 && !error && <p className="text-secondary mt-3">No items yet. Create one and publish it for the portal.</p>}
    </>
  );
}
