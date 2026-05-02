import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { api } from '../../api';

export interface CatalogItemDto {
  id: number;
  name: string;
  description: string;
  type: string;
  default_category: string | null;
  default_subcategory: string | null;
  default_impact: string | null;
  default_urgency: string | null;
  default_priority: string | null;
  requires_manager_approval: number;
  is_published: number;
  updated_at: string;
}

export function AdminCatalogListPage() {
  const [items, setItems] = useState<CatalogItemDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const r = await api<{ items: CatalogItemDto[] }>('/catalog/items');
      setItems(r.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load catalog');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, mb: 3 }}>
        <Typography variant="h4" sx={{ flexGrow: 1 }}>
          Service Catalog
        </Typography>
        <Button variant="outlined" component={RouterLink} to="/admin">
          Back to Admin
        </Button>
        <Button variant="contained" startIcon={<AddIcon />} component={RouterLink} to="/admin/catalog/new">
          New catalog item
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Configure offerings shown on the self-service portal: defaults for tickets, optional approval, and extra form fields
        (JSON schema).
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Name</TableCell>
              <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Category</TableCell>
              <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Impact / Urgency</TableCell>
              <TableCell>Published</TableCell>
              <TableCell>Approval</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((row) => (
              <TableRow key={row.id} hover>
                <TableCell>{row.id}</TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {row.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'block', md: 'none' } }}>
                    {[row.default_category, row.default_subcategory].filter(Boolean).join(' · ') || '—'}
                  </Typography>
                </TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                  {[row.default_category, row.default_subcategory].filter(Boolean).join(' · ') || '—'}
                </TableCell>
                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                  {(row.default_impact ?? '—') + ' / ' + (row.default_urgency ?? '—')}
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={row.is_published === 1 ? 'Yes' : 'No'}
                    color={row.is_published === 1 ? 'success' : 'default'}
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={row.requires_manager_approval === 1 ? 'Required' : 'No'}
                    variant="outlined"
                  />
                </TableCell>
                <TableCell align="right">
                  <Button size="small" startIcon={<EditIcon />} component={RouterLink} to={`/admin/catalog/${row.id}`}>
                    Configure
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {items.length === 0 && !error && (
        <Typography color="text.secondary" sx={{ mt: 2 }}>
          No items yet. Create one to appear on the portal (when published).
        </Typography>
      )}
    </Box>
  );
}
