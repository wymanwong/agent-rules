import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

interface CatalogItem {
  id: number;
  name: string;
  description: string;
  requires_manager_approval: number;
}

export function CatalogPage() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    void api<{ items: CatalogItem[] }>('/catalog/items').then((r) => setItems(r.items));
  }, []);

  return (
    <>
      <div className="page-header mb-4">
        <h2 className="page-title">Service Catalog</h2>
        <div className="text-secondary">Choose a standard service request. Some items require approval.</div>
      </div>
      {items.map((it) => (
        <div key={it.id} className="card mb-3">
          <div className="card-body">
            <h3 className="card-title">{it.name}</h3>
            <p className="text-secondary mb-2">{it.description}</p>
            {it.requires_manager_approval === 1 && <span className="badge bg-warning text-warning-fg">Requires approval</span>}
          </div>
          <div className="card-footer">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate(`/catalog/${it.id}`)}>
              Request
            </button>
          </div>
        </div>
      ))}
    </>
  );
}
