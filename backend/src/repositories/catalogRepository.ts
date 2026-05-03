import type { PoolClient } from 'pg';
import { mapRows, query } from '../db/pg.js';

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
  extra_form_fields_json: string;
  is_published: number;
  created_at: string;
  updated_at: string;
}

export async function listPublished(db: PoolClient | null): Promise<CatalogItemRow[]> {
  void db;
  const r = await query<CatalogItemRow>('SELECT * FROM service_catalog_items WHERE is_published = 1 ORDER BY name');
  return mapRows(r.rows);
}

export async function listAll(db: PoolClient | null): Promise<CatalogItemRow[]> {
  void db;
  const r = await query<CatalogItemRow>('SELECT * FROM service_catalog_items ORDER BY name');
  return mapRows(r.rows);
}

export async function findById(db: PoolClient | null, id: number): Promise<CatalogItemRow | undefined> {
  void db;
  const r = await query<CatalogItemRow>('SELECT * FROM service_catalog_items WHERE id = $1', [id]);
  return mapRows(r.rows)[0];
}

export async function insertItem(db: PoolClient | null, row: Omit<CatalogItemRow, 'id'>): Promise<number> {
  void db;
  const r = await query<{ id: number }>(
    `INSERT INTO service_catalog_items (
        name, description, type, default_category, default_subcategory,
        default_impact, default_urgency, default_priority, requires_manager_approval,
        form_schema_json, extra_form_fields_json, is_published, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
    [
      row.name,
      row.description,
      row.type,
      row.default_category,
      row.default_subcategory,
      row.default_impact,
      row.default_urgency,
      row.default_priority,
      row.requires_manager_approval,
      row.form_schema_json,
      row.extra_form_fields_json,
      row.is_published,
      row.created_at,
      row.updated_at,
    ],
  );
  return r.rows[0]!.id;
}

export async function updateItem(db: PoolClient | null, id: number, patch: Partial<Omit<CatalogItemRow, 'id'>>): Promise<void> {
  void db;
  const keys = Object.keys(patch).filter((k) => patch[k as keyof typeof patch] !== undefined) as (keyof typeof patch)[];
  if (keys.length === 0) return;
  const sets = keys.map((k, i) => `${String(k)} = $${i + 2}`).join(', ');
  const vals = keys.map((k) => patch[k]);
  await query(`UPDATE service_catalog_items SET ${sets} WHERE id = $1`, [id, ...vals]);
}

export async function deleteItem(db: PoolClient | null, id: number): Promise<void> {
  void db;
  await query('DELETE FROM service_catalog_items WHERE id = $1', [id]);
}
