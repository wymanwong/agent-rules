import { describe, it, expect } from 'vitest';
import { normalizeExtraFields, extraFieldsToFormSchemaJson } from './catalogFormFields.js';

describe('catalogFormFields', () => {
  it('fills key from label when empty', () => {
    const f = normalizeExtraFields([{ label: 'Software Name', kind: 'short_text' }]);
    expect(f[0].key).toBe('software_name');
    expect(f[0].label).toBe('Software Name');
  });

  it('maps to legacy form_schema shape', () => {
    const json = extraFieldsToFormSchemaJson([
      { key: 'x', label: 'X', kind: 'paragraph' },
    ]);
    const o = JSON.parse(json) as { fields: { name: string; type: string }[] };
    expect(o.fields[0].name).toBe('x');
    expect(o.fields[0].type).toBe('textarea');
  });
});
