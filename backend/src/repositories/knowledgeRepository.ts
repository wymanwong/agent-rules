import type { PoolClient } from 'pg';
import { mapRows, query } from '../db/pg.js';

export interface KnowledgeArticleRow {
  id: number;
  title: string;
  body: string;
  body_format: string;
  category: string | null;
  tags: string | null;
  is_published: number;
  created_at: string;
  updated_at: string;
}

export async function listArticles(
  db: PoolClient | null,
  opts: { publishedOnly?: boolean; category?: string; search?: string },
): Promise<KnowledgeArticleRow[]> {
  void db;
  const cond: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  if (opts.publishedOnly) {
    cond.push('is_published = 1');
  }
  if (opts.category) {
    cond.push(`category = $${i++}`);
    params.push(opts.category);
  }
  if (opts.search) {
    cond.push(`(title ILIKE $${i} OR body ILIKE $${i + 1})`);
    const s = `%${opts.search}%`;
    params.push(s, s);
    i += 2;
  }
  const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
  const r = await query<KnowledgeArticleRow>(
    `SELECT * FROM knowledge_articles ${where} ORDER BY updated_at DESC`,
    params,
  );
  return mapRows(r.rows);
}

export async function findArticle(db: PoolClient | null, id: number): Promise<KnowledgeArticleRow | undefined> {
  void db;
  const r = await query<KnowledgeArticleRow>('SELECT * FROM knowledge_articles WHERE id = $1', [id]);
  return mapRows(r.rows)[0];
}

export async function insertArticle(db: PoolClient | null, row: Omit<KnowledgeArticleRow, 'id'>): Promise<number> {
  void db;
  const fmt = row.body_format || 'markdown';
  const r = await query<{ id: number }>(
    `INSERT INTO knowledge_articles (title, body, body_format, category, tags, is_published, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [row.title, row.body, fmt, row.category, row.tags, row.is_published, row.created_at, row.updated_at],
  );
  return r.rows[0]!.id;
}

export async function updateArticle(db: PoolClient | null, id: number, patch: Partial<Omit<KnowledgeArticleRow, 'id'>>): Promise<void> {
  void db;
  const keys = Object.keys(patch).filter((k) => patch[k as keyof typeof patch] !== undefined) as (keyof typeof patch)[];
  if (keys.length === 0) return;
  const sets = keys.map((k, i) => `${String(k)} = $${i + 2}`).join(', ');
  const vals = keys.map((k) => patch[k]);
  await query(`UPDATE knowledge_articles SET ${sets} WHERE id = $1`, [id, ...vals]);
}

export async function deleteArticle(db: PoolClient | null, id: number): Promise<void> {
  void db;
  await query('DELETE FROM knowledge_articles WHERE id = $1', [id]);
}
