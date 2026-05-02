import type { Database } from 'better-sqlite3';

export interface KnowledgeArticleRow {
  id: number;
  title: string;
  body: string;
  category: string | null;
  tags: string | null;
  is_published: number;
  created_at: string;
  updated_at: string;
}

export function listArticles(
  db: Database,
  opts: { publishedOnly?: boolean; category?: string; search?: string },
): KnowledgeArticleRow[] {
  const cond: string[] = [];
  const params: unknown[] = [];
  if (opts.publishedOnly) {
    cond.push('is_published = 1');
  }
  if (opts.category) {
    cond.push('category = ?');
    params.push(opts.category);
  }
  if (opts.search) {
    cond.push('(title LIKE ? OR body LIKE ?)');
    params.push(`%${opts.search}%`, `%${opts.search}%`);
  }
  const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
  return db.prepare(`SELECT * FROM knowledge_articles ${where} ORDER BY updated_at DESC`).all(...params) as KnowledgeArticleRow[];
}

export function findArticle(db: Database, id: number): KnowledgeArticleRow | undefined {
  return db.prepare('SELECT * FROM knowledge_articles WHERE id = ?').get(id) as KnowledgeArticleRow | undefined;
}

export function insertArticle(db: Database, row: Omit<KnowledgeArticleRow, 'id'>): number {
  const r = db
    .prepare(
      `INSERT INTO knowledge_articles (title, body, category, tags, is_published, created_at, updated_at)
       VALUES (@title, @body, @category, @tags, @is_published, @created_at, @updated_at)`,
    )
    .run(row);
  return Number(r.lastInsertRowid);
}

export function updateArticle(db: Database, id: number, patch: Partial<Omit<KnowledgeArticleRow, 'id'>>): void {
  const keys = Object.keys(patch).filter((k) => patch[k as keyof typeof patch] !== undefined);
  if (keys.length === 0) return;
  const sets = keys.map((k) => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE knowledge_articles SET ${sets} WHERE id = @id`).run({ ...patch, id });
}

export function deleteArticle(db: Database, id: number): void {
  db.prepare('DELETE FROM knowledge_articles WHERE id = ?').run(id);
}
