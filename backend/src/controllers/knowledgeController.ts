import type { Response } from 'express';
import type { PoolClient } from 'pg';
import type { AuthRequest } from '../middleware/auth.js';
import { HttpError } from '../middleware/errorHandler.js';
import * as kbRepo from '../repositories/knowledgeRepository.js';
import { emitLive } from '../live/liveHub.js';

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
      const id = await kbRepo.insertArticle(null, {
        title: String(b.title ?? ''),
        body: String(b.body ?? ''),
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
  };
}
