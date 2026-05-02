import dotenv from 'dotenv';

dotenv.config();

import path from 'node:path';

export const env = {
  port: Number(process.env.PORT) || 4000,
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  dbPath: process.env.DB_PATH || './data/helpdesk.db',
  uploadsDir: process.env.UPLOADS_DIR || './data/uploads',
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB) || 15,
  nodeEnv: process.env.NODE_ENV || 'development',
};

export function resolvedUploadsDir(): string {
  return path.resolve(process.cwd(), env.uploadsDir);
}
