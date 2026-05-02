import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import {
  Alert,
  Box,
  Button,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api';
import type { CatalogItemDto } from './AdminCatalogListPage';

const IMPACTS = ['SingleUser', 'Department', 'Site', 'Organization'] as const;
const URGENCIES = ['Low', 'Medium', 'High', 'Critical'] as const;
const PRIORITIES = ['', 'P1', 'P2', 'P3', 'P4'] as const;

const DEFAULT_SCHEMA = `{
  "fields": [
    { "name": "details", "label": "Additional details", "type": "text" }
  ]
}`;

function normalizeSchemaJson(raw: string): string {
  const parsed = JSON.parse(raw) as unknown;
  return JSON.stringify(parsed);
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
  const [formSchemaJson, setFormSchemaJson] = useState(DEFAULT_SCHEMA);

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
        const r = await api<{ item: CatalogItemDto & { form_schema_json: string } }>(`/catalog/items/${idNum}`);
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
        try {
          setFormSchemaJson(JSON.stringify(JSON.parse(it.form_schema_json || '{}'), null, 2));
        } catch {
          setFormSchemaJson(it.form_schema_json || DEFAULT_SCHEMA);
        }
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
    let schemaStr: string;
    try {
      schemaStr = normalizeSchemaJson(formSchemaJson);
    } catch {
      setError('Form schema must be valid JSON');
      return;
    }

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
      form_schema_json: schemaStr,
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
    return <Typography>Loading…</Typography>;
  }

  if (!isNew && Number.isNaN(idNum)) {
    return <Alert severity="error">Invalid catalog item ID.</Alert>;
  }

  return (
    <Box component="form" onSubmit={handleSave} sx={{ maxWidth: 720 }}>
      <Typography variant="h4" gutterBottom>
        {isNew ? 'New catalog item' : `Configure catalog item #${idNum}`}
      </Typography>
      <Button component={RouterLink} to="/admin/catalog" sx={{ mb: 2 }}>
        ← Back to catalog list
      </Button>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TextField label="Name" fullWidth required value={name} onChange={(e) => setName(e.target.value)} sx={{ mb: 2 }} />
      <TextField
        label="Description"
        fullWidth
        required
        multiline
        minRows={3}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        sx={{ mb: 2 }}
      />

      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>Type</InputLabel>
        <Select label="Type" value={type} onChange={(e) => setType(e.target.value)}>
          <MenuItem value="ServiceRequest">ServiceRequest</MenuItem>
        </Select>
      </FormControl>

      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        Ticket defaults (applied when a user submits this catalog request)
      </Typography>
      <TextField
        label="Default category"
        fullWidth
        value={defaultCategory}
        onChange={(e) => setDefaultCategory(e.target.value)}
        sx={{ mb: 2 }}
      />
      <TextField
        label="Default subcategory"
        fullWidth
        value={defaultSubcategory}
        onChange={(e) => setDefaultSubcategory(e.target.value)}
        sx={{ mb: 2 }}
      />

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
        <FormControl sx={{ minWidth: 200, flex: '1 1 200px' }}>
          <InputLabel>Default impact</InputLabel>
          <Select
            label="Default impact"
            value={defaultImpact}
            onChange={(e) => setDefaultImpact(e.target.value as (typeof IMPACTS)[number])}
          >
            {IMPACTS.map((i) => (
              <MenuItem key={i} value={i}>
                {i}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl sx={{ minWidth: 200, flex: '1 1 200px' }}>
          <InputLabel>Default urgency</InputLabel>
          <Select
            label="Default urgency"
            value={defaultUrgency}
            onChange={(e) => setDefaultUrgency(e.target.value as (typeof URGENCIES)[number])}
          >
            {URGENCIES.map((u) => (
              <MenuItem key={u} value={u}>
                {u}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl sx={{ minWidth: 200, flex: '1 1 200px' }}>
          <InputLabel>Default priority</InputLabel>
          <Select label="Default priority" value={defaultPriority} onChange={(e) => setDefaultPriority(e.target.value)}>
            <MenuItem value="">Derive from impact × urgency</MenuItem>
            {PRIORITIES.filter(Boolean).map((p) => (
              <MenuItem key={p} value={p}>
                {p}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <FormControlLabel
        control={<Switch checked={requiresApproval} onChange={(e) => setRequiresApproval(e.target.checked)} />}
        label="Requires manager approval (pending approval workflow)"
        sx={{ display: 'block', mb: 1 }}
      />
      <FormControlLabel
        control={<Switch checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} />}
        label="Published (visible on self-service catalog)"
        sx={{ display: 'block', mb: 2 }}
      />

      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle2" gutterBottom>
        Extra form fields (JSON)
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
        Use <code>{`{ "fields": [ { "name": "...", "label": "...", "type": "text" } ] }`}</code>. Stored verbatim; invalid JSON
        blocks save.
      </Typography>
      <TextField
        label="form_schema_json"
        fullWidth
        multiline
        minRows={10}
        value={formSchemaJson}
        onChange={(e) => setFormSchemaJson(e.target.value)}
        sx={{ mb: 2, fontFamily: 'monospace' }}
        slotProps={{ htmlInput: { style: { fontFamily: 'inherit' } } }}
      />

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        <Button type="submit" variant="contained">
          Save
        </Button>
        <Button component={RouterLink} to="/admin/catalog" variant="outlined">
          Cancel
        </Button>
        {!isNew && (
          <Button type="button" color="error" variant="outlined" startIcon={<DeleteOutlinedIcon />} onClick={() => void handleDelete()}>
            Delete
          </Button>
        )}
      </Box>
    </Box>
  );
}
