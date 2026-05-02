import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material';
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

  if (!item) return <Typography>Loading…</Typography>;

  const questionRows = fields();

  return (
    <Box component="form" onSubmit={submit} sx={{ maxWidth: 720 }}>
      <Typography variant="h4" gutterBottom>
        {item.name}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        {item.description}
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <TextField label="Title" fullWidth value={title} onChange={(e) => setTitle(e.target.value)} sx={{ mb: 2 }} />
      <Stack sx={{ flexDirection: 'row', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="subtitle2">Details</Typography>
        <VoiceToTextButton onAppend={(t) => setDescription((prev) => `${prev}${t}`)} />
      </Stack>
      <TextField
        label="Description / details"
        fullWidth
        multiline
        minRows={3}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        sx={{ mb: 2 }}
      />
      <AttachmentPicker files={files} onFilesChange={setFiles} helperText="Attach files or capture a photo before submitting." />
      {questionRows.map((f) => (
        <TextField
          key={f.key || f.label}
          label={f.label || f.key}
          fullWidth
          multiline={f.kind === 'paragraph'}
          minRows={f.kind === 'paragraph' ? 3 : 1}
          value={extra[f.key] ?? ''}
          onChange={(e) => setExtra({ ...extra, [f.key]: e.target.value })}
          sx={{ mb: 2 }}
        />
      ))}
      <Button type="submit" variant="contained">
        Submit request
      </Button>
    </Box>
  );
}
