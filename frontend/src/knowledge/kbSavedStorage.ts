const KEY = 'helpdesk_kb_saved_ids';

function readIds(): number[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
  } catch {
    return [];
  }
}

function writeIds(ids: number[]): void {
  localStorage.setItem(KEY, JSON.stringify(ids));
}

export function isArticleSaved(id: number): boolean {
  return readIds().includes(id);
}

export function toggleSavedArticle(id: number): boolean {
  const ids = readIds();
  const i = ids.indexOf(id);
  if (i >= 0) {
    ids.splice(i, 1);
    writeIds(ids);
    return false;
  }
  ids.unshift(id);
  writeIds(ids.slice(0, 200));
  return true;
}

export function listSavedArticleIds(): number[] {
  return readIds();
}
