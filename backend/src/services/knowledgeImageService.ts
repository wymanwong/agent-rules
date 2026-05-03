import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import { resolvedUploadsDir } from '../config/env.js';

const KB_ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml']);

function safeImageBasename(name: string): string | null {
  const base = path.basename(name || '');
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(base) || base.length > 200) return null;
  return base;
}

export function isKbImageMime(mime: string): boolean {
  return KB_ALLOWED_MIME.has((mime || '').toLowerCase());
}

/** Persist one image under uploads/knowledge/:articleId/; returns URL path for Markdown (no origin). */
export async function persistKnowledgeImage(articleId: number, file: Express.Multer.File): Promise<string> {
  const mime = (file.mimetype || '').toLowerCase();
  if (!isKbImageMime(mime)) {
    throw new Error('INVALID_IMAGE_TYPE');
  }
  const ext =
    mime === 'image/png'
      ? '.png'
      : mime === 'image/jpeg' || mime === 'image/jpg'
        ? '.jpg'
        : mime === 'image/gif'
          ? '.gif'
          : mime === 'image/webp'
            ? '.webp'
            : mime === 'image/svg+xml'
              ? '.svg'
              : path.extname(file.originalname || '') || '.bin';
  const storedName = `${randomUUID()}${ext}`;
  const relDir = path.posix.join('knowledge', String(articleId));
  const baseDir = path.join(resolvedUploadsDir(), relDir.replace(/\//g, path.sep));
  await fs.mkdir(baseDir, { recursive: true });
  const absPath = path.join(baseDir, storedName);
  await fs.writeFile(absPath, file.buffer);
  return `/knowledge/articles/${articleId}/images/${storedName}`;
}

export function absoluteKnowledgeImagePath(articleId: number, filename: string): string | null {
  const safe = safeImageBasename(filename);
  if (!safe) return null;
  const rel = path.posix.join('knowledge', String(articleId), safe);
  return path.join(resolvedUploadsDir(), rel.replace(/\//g, path.sep));
}

export { safeImageBasename };
