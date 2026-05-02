import AttachFileIcon from '@mui/icons-material/AttachFile';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import { Box, Button, Chip, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { useRef, useState } from 'react';

const ACCEPT_COMMON =
  'image/*,.pdf,.doc,.docx,.txt,.csv,.zip,.png,.jpg,.jpeg,.gif,.webp,.heic,.mp4,.mov,.webm,audio/*';

interface Props {
  files: File[];
  onFilesChange: (files: File[]) => void;
  /** Optional hint text below chips */
  helperText?: string;
}

/** Pick files from disk or capture photo/video via camera where supported (mobile/desktop). */
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
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle2" gutterBottom>
        Attachments
      </Typography>
      <Stack sx={{ flexDirection: 'row', flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 1 }}>
        <input ref={fileInputRef} type="file" hidden multiple accept={ACCEPT_COMMON} onChange={(e) => addMore(e.target.files)} />
        <Button size="small" variant="outlined" startIcon={<AttachFileIcon />} onClick={() => fileInputRef.current?.click()}>
          Add files
        </Button>
        <input
          ref={captureInputRef}
          type="file"
          hidden
          accept="image/*"
          {...(captureSupported ? { capture: 'environment' as const } : {})}
          onChange={(e) => addMore(e.target.files)}
        />
        <Tooltip title={captureSupported ? 'Take a photo with camera' : 'Choose an image (camera capture where supported)'}>
          <span>
            <Button
              size="small"
              variant="outlined"
              startIcon={<PhotoCameraIcon />}
              onClick={() => captureInputRef.current?.click()}
            >
              Camera / photo
            </Button>
          </span>
        </Tooltip>
        <Tooltip title="Some browsers open gallery instead of camera">
          <IconButton size="small" color="primary" aria-label="capture alternate" onClick={() => captureInputRef.current?.click()}>
            <CameraAltIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
      {helperText && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          {helperText}
        </Typography>
      )}
      <Stack sx={{ flexDirection: 'row', flexWrap: 'wrap', gap: 0.5 }}>
        {files.map((f, i) => (
          <Chip key={`${f.name}-${i}-${f.size}`} label={`${f.name} (${Math.round(f.size / 1024)} KB)`} onDelete={() => removeAt(i)} size="small" />
        ))}
      </Stack>
    </Box>
  );
}
