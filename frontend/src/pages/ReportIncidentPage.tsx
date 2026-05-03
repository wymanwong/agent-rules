import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiMultipart } from '../api';
import { AttachmentPicker } from '../components/AttachmentPicker';
import { VoiceToTextButton } from '../components/VoiceToTextButton';
import {
  INCIDENT_CATEGORY_LABELS,
  INCIDENT_SUBCATEGORIES,
  type IncidentCategory,
} from '../constants/incidentTaxonomy';

const impacts = ['SingleUser', 'Department', 'Site', 'Organization'] as const;
const urgencies = ['Low', 'Medium', 'High', 'Critical'] as const;

export function ReportIncidentPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<IncidentCategory | ''>('');
  const [subcategory, setSubcategory] = useState('');
  const [impact, setImpact] = useState<(typeof impacts)[number]>('SingleUser');
  const [urgency, setUrgency] = useState<(typeof urgencies)[number]>('Medium');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  const subcategoryOptions = category ? [...INCIDENT_SUBCATEGORIES[category]] : [];

  useEffect(() => {
    if (!category) {
      setSubcategory('');
      return;
    }
    const allowed = INCIDENT_SUBCATEGORIES[category];
    if (!allowed.includes(subcategory)) setSubcategory(allowed[0] ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when category changes only
  }, [category]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const fd = new FormData();
      fd.append('type', 'Incident');
      fd.append('title', title);
      fd.append('description', description);
      fd.append('impact', impact);
      fd.append('urgency', urgency);
      fd.append('source', 'Portal');
      if (category) fd.append('category', category);
      if (subcategory.trim()) fd.append('subcategory', subcategory.trim());
      for (const f of files) {
        fd.append('attachments', f);
      }

      const res = await apiMultipart<{ ticket: { id: number } }>('/tickets/multipart', fd);
      navigate(`/tickets/${res.ticket.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  return (
    <>
      <div className="page-header mb-4">
        <h2 className="page-title">Report an Incident</h2>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      <form onSubmit={submit} className="row g-3" style={{ maxWidth: 720 }}>
        <div className="col-12">
          <label className="form-label required">Title</label>
          <input type="text" className="form-control" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="col-12">
          <div className="d-flex align-items-center gap-2 mb-1">
            <label className="form-label mb-0">Description</label>
            <VoiceToTextButton onAppend={(t) => setDescription((prev) => `${prev}${t}`)} />
          </div>
          <textarea
            className="form-control"
            rows={4}
            placeholder="Describe what is broken"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>
        <div className="col-12">
          <AttachmentPicker
            files={files}
            onFilesChange={setFiles}
            helperText="Add screenshots, PDFs, or other files. Use Camera on mobile when supported."
          />
        </div>
        <div className="col-md-6">
          <label className="form-label">Category</label>
          <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value as IncidentCategory | '')}>
            <option value="">Select category…</option>
            {INCIDENT_CATEGORY_LABELS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <div className="form-hint">Aligns with common IT service areas—helps routing and reporting.</div>
        </div>
        <div className="col-md-6">
          <label className="form-label">Subcategory</label>
          <select
            className="form-select"
            value={subcategory}
            onChange={(e) => setSubcategory(e.target.value)}
            disabled={!category}
          >
            {!category ? (
              <option value="">Choose a category first</option>
            ) : (
              subcategoryOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))
            )}
          </select>
        </div>
        <div className="col-md-6">
          <label className="form-label">Impact</label>
          <select className="form-select" value={impact} onChange={(e) => setImpact(e.target.value as (typeof impacts)[number])}>
            {impacts.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </div>
        <div className="col-md-6">
          <label className="form-label">Urgency</label>
          <select className="form-select" value={urgency} onChange={(e) => setUrgency(e.target.value as (typeof urgencies)[number])}>
            {urgencies.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
        <div className="col-12">
          <button type="submit" className="btn btn-primary">
            Submit incident
          </button>
        </div>
      </form>
    </>
  );
}
