import { IconFileUnknown } from '@tabler/icons-react';

export type PreviewCategory = 'image' | 'pdf' | 'video' | 'audio' | 'text' | 'none';

export function attachmentPreviewCategory(mime: string): PreviewCategory {
  const m = mime.toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m === 'application/pdf' || m.endsWith('/pdf')) return 'pdf';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return 'audio';
  if (m.startsWith('text/') || m.includes('json') || m.includes('xml') || m === 'application/javascript') {
    return 'text';
  }
  return 'none';
}

interface Props {
  open: boolean;
  filename: string;
  mimeType: string;
  blobUrl: string | null;
  textContent: string | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}

export function AttachmentPreviewModal({
  open,
  filename,
  mimeType,
  blobUrl,
  textContent,
  loading,
  error,
  onClose,
}: Props) {
  if (!open) return null;

  const category = attachmentPreviewCategory(mimeType);

  return (
    <>
      <div
        className="modal modal-blur fade show d-block"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="attachment-preview-title"
      >
        <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="attachment-preview-title">
                {filename}
              </h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
            </div>
            <div className="modal-body">
              {loading && <div className="text-secondary py-5 text-center">Loading preview…</div>}
              {!loading && error && <div className="alert alert-danger mb-0">{error}</div>}
              {!loading && !error && category === 'image' && blobUrl && (
                <div className="text-center">
                  <img src={blobUrl} alt={filename} className="img-fluid rounded" />
                </div>
              )}
              {!loading && !error && category === 'pdf' && blobUrl && (
                <iframe
                  title={filename}
                  src={blobUrl}
                  className="w-100 rounded border"
                  style={{ height: '70vh', border: '1px solid var(--tblr-border-color)' }}
                />
              )}
              {!loading && !error && category === 'video' && blobUrl && (
                <video src={blobUrl} controls className="w-100 rounded" style={{ maxHeight: '70vh' }}>
                  <track kind="captions" />
                </video>
              )}
              {!loading && !error && category === 'audio' && blobUrl && (
                <div className="text-center py-3">
                  <audio src={blobUrl} controls className="w-100" style={{ maxWidth: 480 }}>
                    <track kind="captions" />
                  </audio>
                </div>
              )}
              {!loading && !error && category === 'text' && textContent !== null && (
                <pre className="bg-body-tertiary p-3 rounded small mb-0" style={{ maxHeight: '65vh', overflow: 'auto' }}>
                  {textContent}
                </pre>
              )}
              {!loading && !error && category === 'none' && (
                <div className="text-center text-secondary py-4">
                  <IconFileUnknown className="mb-2" size={48} stroke={1} />
                  <p className="mb-2">No in-browser preview for this file type ({mimeType || 'unknown'}).</p>
                  <p className="small mb-0">Use Download to open it in another app.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" aria-hidden="true" onClick={onClose} />
    </>
  );
}
