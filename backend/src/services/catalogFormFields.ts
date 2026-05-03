/** User-friendly catalog extra fields — stored as JSON array in DB */

export interface ExtraFormField {
  /** Stable key for submitted data (letters, numbers, underscore) */
  key: string;
  /** Label shown to users */
  label: string;
  /** Single line vs multi-line input */
  kind: 'short_text' | 'paragraph';
}

const slugKey = (label: string, index: number): string => {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48);
  return base || `field_${index + 1}`;
};

/** Stored in DB column extra_form_fields_json */
export function normalizeExtraFields(raw: unknown): ExtraFormField[] {
  if (!Array.isArray(raw)) return [];
  const out: ExtraFormField[] = [];
  raw.forEach((row, i) => {
    if (!row || typeof row !== 'object') return;
    const r = row as Record<string, unknown>;
    const label = typeof r.label === 'string' ? r.label.trim() : '';
    if (!label) return;
    let key = typeof r.key === 'string' ? r.key.trim().replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 64) : '';
    if (!key) key = slugKey(label, i);
    const kind = r.kind === 'paragraph' ? 'paragraph' : 'short_text';
    out.push({ key, label, kind });
  });
  return out;
}

/** Legacy portal expects form_schema_json.fields */
export function extraFieldsToFormSchemaJson(fields: ExtraFormField[]): string {
  return JSON.stringify({
    fields: fields.map((f) => ({
      name: f.key,
      label: f.label,
      type: f.kind === 'paragraph' ? 'textarea' : 'text',
    })),
  });
}

export function parseFormSchemaJsonToExtraFields(form_schema_json: string): ExtraFormField[] {
  try {
    const o = JSON.parse(form_schema_json) as { fields?: { name?: string; label?: string; type?: string }[] };
    const fields = o.fields ?? [];
    return fields.map((f, i) => ({
      key: (f.name && String(f.name).trim()) || slugKey(String(f.label ?? ''), i),
      label: String(f.label ?? f.name ?? `Question ${i + 1}`),
      kind: f.type === 'textarea' ? 'paragraph' : 'short_text',
    }));
  } catch {
    return [];
  }
}
