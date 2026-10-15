import { searchEntries, appendHighlighted, normalizeQuery, type SearchEntry } from '../lib/search';
const app = document.querySelector<HTMLElement>('#search-app')!;
const input = document.querySelector<HTMLInputElement>('#search-query')!;
const status = document.querySelector<HTMLElement>('#search-status')!;
const results = document.querySelector<HTMLElement>('#search-results')!;
const retry = document.querySelector<HTMLButtonElement>('#search-retry')!;
let index: SearchEntry[] | null = null,
  composing = false,
  timer: ReturnType<typeof setTimeout>,
  generation = 0;
const types = { project: '项目', article: '文章', tool: '工具', experiment: '实验' };
async function run(save = true) {
  const id = ++generation;
  const query = normalizeQuery(input.value);
  if (save) {
    history.replaceState(null, '', query ? `#q=${encodeURIComponent(query)}` : location.pathname);
  }
  results.replaceChildren();
  retry.hidden = true;
  if (!query) {
    status.textContent = '输入关键词，开始探索。';
    return;
  }
  status.textContent = index ? '正在搜索…' : '正在加载站内索引…';
  try {
    if (!index) {
      const response = await fetch(app.dataset.index!);
      if (!response.ok) throw new Error('index');
      const value: unknown = await response.json();
      if (
        !Array.isArray(value) ||
        !value.every(
          (e) =>
            e &&
            typeof e.title === 'string' &&
            typeof e.path === 'string' &&
            e.path.startsWith('/'),
        )
      )
        throw new Error('schema');
      index = value as SearchEntry[];
    }
    if (id !== generation) return;
    const matches = searchEntries(index, query);
    status.textContent = matches.length
      ? `找到 ${matches.length} 条结果`
      : `没有找到“${query}”相关内容。可以换个关键词，或浏览项目与文章。`;
    for (const entry of matches) {
      const article = document.createElement('article');
      article.className = 'search-result';
      const label = document.createElement('span');
      label.className = 'result-type';
      label.textContent = types[entry.type];
      const h2 = document.createElement('h2'),
        link = document.createElement('a');
      link.href = app.dataset.base + entry.path.slice(1);
      appendHighlighted(link, entry.title, query);
      h2.append(link);
      const p = document.createElement('p');
      appendHighlighted(p, entry.summary, query);
      article.append(label, h2, p);
      results.append(article);
    }
  } catch {
    if (id === generation) {
      status.textContent = '索引加载失败，请检查连接后重试。';
      retry.hidden = false;
    }
  }
}
input.addEventListener('compositionstart', () => {
  composing = true;
  clearTimeout(timer);
});
input.addEventListener('compositionend', () => {
  composing = false;
  clearTimeout(timer);
  timer = setTimeout(() => void run(), 150);
});
input.addEventListener('input', () => {
  if (!composing) {
    clearTimeout(timer);
    timer = setTimeout(() => void run(), 150);
  }
});
document.querySelector('#search-form')!.addEventListener('submit', (e) => {
  e.preventDefault();
  clearTimeout(timer);
  void run();
});
retry.addEventListener('click', () => void run());
document.querySelector('#search-clear')!.addEventListener('click', () => {
  input.value = '';
  void run();
  input.focus();
});
function fromHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  input.value = Array.from(p.get('q') || '')
    .slice(0, 100)
    .join('');
  void run(false);
}
window.addEventListener('hashchange', fromHash);
fromHash();
