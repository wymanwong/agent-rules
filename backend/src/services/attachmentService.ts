import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { Express } from 'express';
import { resolvedUploadsDir } from '../config/env.js';
import * as attachmentRepo from '../repositories/attachmentRepository.js';

function sanitizeOriginal(name: string): string {
  const base = path.basename(name || 'file').replace(/[^\w.\-\s()+]/g, '_');
  return base.slice(0, 180) || 'file';
}

export async function persistUploadedFiles(
  db: PoolClient | null,
  ticketId: number,
  uploadedByUserId: number,
  files: Express.Multer.File[],
): Promise<void> {
  if (!files?.length) return;
  const baseDir = path.join(resolvedUploadsDir(), 'tickets', String(ticketId));
  await fs.mkdir(baseDir, { recursive: true });
  const now = new Date().toISOString();

  for (const file of files) {
    const storedName = `${randomUUID()}_${sanitizeOriginal(file.originalname)}`;
    const absPath = path.join(baseDir, storedName);
    await fs.writeFile(absPath, file.buffer);
    const relPath = path.posix.join('tickets', String(ticketId), storedName);
    await attachmentRepo.insertAttachment(db, {
      ticket_id: ticketId,
      uploaded_by_user_id: uploadedByUserId,
      original_filename: file.originalname,
      stored_relative_path: relPath.replace(/\\/g, '/'),
      mime_type: file.mimetype || 'application/octet-stream',
      size_bytes: file.size,
      created_at: now,
    });
  }
}

export function absoluteAttachmentPath(storedRelativePath: string): string {
  return path.join(resolvedUploadsDir(), storedRelativePath.replace(/\//g, path.sep));
}

export async function deleteAttachmentSync(db: PoolClient | null, attachmentId: number): Promise<boolean> {
  const row = await attachmentRepo.findById(db, attachmentId);
  if (!row) return false;
  const abs = absoluteAttachmentPath(row.stored_relative_path);
  try {
    fsSync.unlinkSync(abs);
  } catch {
    /* ignore missing file */
  }
  await attachmentRepo.deleteAttachment(db, attachmentId);
  return true;
}
