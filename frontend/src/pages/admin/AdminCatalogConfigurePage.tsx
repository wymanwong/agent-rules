import { IconTrash } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api';
import type { CatalogItemDto } from './AdminCatalogListPage';
import { CatalogExtraQuestionsEditor, type ExtraQuestionRow } from './CatalogExtraQuestionsEditor';

const IMPACTS = ['SingleUser', 'Department', 'Site', 'Organization'] as const;
const URGENCIES = ['Low', 'Medium', 'High', 'Critical'] as const;
const PRIORITIES = ['', 'P1', 'P2', 'P3', 'P4'] as const;

interface CatalogApiItem extends CatalogItemDto {
  extra_form_fields?: ExtraQuestionRow[];
}

export function AdminCatalogConfigurePage() {
  const { catalogId } = useParams<{ catalogId: string }>();
  const navigate = useNavigate();
  const isNew = catalogId === undefined || catalogId === 'new';
  const idNum = !isNew ? Number(catalogId) : NaN;

  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('ServiceRequest');
  const [defaultCategory, setDefaultCategory] = useState('');
  const [defaultSubcategory, setDefaultSubcategory] = useState('');
  const [defaultImpact, setDefaultImpact] = useState<(typeof IMPACTS)[number]>('SingleUser');
  const [defaultUrgency, setDefaultUrgency] = useState<(typeof URGENCIES)[number]>('Medium');
  const [defaultPriority, setDefaultPriority] = useState<string>('');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [isPublished, setIsPublished] = useState(true);
  const [extraQuestions, setExtraQuestions] = useState<ExtraQuestionRow[]>([]);

  useEffect(() => {
    if (isNew || Number.isNaN(idNum)) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await api<{ item: CatalogApiItem }>(`/catalog/items/${idNum}`);
        if (cancelled) return;
        const it = r.item;
        setName(it.name);
        setDescription(it.description);
        setType(it.type ?? 'ServiceRequest');
        setDefaultCategory(it.default_category ?? '');
        setDefaultSubcategory(it.default_subcategory ?? '');
        setDefaultImpact((it.default_impact as (typeof IMPACTS)[number]) ?? 'SingleUser');
        setDefaultUrgency((it.default_urgency as (typeof URGENCIES)[number]) ?? 'Medium');
        setDefaultPriority(it.default_priority ?? '');
        setRequiresApproval(it.requires_manager_approval === 1);
        setIsPublished(it.is_published === 1);
        const ef = it.extra_form_fields;
        setExtraQuestions(
          Array.isArray(ef) && ef.length > 0
            ? ef.map((x) => ({
                key: typeof x.key === 'string' ? x.key : '',
                label: typeof x.label === 'string' ? x.label : '',
                kind: x.kind === 'paragraph' ? 'paragraph' : 'short_text',
              }))
            : [],
        );
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load item');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isNew, idNum]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = extraQuestions
      .map((r) => ({
        key: r.key.trim(),
        label: r.label.trim(),
        kind: r.kind,
      }))
      .filter((r) => r.label.length > 0);

    const body = {
      name,
      description,
      type,
      default_category: defaultCategory || null,
      default_subcategory: defaultSubcategory || null,
      default_impact: defaultImpact,
      default_urgency: defaultUrgency,
      default_priority: defaultPriority || null,
      requires_manager_approval: requiresApproval,
      extra_form_fields: trimmed,
      is_published: isPublished,
    };

    try {
      if (isNew) {
        await api<{ id: number }>('/catalog/items', { method: 'POST', json: body });
        navigate('/admin/catalog');
      } else {
        await api(`/catalog/items/${idNum}`, { method: 'PATCH', json: body });
        navigate('/admin/catalog');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  }

  async function handleDelete() {
    if (isNew) return;
    if (!window.confirm('Delete this catalog item? This cannot be undone.')) return;
    setError(null);
    try {
      await api(`/catalog/items/${idNum}`, { method: 'DELETE' });
      navigate('/admin/catalog');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  if (loading) {
    return <div className="text-secondary">Loading…</div>;
  }

  if (!isNew && Number.isNaN(idNum)) {
    return <div className="alert alert-danger">Invalid catalog item ID.</div>;
  }

  return (
    <>
      <div className="page-header mb-4">
        <h2 className="page-title">{isNew ? 'New catalog item' : `Configure catalog item #${idNum}`}</h2>
      </div>
      <Link to="/admin/catalog" className="btn btn-outline-secondary btn-sm mb-3">
        ← Back to catalog list
      </Link>

      {error && <div className="alert alert-danger">{error}</div>}

      <form onSubmit={handleSave} className="row g-3" style={{ maxWidth: 720 }}>
        <div className="col-12">
          <label className="form-label required">Name</label>
          <input type="text" className="form-control" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="col-12">
          <label className="form-label required">Description</label>
          <textarea className="form-control" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} required />
        </div>
        <div className="col-12">
          <label className="form-label">Type</label>
          <select className="form-select" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="ServiceRequest">ServiceRequest</option>
          </select>
        </div>

        <div className="col-12">
          <hr />
          <h4 className="mb-3">Ticket defaults</h4>
        </div>
        <div className="col-md-6">
          <label className="form-label">Default category</label>
          <input type="text" className="form-control" value={defaultCategory} onChange={(e) => setDefaultCategory(e.target.value)} />
        </div>
        <div className="col-md-6">
          <label className="form-label">Default subcategory</label>
          <input type="text" className="form-control" value={defaultSubcategory} onChange={(e) => setDefaultSubcategory(e.target.value)} />
        </div>
        <div className="col-md-4">
          <label className="form-label">Default impact</label>
          <select className="form-select" value={defaultImpact} onChange={(e) => setDefaultImpact(e.target.value as (typeof IMPACTS)[number])}>
            {IMPACTS.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </div>
        <div className="col-md-4">
          <label className="form-label">Default urgency</label>
          <select className="form-select" value={defaultUrgency} onChange={(e) => setDefaultUrgency(e.target.value as (typeof URGENCIES)[number])}>
            {URGENCIES.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
        <div className="col-md-4">
          <label className="form-label">Default priority</label>
          <select className="form-select" value={defaultPriority} onChange={(e) => setDefaultPriority(e.target.value)}>
            <option value="">Derive from impact × urgency</option>
            {PRIORITIES.filter(Boolean).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div className="col-12">
          <label className="form-check">
            <input type="checkbox" className="form-check-input" checked={requiresApproval} onChange={(e) => setRequiresApproval(e.target.checked)} />
            <span className="form-check-label">Requires manager approval</span>
          </label>
        </div>
        <div className="col-12">
          <label className="form-check">
            <input type="checkbox" className="form-check-input" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} />
            <span className="form-check-label">Published on self-service catalog</span>
          </label>
        </div>

        <div className="col-12">
          <hr />
          <CatalogExtraQuestionsEditor value={extraQuestions} onChange={setExtraQuestions} />
        </div>

        <div className="col-12 btn-list">
          <button type="submit" className="btn btn-primary">
            Save
          </button>
          <Link to="/admin/catalog" className="btn btn-outline-secondary">
            Cancel
          </Link>
          {!isNew && (
            <button type="button" className="btn btn-outline-danger" onClick={() => void handleDelete()}>
              <IconTrash size={18} className="me-1" />
              Delete
            </button>
          )}
        </div>
      </form>
    </>
  );
}
