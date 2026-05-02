import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, apiMultipart } from '../api';
import { AttachmentPicker } from '../components/AttachmentPicker';
import { VoiceToTextButton } from '../components/VoiceToTextButton';

interface Item {
  id: number;
  name: string;
  description: string;
  form_schema_json: string;
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

  function parseFields(): { name: string; label: string }[] {
    if (!item) return [];
    try {
      const schema = JSON.parse(item.form_schema_json) as { fields?: { name: string; label: string }[] };
      return schema.fields ?? [];
    } catch {
      return [];
    }
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

  const fields = parseFields();

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
      {fields.map((f) => (
        <TextField
          key={f.name}
          label={f.label || f.name}
          fullWidth
          value={extra[f.name] ?? ''}
          onChange={(e) => setExtra({ ...extra, [f.name]: e.target.value })}
          sx={{ mb: 2 }}
        />
      ))}
      <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
        Schema: {item.form_schema_json.slice(0, 200)}
        {item.form_schema_json.length > 200 ? '…' : ''}
      </Typography>
      <Button type="submit" variant="contained">
        Submit request
      </Button>
    </Box>
  );
}
