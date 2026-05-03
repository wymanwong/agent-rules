import { type ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, apiMultipart } from '../../api';
import { KNOWLEDGE_CATEGORY_LABELS } from '../../constants/knowledgeCategories';

interface Article {
  id: number;
  title: string;
  body: string;
  body_format: string;
  category: string | null;
  tags: string | null;
  is_published: number;
}

export function KbArticleEditorPage() {
  const { id: idParam } = useParams();
  const navigate = useNavigate();
  const isNew = idParam === 'new' || !idParam;
  const id = isNew ? null : Number(idParam);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [bodyFormat, setBodyFormat] = useState<'markdown' | 'plain'>('markdown');
  const [category, setCategory] = useState<string>(KNOWLEDGE_CATEGORY_LABELS[0] ?? 'General');
  const [tags, setTags] = useState('');
  const [isPublished, setIsPublished] = useState(true);
  const [loading, setLoading] = useState(!isNew);
  const [msg, setMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (isNew || !id || Number.isNaN(id)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void api<{ article: Article }>(`/knowledge/articles/${id}`)
      .then((r) => {
        const a = r.article;
        setTitle(a.title);
        setBody(a.body);
        setBodyFormat(a.body_format === 'plain' ? 'plain' : 'markdown');
        setCategory(a.category || KNOWLEDGE_CATEGORY_LABELS[0] || 'General');
        setTags(a.tags ?? '');
        setIsPublished(a.is_published === 1);
      })
      .catch(() => setMsg('Failed to load article'))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  const insertAtCursor = useCallback((snippet: string) => {
    const ta = document.getElementById('kb-editor-body') as HTMLTextAreaElement | null;
    if (!ta) {
      setBody((b) => `${b}${snippet}`);
      return;
    }
    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? ta.value.length;
    const next = ta.value.slice(0, start) + snippet + ta.value.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + snippet.length;
      ta.setSelectionRange(pos, pos);
    });
  }, []);

  const onPickImage = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onImageSelected = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file || isNew || !id) {
        setMsg(isNew || !id ? 'Save the article first, then you can insert images.' : null);
        return;
      }
      setUploading(true);
      setMsg(null);
      try {
        const fd = new FormData();
        fd.append('image', file);
        const r = await apiMultipart<{ url: string }>(`/knowledge/articles/${id}/body-images`, fd);
        const md = bodyFormat === 'markdown' ? `\n\n![](${r.url})\n\n` : `\n${r.url}\n`;
        insertAtCursor(md);
      } catch (err) {
        setMsg(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setUploading(false);
      }
    },
    [bodyFormat, id, insertAtCursor, isNew],
  );

  const save = useCallback(async () => {
    setMsg(null);
    try {
      if (isNew) {
        const newId = await api<{ id: number }>('/knowledge/articles', {
          method: 'POST',
          json: {
            title: title.trim() || 'Untitled',
            body,
            body_format: bodyFormat,
            category,
            tags: tags.trim() || null,
            is_published: isPublished,
          },
        });
        navigate(`/admin/knowledge/${newId.id}`, { replace: true });
        return;
      }
      if (!id) return;
      await api(`/knowledge/articles/${id}`, {
        method: 'PATCH',
        json: {
          title: title.trim() || 'Untitled',
          body,
          body_format: bodyFormat,
          category,
          tags: tags.trim() || null,
          is_published: isPublished,
        },
      });
      setMsg('Saved');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Save failed');
    }
  }, [body, bodyFormat, category, id, isNew, isPublished, navigate, tags, title]);

  if (loading) return <div className="text-secondary">Loading…</div>;

  return (
    <>
      <div className="page-header mb-3">
        <div className="row align-items-center">
          <div className="col">
            <h2 className="page-title">{isNew ? 'New knowledge article' : `Edit article #${id}`}</h2>
            <div className="text-secondary small">
              Use{' '}
              <strong>Markdown</strong> for headings, lists, bold text, and embedded images. Images are stored when you upload them after the article exists.
            </div>
          </div>
          <div className="col-auto">
            <Link to="/admin" className="btn btn-outline-secondary">
              Back to admin
            </Link>
          </div>
        </div>
      </div>
      {msg && <div className={`alert ${msg === 'Saved' ? 'alert-success' : 'alert-warning'}`}>{msg}</div>}

      <div className="card mb-3">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-8">
              <label className="form-label">Title</label>
              <input type="text" className="form-control" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="col-md-4">
              <label className="form-label">Format</label>
              <select className="form-select" value={bodyFormat} onChange={(e) => setBodyFormat(e.target.value as 'markdown' | 'plain')}>
                <option value="markdown">Markdown (rich)</option>
                <option value="plain">Plain text</option>
              </select>
            </div>
            <div className="col-md-6">
              <label className="form-label">Category</label>
              <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                {KNOWLEDGE_CATEGORY_LABELS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-6">
              <label className="form-label">Tags (comma-separated)</label>
              <input type="text" className="form-control" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="vpn, network" />
            </div>
            <div className="col-12">
              <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                <label className="form-label mb-0" htmlFor="kb-editor-body">
                  Body
                </label>
                {!isNew && id ? (
                  <>
                    <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" className="d-none" onChange={onImageSelected} />
                    <button type="button" className="btn btn-sm btn-outline-primary" disabled={uploading || bodyFormat !== 'markdown'} onClick={onPickImage}>
                      {uploading ? 'Uploading…' : 'Insert image'}
                    </button>
                    {bodyFormat !== 'markdown' && <span className="text-secondary small">Switch to Markdown to embed images.</span>}
                  </>
                ) : (
                  <span className="text-secondary small">Save once to enable image upload.</span>
                )}
              </div>
              <textarea id="kb-editor-body" className="form-control font-monospace" rows={18} value={body} onChange={(e) => setBody(e.target.value)} spellCheck />
            </div>
            <div className="col-12">
              <label className="form-check">
                <input type="checkbox" className="form-check-input" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} />
                <span className="form-check-label">Published (visible to all users)</span>
              </label>
            </div>
            <div className="col-12">
              <button type="button" className="btn btn-primary" onClick={() => void save()}>
                Save
              </button>
              {!isNew && id ? (
                <Link to={`/knowledge/${id}`} className="btn btn-link ms-2" target="_blank" rel="noopener noreferrer">
                  Preview
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
