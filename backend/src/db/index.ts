import { ensurePgSchema, closePool } from './pg.js';

let schemaReady = false;

export async function initDatabase(): Promise<void> {
  if (!schemaReady) {
    await ensurePgSchema();
    schemaReady = true;
  }
}

export { closePool };
