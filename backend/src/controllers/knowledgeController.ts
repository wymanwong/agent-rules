import type { Response } from 'express';
import type { Database } from 'better-sqlite3';
import type { AuthRequest } from '../middleware/auth.js';
import { HttpError } from '../middleware/errorHandler.js';
import * as kbRepo from '../repositories/knowledgeRepository.js';

export function createKnowledgeController(db: Database) {
  return {
    list: (req: AuthRequest, res: Response): void => {
      const q = req.query;
      const publishedOnly = req.user?.role !== 'Admin' ? true : q.publishedOnly !== 'false';
      const items = kbRepo.listArticles(db, {
        publishedOnly,
        category: q.category as string | undefined,
        search: q.search as string | undefined,
      });
      res.json({ articles: items });
    },

    getById: (req: AuthRequest, res: Response): void => {
      const id = Number(req.params.id);
      const article = kbRepo.findArticle(db, id);
      if (!article) throw new HttpError(404, 'Article not found');
      if (article.is_published !== 1 && req.user?.role !== 'Admin') {
        throw new HttpError(404, 'Article not found');
      }
      res.json({ article });
    },

    create: (req: AuthRequest, res: Response): void => {
      const b = req.body as Record<string, unknown>;
      const now = new Date().toISOString();
      const id = kbRepo.insertArticle(db, {
        title: String(b.title ?? ''),
        body: String(b.body ?? ''),
        category: b.category != null ? String(b.category) : null,
        tags: b.tags != null ? String(b.tags) : null,
        is_published: b.is_published ? 1 : 0,
        created_at: now,
        updated_at: now,
      });
      res.status(201).json({ id });
    },

    update: (req: AuthRequest, res: Response): void => {
      const id = Number(req.params.id);
      const existing = kbRepo.findArticle(db, id);
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
      kbRepo.updateArticle(db, id, patch);
      res.json({ ok: true });
    },

    delete: (req: AuthRequest, res: Response): void => {
      const id = Number(req.params.id);
      kbRepo.deleteArticle(db, id);
      res.json({ ok: true });
    },
  };
}
