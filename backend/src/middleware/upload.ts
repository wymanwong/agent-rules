import multer from 'multer';
import type { RequestHandler } from 'express';
import { env } from '../config/env.js';

const limits = {
  fileSize: env.maxUploadMb * 1024 * 1024,
};

/** Files buffered in memory; controller persists under uploads/tickets/:id after ticket exists */
export function uploadAttachmentsMemory(maxFiles = 15): RequestHandler {
  return multer({
    storage: multer.memoryStorage(),
    limits: {
      ...limits,
      files: maxFiles,
    },
  }).array('attachments', maxFiles);
}
