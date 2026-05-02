import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { env } from '../config/env.js';
import { SCHEMA_SQL_FULL } from './schema.js';
import { parseFormSchemaJsonToExtraFields } from '../services/catalogFormFields.js';

let dbInstance: Database.Database | null = null;

function migrateTicketsCatalogLink(db: Database.Database): void {
  const cols = db.prepare(`PRAGMA table_info(tickets)`).all() as { name: string }[];
  if (!cols.some((c) => c.name === 'catalog_item_id')) {
    db.exec(`ALTER TABLE tickets ADD COLUMN catalog_item_id INTEGER REFERENCES service_catalog_items(id)`);
  }
}

function migrateCatalogExtraFormFields(db: Database.Database): void {
  const cols = db.prepare(`PRAGMA table_info(service_catalog_items)`).all() as { name: string }[];
  if (!cols.some((c) => c.name === 'extra_form_fields_json')) {
    db.exec(`ALTER TABLE service_catalog_items ADD COLUMN extra_form_fields_json TEXT NOT NULL DEFAULT '[]'`);
  }
  const rows = db.prepare(`SELECT id, form_schema_json, extra_form_fields_json FROM service_catalog_items`).all() as {
    id: number;
    form_schema_json: string;
    extra_form_fields_json: string;
  }[];
  const upd = db.prepare(`UPDATE service_catalog_items SET extra_form_fields_json = ? WHERE id = ?`);
  for (const r of rows) {
    if (r.extra_form_fields_json && r.extra_form_fields_json !== '[]') continue;
    const parsed = parseFormSchemaJsonToExtraFields(r.form_schema_json);
    if (parsed.length === 0) continue;
    upd.run(JSON.stringify(parsed), r.id);
  }
}

export function getDb(): Database.Database {
  if (!dbInstance) {
    const resolved = path.resolve(process.cwd(), env.dbPath);
    const dir = path.dirname(resolved);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    dbInstance = new Database(resolved);
    dbInstance.pragma('foreign_keys = ON');
    dbInstance.exec(SCHEMA_SQL_FULL);
    migrateTicketsCatalogLink(dbInstance);
    migrateCatalogExtraFormFields(dbInstance);
  }
  return dbInstance;
}

export function resetDbSingleton(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
