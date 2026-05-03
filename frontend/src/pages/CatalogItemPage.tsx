import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, apiMultipart } from '../api';
import { AttachmentPicker } from '../components/AttachmentPicker';
import { VoiceToTextButton } from '../components/VoiceToTextButton';

interface ExtraFieldDef {
  key: string;
  label: string;
  kind: 'short_text' | 'paragraph';
}

interface Item {
  id: number;
  name: string;
  description: string;
  extra_form_fields?: ExtraFieldDef[];
  default_category: string | null;
  requires_manager_approval: number;
}

export function CatalogItemPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<Item | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    void api<{ items: Item[] }>('/catalog/items').then((r) => {
      const found = r.items.find((x) => x.id === Number(id));
      setItem(found ?? null);
      if (found) {
        setTitle(found.name);
        setDescription(found.description);
      }
    });
  }, [id]);

  function fields(): ExtraFieldDef[] {
    const ef = item?.extra_form_fields;
    if (Array.isArray(ef) && ef.length > 0) {
      return ef.map((f) => ({
        key: String(f.key ?? ''),
        label: String(f.label ?? ''),
        kind: f.kind === 'paragraph' ? 'paragraph' : 'short_text',
      }));
    }
    return [];
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setError(null);
    try {
      const fd = new FormData();
      fd.append('title', title);
      fd.append('description', description);
      fd.append('extra_json', JSON.stringify(extra));

      for (const f of files) {
        fd.append('attachments', f);
      }

      const res = await apiMultipart<{ ticket: { id: number } }>(`/catalog/items/${id}/requests/multipart`, fd);
      navigate(`/tickets/${res.ticket.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  if (!item) return <div className="text-secondary">Loading…</div>;

  const questionRows = fields();

  return (
    <>
      <div className="page-header mb-4">
        <h2 className="page-title">{item.name}</h2>
        <div className="text-secondary">{item.description}</div>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      <form onSubmit={submit} className="row g-3" style={{ maxWidth: 720 }}>
        <div className="col-12">
          <label className="form-label">Title</label>
          <input type="text" className="form-control" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="col-12">
          <div className="d-flex align-items-center gap-2 mb-1">
            <label className="form-label mb-0">Details</label>
            <VoiceToTextButton onAppend={(t) => setDescription((prev) => `${prev}${t}`)} />
          </div>
          <textarea
            className="form-control"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="col-12">
          <AttachmentPicker files={files} onFilesChange={setFiles} helperText="Attach files or capture a photo before submitting." />
        </div>
        {questionRows.map((f) => (
          <div key={f.key || f.label} className="col-12">
            <label className="form-label">{f.label || f.key}</label>
            {f.kind === 'paragraph' ? (
              <textarea
                className="form-control"
                rows={3}
                value={extra[f.key] ?? ''}
                onChange={(e) => setExtra({ ...extra, [f.key]: e.target.value })}
              />
            ) : (
              <input
                type="text"
                className="form-control"
                value={extra[f.key] ?? ''}
                onChange={(e) => setExtra({ ...extra, [f.key]: e.target.value })}
              />
            )}
          </div>
        ))}
        <div className="col-12">
          <button type="submit" className="btn btn-primary">
            Submit request
          </button>
        </div>
      </form>
    </>
  );
}
