import { describe, it, expect } from 'vitest';
import {
  normalizeBase,
  withBase,
  toAbsoluteSiteUrl,
  isAllowedExternalUrl,
} from '../../src/lib/url';
import { getVisibleContent } from '../../src/lib/visibility';
import { statistics } from '../../src/lib/stats';
import { csvText, escapeCsvCell } from '../../src/lib/export';
import { normalizeQuery, searchEntries, type SearchEntry } from '../../src/lib/search';
import safeMarkdown from '../../scripts/safe-markdown.mjs';
describe('U-URL-01..03', () => {
  it('root/subpath/absolute URLs', () => {
    expect(withBase('/', '/')).toBe('/');
    expect(withBase('/tools/log-analyzer/', '/portfolio/')).toBe('/portfolio/tools/log-analyzer/');
    expect(withBase('/images/a.svg', '/portfolio')).toBe('/portfolio/images/a.svg');
    expect(toAbsoluteSiteUrl('/tools/log-analyzer/', 'https://example.com', '/portfolio/')).toBe(
      'https://example.com/portfolio/tools/log-analyzer/',
    );
    expect(normalizeBase('/a/b')).toBe('/a/b/');
  });
  it('rejects protocol/query/hash confusion', () => {
    for (const p of ['https://example.com', '//evil.test', '/x?q=1', '/x#h', '/../x'])
      expect(() => withBase(p, '/')).toThrow();
    for (const p of [
      'javascript:alert(1)',
      'data:text/html,1',
      'http://x.test',
      'https://u:p@x.test',
    ])
      expect(isAllowedExternalUrl(p)).toBe(false);
    expect(isAllowedExternalUrl('https://docs.astro.build/')).toBe(true);
  });
});
describe('U-CONTENT-01..02', () => {
  it('one visibility rule', () => {
    const source = ['draft', 'preview', 'public'].map((visibility) => ({
      data: { visibility: visibility as 'draft' | 'preview' | 'public' },
    }));
    expect(getVisibleContent(source, 'preview').map((i) => i.data.visibility)).toEqual([
      'preview',
      'public',
    ]);
    expect(getVisibleContent(source, 'public').map((i) => i.data.visibility)).toEqual(['public']);
  });
  it('Markdown drops raw HTML, adapts base and rejects unsafe link/headings', () => {
    const tree = {
      type: 'root',
      children: [
        { type: 'html', value: '<script>bad</script>' },
        { type: 'heading', depth: 2 },
        { type: 'link', url: '/tools/' },
      ],
    };
    safeMarkdown({ base: '/portfolio/' })(tree);
    expect(tree.children).toHaveLength(2);
    expect(tree.children[1]).toHaveProperty('url', '/portfolio/tools/');
    expect(() => safeMarkdown()({ type: 'link', url: 'javascript:alert(1)' })).toThrow();
    expect(() =>
      safeMarkdown()({ type: 'root', children: [{ type: 'heading', depth: 4 }] }),
    ).toThrow();
  });
});
describe('U-STAT-01..02', () => {
  it('empty singleton vector and null values', () => {
    expect(statistics([]).mean).toBe(null);
    expect(statistics([7])).toEqual({ count: 1, mean: 7, median: 7, min: 7, max: 7, stddev: 0 });
    const v = [5, 8, 6, 8, 5, null];
    const s = statistics(v);
    expect(s.mean).toBe(6.4);
    expect(s.median).toBe(6);
    expect(s.stddev).toBeCloseTo(1.3564659966250536, 12);
    expect(v).toEqual([5, 8, 6, 8, 5, null]);
  });
  it('large baseline small fluctuations', () => {
    const s = statistics([1e12 + 1, 1e12 + 2, 1e12 + 3]);
    expect(s.mean).toBe(1e12 + 2);
    expect(s.stddev).toBeCloseTo(Math.sqrt(2 / 3), 10);
  });
});
describe('U-EXPORT-01..02', () => {
  it('BOM CRLF quoted text null and numeric negative', () => {
    const out = csvText(
      ['中文', 'a'],
      [
        ['含,逗号', '"引用"'],
        [-900, null],
        ['第一行\n第二行', 0.0012],
      ],
    );
    expect(out.startsWith('\uFEFF')).toBe(true);
    expect(out).toContain('"含,逗号","""引用"""\r\n');
    expect(out).toContain('-900,\r\n');
    expect(out).toContain('"第一行\n第二行",0.0012');
  });
  it('protects control/whitespace formula strings only', () => {
    for (const s of [
      '=1+1',
      '+SUM(1,2)',
      '-900',
      '@SUM(1,2)',
      '\t=1+1',
      '  =1+1',
      '\rfoo',
      '\nfoo',
    ])
      expect(escapeCsvCell(s)).toMatch(/^"?'/);
    expect(escapeCsvCell(-900)).toBe('-900');
    expect(escapeCsvCell('normal')).toBe('normal');
  });
});
describe('search normalization and ranking', () => {
  const entries: SearchEntry[] = [
    {
      id: 'a',
      type: 'article',
      title: '时间差',
      summary: '比较日志',
      text: 'UTC 原始数据',
      tags: ['日志'],
      path: '/articles/a/',
    },
    {
      id: 'b',
      type: 'tool',
      title: '日志时间差分析器',
      summary: '本地分析',
      text: 'UTC 原始数据',
      tags: ['日志'],
      path: '/tools/b/',
    },
  ];
  it('Chinese substring AND terms and deterministic weights', () => {
    expect(searchEntries(entries, '时间差').map((e) => e.id)).toEqual(['a', 'b']);
    expect(searchEntries(entries, '时间差 UTC')).toHaveLength(2);
    expect(searchEntries(entries, '时间差 不存在')).toHaveLength(0);
    expect(normalizeQuery(' ＦＦＴ ')).toBe('fft');
    expect(Array.from(normalizeQuery('好'.repeat(110)))).toHaveLength(100);
  });
  it('treats metacharacters as text', () => {
    expect(searchEntries(entries, '<img onerror=1>')).toEqual([]);
    expect(searchEntries(entries, '[')).toEqual([]);
  });
});
