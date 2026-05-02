import type { Database } from 'better-sqlite3';

export interface CatalogItemRow {
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
  form_schema_json: string;
  is_published: number;
  created_at: string;
  updated_at: string;
}

export function listPublished(db: Database): CatalogItemRow[] {
  return db
    .prepare('SELECT * FROM service_catalog_items WHERE is_published = 1 ORDER BY name')
    .all() as CatalogItemRow[];
}

export function listAll(db: Database): CatalogItemRow[] {
  return db.prepare('SELECT * FROM service_catalog_items ORDER BY name').all() as CatalogItemRow[];
}

export function findById(db: Database, id: number): CatalogItemRow | undefined {
  return db.prepare('SELECT * FROM service_catalog_items WHERE id = ?').get(id) as CatalogItemRow | undefined;
}

export function insertItem(db: Database, row: Omit<CatalogItemRow, 'id'>): number {
  const r = db
    .prepare(
      `INSERT INTO service_catalog_items (
        name, description, type, default_category, default_subcategory,
        default_impact, default_urgency, default_priority, requires_manager_approval,
        form_schema_json, is_published, created_at, updated_at
      ) VALUES (
        @name, @description, @type, @default_category, @default_subcategory,
        @default_impact, @default_urgency, @default_priority, @requires_manager_approval,
        @form_schema_json, @is_published, @created_at, @updated_at
      )`,
    )
    .run(row);
  return Number(r.lastInsertRowid);
}

export function updateItem(db: Database, id: number, patch: Partial<Omit<CatalogItemRow, 'id'>>): void {
  const keys = Object.keys(patch).filter((k) => patch[k as keyof typeof patch] !== undefined);
  if (keys.length === 0) return;
  const sets = keys.map((k) => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE service_catalog_items SET ${sets} WHERE id = @id`).run({ ...patch, id });
}

export function deleteItem(db: Database, id: number): void {
  db.prepare('DELETE FROM service_catalog_items WHERE id = ?').run(id);
}
