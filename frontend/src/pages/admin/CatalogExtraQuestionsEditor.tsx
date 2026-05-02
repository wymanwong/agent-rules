import Add from '@mui/icons-material/Add';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import {
  Box,
  Button,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';

export interface ExtraQuestionRow {
  key: string;
  label: string;
  kind: 'short_text' | 'paragraph';
}

interface Props {
  value: ExtraQuestionRow[];
  onChange: (rows: ExtraQuestionRow[]) => void;
}

/** Simple catalog form builder — no JSON required */
export function CatalogExtraQuestionsEditor({ value, onChange }: Props) {
  function updateRow(index: number, patch: Partial<ExtraQuestionRow>) {
    const next = [...value];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  }

  function addRow() {
    onChange([...value, { key: '', label: '', kind: 'short_text' }]);
  }

  function removeRow(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle2" gutterBottom>
        Extra questions for requesters
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
        Add one row per question. <strong>Question label</strong> is what users see. <strong>Field key</strong> is optional —
        leave blank and we generate one from the label (for storing answers).
      </Typography>

      {value.map((row, index) => (
        <Box
          key={index}
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 2,
            alignItems: 'flex-start',
            mb: 2,
            p: 2,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
          }}
        >
          <TextField
            label="Question label"
            size="small"
            sx={{ flex: '2 1 200px', minWidth: 160 }}
            value={row.label}
            onChange={(e) => updateRow(index, { label: e.target.value })}
            required
          />
          <TextField
            label="Field key (optional)"
            size="small"
            sx={{ flex: '1 1 140px', minWidth: 120 }}
            value={row.key}
            onChange={(e) => updateRow(index, { key: e.target.value })}
            placeholder="auto"
          />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Answer type</InputLabel>
            <Select
              label="Answer type"
              value={row.kind}
              onChange={(e) => updateRow(index, { kind: e.target.value as ExtraQuestionRow['kind'] })}
            >
              <MenuItem value="short_text">Short answer (one line)</MenuItem>
              <MenuItem value="paragraph">Paragraph (several lines)</MenuItem>
            </Select>
          </FormControl>
          <IconButton aria-label="remove question" onClick={() => removeRow(index)} color="error">
            <DeleteOutlinedIcon />
          </IconButton>
        </Box>
      ))}

      <Button startIcon={<Add />} variant="outlined" size="small" onClick={addRow}>
        Add question
      </Button>
    </Box>
  );
}
