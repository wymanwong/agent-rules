import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiMultipart } from '../api';
import { AttachmentPicker } from '../components/AttachmentPicker';
import { VoiceToTextButton } from '../components/VoiceToTextButton';

const impacts = ['SingleUser', 'Department', 'Site', 'Organization'] as const;
const urgencies = ['Low', 'Medium', 'High', 'Critical'] as const;

export function ReportIncidentPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [impact, setImpact] = useState<(typeof impacts)[number]>('SingleUser');
  const [urgency, setUrgency] = useState<(typeof urgencies)[number]>('Medium');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

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
      if (category.trim()) fd.append('category', category.trim());
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
    <Box component="form" onSubmit={submit} sx={{ maxWidth: 720 }}>
      <Typography variant="h4" gutterBottom>
        Report an Incident
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <TextField label="Title" fullWidth required value={title} onChange={(e) => setTitle(e.target.value)} sx={{ mb: 2 }} />
      <Stack sx={{ flexDirection: 'row', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="subtitle2">Description</Typography>
        <VoiceToTextButton onAppend={(t) => setDescription((prev) => `${prev}${t}`)} />
      </Stack>
      <TextField
        label="Describe what is broken"
        fullWidth
        required
        multiline
        minRows={4}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        sx={{ mb: 2 }}
      />
      <AttachmentPicker
        files={files}
        onFilesChange={setFiles}
        helperText="Add screenshots, PDFs, or other files (server limit applies). Use Camera on mobile when supported."
      />
      <TextField label="Category" fullWidth value={category} onChange={(e) => setCategory(e.target.value)} sx={{ mb: 2 }} />
      <TextField
        label="Subcategory"
        fullWidth
        value={subcategory}
        onChange={(e) => setSubcategory(e.target.value)}
        sx={{ mb: 2 }}
      />
      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>Impact</InputLabel>
        <Select label="Impact" value={impact} onChange={(e) => setImpact(e.target.value as (typeof impacts)[number])}>
          {impacts.map((i) => (
            <MenuItem key={i} value={i}>
              {i}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>Urgency</InputLabel>
        <Select label="Urgency" value={urgency} onChange={(e) => setUrgency(e.target.value as (typeof urgencies)[number])}>
          {urgencies.map((u) => (
            <MenuItem key={u} value={u}>
              {u}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <Button type="submit" variant="contained">
        Submit incident
      </Button>
    </Box>
  );
}
