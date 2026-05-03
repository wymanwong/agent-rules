import { IconCamera, IconPaperclip, IconPhoto } from '@tabler/icons-react';
import { useRef, useState } from 'react';

const ACCEPT_COMMON =
  'image/*,.pdf,.doc,.docx,.txt,.csv,.zip,.png,.jpg,.jpeg,.gif,.webp,.heic,.mp4,.mov,.webm,audio/*';

interface Props {
  files: File[];
  onFilesChange: (files: File[]) => void;
  helperText?: string;
}

export function AttachmentPicker({ files, onFilesChange, helperText }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const captureInputRef = useRef<HTMLInputElement>(null);
  const [captureSupported] = useState(() => typeof document !== 'undefined' && 'capture' in HTMLInputElement.prototype);

  function addMore(selected: FileList | null) {
    if (!selected?.length) return;
    const next = [...files];
    for (let i = 0; i < selected.length; i++) {
      next.push(selected[i]);
    }
    onFilesChange(next);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (captureInputRef.current) captureInputRef.current.value = '';
  }

  function removeAt(index: number) {
    onFilesChange(files.filter((_, i) => i !== index));
  }

  return (
    <div className="mb-3">
      <label className="form-label fw-medium">Attachments</label>
      <div className="d-flex flex-wrap gap-2 mb-2">
        <input ref={fileInputRef} type="file" hidden multiple accept={ACCEPT_COMMON} onChange={(e) => addMore(e.target.files)} />
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => fileInputRef.current?.click()}>
          <IconPaperclip size={18} className="me-1" />
          Add files
        </button>
        <input
          ref={captureInputRef}
          type="file"
          hidden
          accept="image/*"
          {...(captureSupported ? { capture: 'environment' as const } : {})}
          onChange={(e) => addMore(e.target.files)}
        />
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => captureInputRef.current?.click()}>
          <IconPhoto size={18} className="me-1" />
          Camera / photo
        </button>
        <button
          type="button"
          className="btn btn-outline-primary btn-sm"
          onClick={() => captureInputRef.current?.click()}
          title="Alternate image picker"
        >
          <IconCamera size={18} />
        </button>
      </div>
      {helperText && <div className="form-hint mb-2">{helperText}</div>}
      <div className="d-flex flex-wrap gap-1">
        {files.map((f, i) => (
          <span key={`${f.name}-${i}-${f.size}`} className="badge bg-secondary-lt text-secondary-fg">
            {f.name} ({Math.round(f.size / 1024)} KB)
            <button type="button" className="btn-close btn-close-sm ms-1" aria-label="Remove" onClick={() => removeAt(i)} />
          </span>
        ))}
      </div>
    </div>
  );
}
