export interface SearchEntry {
  id: string;
  type: 'project' | 'article' | 'tool' | 'experiment';
  title: string;
  summary: string;
  text: string;
  tags: string[];
  path: string;
}
export function normalizeQuery(value: string): string {
  return Array.from(value.normalize('NFKC').toLowerCase().trim()).slice(0, 100).join('');
}
export function searchEntries(entries: SearchEntry[], query: string): SearchEntry[] {
  const normalized = normalizeQuery(query);
  if (!normalized) return [];
  const terms = normalized.split(/\s+/);
  return entries
    .map((entry) => {
      const title = normalizeQuery(entry.title);
      const fields = [entry.title, ...entry.tags, entry.summary, entry.text]
        .join(' ')
        .normalize('NFKC')
        .toLowerCase();
      if (!terms.every((term) => fields.includes(term))) return { entry, score: 0 };
      let score = title === normalized ? 100 : 0;
      for (const term of terms) {
        score += title.includes(term) ? 30 : 0;
        score += entry.tags.some((t) => normalizeQuery(t).includes(term)) ? 10 : 0;
        score += normalizeQuery(entry.summary).includes(term) ? 5 : 0;
        score += fields.includes(term) ? 1 : 0;
      }
      return { entry, score };
    })
    .filter((r) => r.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        `${a.entry.type}/${a.entry.id}`.localeCompare(`${b.entry.type}/${b.entry.id}`),
    )
    .map((r) => r.entry);
}
export function appendHighlighted(parent: HTMLElement, text: string, query: string): void {
  const terms = normalizeQuery(query).split(/\s+/).filter(Boolean);
  const normalized = text.normalize('NFKC').toLowerCase();
  // Only mark spans when normalization preserves UTF-16 positions; otherwise safe plain text.
  if (normalized.length !== text.length || !terms.length) {
    parent.append(document.createTextNode(text));
    return;
  }
  let position = 0;
  while (position < text.length) {
    let start = -1,
      len = 0;
    for (const term of terms) {
      const at = normalized.indexOf(term, position);
      if (at >= 0 && (start < 0 || at < start)) {
        start = at;
        len = term.length;
      }
    }
    if (start < 0) {
      parent.append(document.createTextNode(text.slice(position)));
      break;
    }
    parent.append(document.createTextNode(text.slice(position, start)));
    const mark = document.createElement('mark');
    mark.textContent = text.slice(start, start + len);
    parent.append(mark);
    position = start + len;
  }
}
