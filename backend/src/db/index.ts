import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { env } from '../config/env.js';
import { SCHEMA_SQL_FULL } from './schema.js';

let dbInstance: Database.Database | null = null;

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
  }
  return dbInstance;
}

export function resetDbSingleton(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
