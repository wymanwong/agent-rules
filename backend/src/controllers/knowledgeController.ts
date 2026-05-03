import type { Response } from 'express';
import type { PoolClient } from 'pg';
import fs from 'node:fs';
import type { Express } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { HttpError } from '../middleware/errorHandler.js';
import * as kbRepo from '../repositories/knowledgeRepository.js';
import { emitLive } from '../live/liveHub.js';
import {
  absoluteKnowledgeImagePath,
  persistKnowledgeImage,
} from '../services/knowledgeImageService.js';

export function createKnowledgeController(_db: PoolClient | null) {
  void _db;
  return {
    list: async (req: AuthRequest, res: Response): Promise<void> => {
      const q = req.query;
      const publishedOnly = req.user?.role !== 'Admin' ? true : q.publishedOnly !== 'false';
      const items = await kbRepo.listArticles(null, {
        publishedOnly,
        category: q.category as string | undefined,
        search: q.search as string | undefined,
      });
      res.json({ articles: items });
    },

    getById: async (req: AuthRequest, res: Response): Promise<void> => {
      const id = Number(req.params.id);
      const article = await kbRepo.findArticle(null, id);
      if (!article) throw new HttpError(404, 'Article not found');
      if (article.is_published !== 1 && req.user?.role !== 'Admin') {
        throw new HttpError(404, 'Article not found');
      }
      res.json({ article });
    },

    create: async (req: AuthRequest, res: Response): Promise<void> => {
      const b = req.body as Record<string, unknown>;
      const now = new Date().toISOString();
      const bodyFormatRaw = b.body_format != null ? String(b.body_format) : 'html';
      const body_format =
        bodyFormatRaw === 'plain' ? 'plain' : bodyFormatRaw === 'markdown' ? 'markdown' : 'html';
      const id = await kbRepo.insertArticle(null, {
        title: String(b.title ?? ''),
        body: String(b.body ?? ''),
        body_format,
        category: b.category != null ? String(b.category) : null,
        tags: b.tags != null ? String(b.tags) : null,
        is_published: b.is_published ? 1 : 0,
        created_at: now,
        updated_at: now,
      });
      emitLive({ type: 'knowledge', at: now });
      res.status(201).json({ id });
    },

    update: async (req: AuthRequest, res: Response): Promise<void> => {
      const id = Number(req.params.id);
      const existing = await kbRepo.findArticle(null, id);
      if (!existing) throw new HttpError(404, 'Article not found');
      const b = req.body as Record<string, unknown>;
      const patch: Partial<Omit<kbRepo.KnowledgeArticleRow, 'id'>> = {
        updated_at: new Date().toISOString(),
      };
      if (b.title !== undefined) patch.title = String(b.title);
      if (b.body !== undefined) patch.body = String(b.body);
      if (b.body_format !== undefined) {
        const f = String(b.body_format);
        patch.body_format = f === 'plain' ? 'plain' : f === 'markdown' ? 'markdown' : 'html';
      }
      if (b.category !== undefined) patch.category = b.category as string | null;
      if (b.tags !== undefined) patch.tags = b.tags as string | null;
      if (b.is_published !== undefined) patch.is_published = b.is_published ? 1 : 0;
      await kbRepo.updateArticle(null, id, patch);
      emitLive({ type: 'knowledge', at: patch.updated_at! });
      res.json({ ok: true });
    },

    delete: async (req: AuthRequest, res: Response): Promise<void> => {
      const id = Number(req.params.id);
      await kbRepo.deleteArticle(null, id);
      emitLive({ type: 'knowledge', at: new Date().toISOString() });
      res.json({ ok: true });
    },

    uploadBodyImage: async (req: AuthRequest, res: Response): Promise<void> => {
      if (!req.user) throw new HttpError(401, 'Unauthorized');
      const id = Number(req.params.id);
      const article = await kbRepo.findArticle(null, id);
      if (!article) throw new HttpError(404, 'Article not found');
      const file = req.file as Express.Multer.File | undefined;
      if (!file?.buffer?.length) throw new HttpError(400, 'No image uploaded');
      try {
        const urlPath = await persistKnowledgeImage(id, file);
        emitLive({ type: 'knowledge', at: new Date().toISOString() });
        res.status(201).json({ url: urlPath });
      } catch (e) {
        if (e instanceof Error && e.message === 'INVALID_IMAGE_TYPE') {
          throw new HttpError(400, 'Only PNG, JPEG, GIF, WebP, or SVG images are allowed');
        }
        throw e;
      }
    },

    serveBodyImage: async (req: AuthRequest, res: Response): Promise<void> => {
      const id = Number(req.params.id);
      const filename = String(req.params.filename ?? '');
      const article = await kbRepo.findArticle(null, id);
      if (!article) throw new HttpError(404, 'Article not found');
      if (article.is_published !== 1 && req.user?.role !== 'Admin') {
        throw new HttpError(404, 'Article not found');
      }
      const abs = absoluteKnowledgeImagePath(id, filename);
      if (!abs || !fs.existsSync(abs)) throw new HttpError(404, 'Image not found');
      const lower = filename.toLowerCase();
      if (lower.endsWith('.png')) res.setHeader('Content-Type', 'image/png');
      else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) res.setHeader('Content-Type', 'image/jpeg');
      else if (lower.endsWith('.gif')) res.setHeader('Content-Type', 'image/gif');
      else if (lower.endsWith('.webp')) res.setHeader('Content-Type', 'image/webp');
      else if (lower.endsWith('.svg')) res.setHeader('Content-Type', 'image/svg+xml');
      res.sendFile(abs, (err) => {
        if (err && !res.headersSent) {
          res.status(500).json({ error: 'Image read failed' });
        }
      });
    },
  };
}
