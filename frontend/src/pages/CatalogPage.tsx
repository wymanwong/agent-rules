import { Box, Button, Card, CardActions, CardContent, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

interface CatalogItem {
  id: number;
  name: string;
  description: string;
  requires_manager_approval: number;
}

export function CatalogPage() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    void api<{ items: CatalogItem[] }>('/catalog/items').then((r) => setItems(r.items));
  }, []);

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Service Catalog
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Choose a standard service request. Some items require manager approval.
      </Typography>
      {items.map((it) => (
        <Card key={it.id} sx={{ mb: 2 }} variant="outlined">
          <CardContent>
            <Typography variant="h6">{it.name}</Typography>
            <Typography variant="body2" color="text.secondary">
              {it.description}
            </Typography>
            {it.requires_manager_approval === 1 && (
              <Typography variant="caption" color="warning.main">
                Requires approval
              </Typography>
            )}
          </CardContent>
          <CardActions>
            <Button onClick={() => navigate(`/catalog/${it.id}`)}>Request</Button>
          </CardActions>
        </Card>
      ))}
    </Box>
  );
}
