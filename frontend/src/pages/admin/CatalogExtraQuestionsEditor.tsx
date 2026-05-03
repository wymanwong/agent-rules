import { IconTrash } from '@tabler/icons-react';

export interface ExtraQuestionRow {
  key: string;
  label: string;
  kind: 'short_text' | 'paragraph';
}

interface Props {
  value: ExtraQuestionRow[];
  onChange: (rows: ExtraQuestionRow[]) => void;
}

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
    <div className="mb-4">
      <h4 className="mb-2">Extra questions for requesters</h4>
      <p className="text-secondary small mb-3">
        Add one row per question. <strong>Question label</strong> is what users see. <strong>Field key</strong> is optional — leave blank and we generate one from the label.
      </p>

      {value.map((row, index) => (
        <div key={index} className="card mb-3">
          <div className="card-body">
            <div className="row g-2 align-items-end">
              <div className="col-md-5">
                <label className="form-label required">Question label</label>
                <input
                  type="text"
                  className="form-control"
                  value={row.label}
                  onChange={(e) => updateRow(index, { label: e.target.value })}
                  required
                />
              </div>
              <div className="col-md-3">
                <label className="form-label">Field key (optional)</label>
                <input
                  type="text"
                  className="form-control"
                  value={row.key}
                  onChange={(e) => updateRow(index, { key: e.target.value })}
                  placeholder="auto"
                />
              </div>
              <div className="col-md-3">
                <label className="form-label">Answer type</label>
                <select
                  className="form-select"
                  value={row.kind}
                  onChange={(e) => updateRow(index, { kind: e.target.value as ExtraQuestionRow['kind'] })}
                >
                  <option value="short_text">Short answer (one line)</option>
                  <option value="paragraph">Paragraph (several lines)</option>
                </select>
              </div>
              <div className="col-md-1 text-end">
                <button type="button" className="btn btn-icon btn-outline-danger" aria-label="Remove" onClick={() => removeRow(index)}>
                  <IconTrash size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}

      <button type="button" className="btn btn-outline-primary btn-sm" onClick={addRow}>
        Add question
      </button>
    </div>
  );
}
