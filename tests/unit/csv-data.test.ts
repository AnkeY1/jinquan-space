import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CSV_DEFAULT_OPTIONS,
  CSV_LIMITS,
  CsvError,
  csvDisplayPoints,
  csvNumber,
  decodeCsv,
  deriveCsv,
  parseCsv,
  validateCsvFileSize,
} from '../../src/lib/csv-data';
import type { CsvPoint } from '../../src/lib/csv-data';

const sample = readFileSync(new URL('../fixtures/csv-sample-data.csv', import.meta.url), 'utf8');
const boundaries = readFileSync(new URL('../fixtures/csv-boundaries.csv', import.meta.url), 'utf8');

describe('strict CSV numbers', () => {
  it.each([
    ['12', 12],
    [' -0.4 ', -0.4],
    ['.5', 0.5],
    ['2.', 2],
    ['1.2e-3', 0.0012],
    ['-900', -900],
    ['-0.125', -0.125],
    ['+12', 12],
    ['9007199254740991', 9007199254740991],
  ])('accepts %s without partial parsing', (text, value) =>
    expect(csvNumber(text)).toEqual({ value, code: null }),
  );
  it.each([
    '',
    ' ',
    '12abc',
    'Infinity',
    'NaN',
    '0x10',
    '1,234',
    '__proto__',
    'constructor',
    '<img src=x onerror=alert(1)>',
    '<script>alert(1)</script>',
    '=HYPERLINK("https://example.invalid/","demo")',
    '+SUM(1,2)',
    '@SUM(1,2)',
    '\t=1+1',
    '\\t=1+1',
    '  =1+1',
  ])('rejects %s', (text) => expect(csvNumber(text).value).toBeNull());
  it('rejects unsafe integer and overflow explicitly', () => {
    expect(csvNumber('9007199254740993').code).toBe('UNSAFE_INTEGER');
    expect(csvNumber('1e309').code).toBe('NOT_FINITE');
  });
});

describe('CSV parsing and selection', () => {
  it('preserves standard quoted fields and multiline cells', () => {
    const data = parseCsv(sample);
    expect(data.dataRowCount).toBe(4);
    expect(data.rows).toHaveLength(4);
    expect(data.rows[1].cells[3]).toBe('包含,逗号');
    expect(data.rows[2].cells[3]).toBe('包含"引号"');
    expect(data.rows[3].cells[3]).toBe('第一行\n第二行');
    expect(data.rows[3].line).toBe(5);
    const view = deriveCsv(data, { x: 0, ys: [1, 2] });
    expect(view.points.map((point) => point.ys[0])).toEqual([1, 2, null, 4]);
    expect(view.points.map((point) => point.ys[1])).toEqual([0.1, 0.2, 0.3, null]);
    expect(view.series[0].stats.count).toBe(3);
    expect(view.series[0].stats.mean).toBeCloseTo(7 / 3, 12);
    expect(view.series[0].stats.median).toBe(2);
    expect(view.series[0].stats.stddev).toBeCloseTo(1.247219128924647, 12);
    expect(view.series[0].invalidCount).toBe(1);
  });
  it('uses stable numeric indexes with duplicate, empty and special headers', () => {
    const data = parseCsv(boundaries);
    expect(data.columns.map((column) => column.label)).toEqual([
      '__proto__',
      '温度（第 2 列）',
      '第 3 列',
      '温度（第 4 列）',
      'constructor',
    ]);
    expect(data.columns[1].unsafeCount).toBe(1);
    expect(deriveCsv(data, { x: 'row', ys: [1, 2, 3] }).points[4].ys).toEqual([-900, -0.125, 8]);
    expect({}.constructor).toBe(Object);
  });
  it('detects allowed delimiters and supports no header, BOM and empty lines', () => {
    expect(parseCsv('\ufeffx\ty\n0\t1\n\n1\t2').delimiter).toBe('\t');
    const data = parseCsv('0;1\r\n1;2\r\n', { ...CSV_DEFAULT_OPTIONS, header: false });
    expect(data.delimiter).toBe(';');
    expect(data.columns.map((column) => column.label)).toEqual(['第 1 列', '第 2 列']);
    expect(data.rows.map((row) => row.dataRow)).toEqual([1, 2]);
    expect(parseCsv('x,y\n,\n1,2').rows).toHaveLength(2);
  });
  it('excludes mismatched records with exact physical start lines', () => {
    const data = parseCsv('x,y\n0,"first\nsecond"\n1\n2,3\n');
    expect(data.dataRowCount).toBe(3);
    expect(data.invalidRowCount).toBe(1);
    expect(data.issues[0]).toMatchObject({ line: 4, dataRow: 2, code: 'COLUMN_MISMATCH' });
    expect(data.rows[1]).toMatchObject({ line: 5, dataRow: 3 });
  });
  it('fails on broken quote boundaries rather than returning partial results', () => {
    expect(() => parseCsv('x,y\n1,"never closed\n2,3')).toThrow(/引号/);
    expect(() => parseCsv('')).toThrow(/没有非空/);
    expect(() => parseCsv('x,y\n')).toThrow(/没有可用/);
  });
  it('keeps original nonmonotonic order and excludes invalid X across series', () => {
    const data = parseCsv('x,a,b\n3,1,2\n1,3,4\ninvalid,5,6\n1,,8\n2,9,10');
    const view = deriveCsv(data, { x: 0, ys: [1, 2] });
    expect(view.nonMonotonic).toBe(true);
    expect(view.points.map((point) => point.x)).toEqual([3, 1, null, 1, 2]);
    expect(view.points[2].ys).toEqual([null, null]);
    expect(view.points[3].ys).toEqual([null, 8]);
    expect(view.series[0].stats.count).toBe(3);
    expect(view.series[1].stats.count).toBe(4);
    expect(view.invalidXCount).toBe(1);
    expect(view.series[0].stats.mean).toBeCloseTo(13 / 3, 12);
  });
  it('limits selections to one through four unique columns', () => {
    const data = parseCsv('a,b,c,d,e\n1,2,3,4,5');
    expect(deriveCsv(data, { x: 'row', ys: [0, 1, 2, 3] }).series).toHaveLength(4);
    [[], [0, 1, 2, 3, 4], [1, 1], [9]].forEach((ys) =>
      expect(() => deriveCsv(data, { x: 'row', ys })).toThrow(CsvError),
    );
  });
});

describe('CSV resource protection and decoding', () => {
  it('rejects oversized input before a file read is needed', () => {
    expect(() => validateCsvFileSize(CSV_LIMITS.bytes + 1)).toThrow(/10 MiB/);
    expect(() => validateCsvFileSize(0)).toThrow(/为空/);
    expect(() => validateCsvFileSize(CSV_LIMITS.bytes)).not.toThrow();
  });
  it('strictly decodes UTF-8 and rejects binary content', () => {
    expect(decodeCsv(new TextEncoder().encode('\ufeffx,y\n1,2').buffer, 'utf-8')).toBe('x,y\n1,2');
    expect(() => decodeCsv(new Uint8Array([0xff, 0xff]).buffer, 'utf-8')).toThrow(/解码/);
    expect(() => decodeCsv(new Uint8Array([97, 0, 98]).buffer, 'utf-8')).toThrow(/二进制/);
    expect(decodeCsv(new Uint8Array([0xd6, 0xd0, 0xce, 0xc4]).buffer, 'gb18030')).toBe('中文');
  });
  it('aborts inside Papa step on record, column and cell limits', () => {
    let completed = 0;
    expect(() =>
      parseCsv(`x\n${'1\n'.repeat(CSV_LIMITS.rows + 1)}`, CSV_DEFAULT_OPTIONS, (done) => {
        completed = done;
      }),
    ).toThrow(/数据行超过/);
    expect(completed).toBeGreaterThan(0);
    expect(() => parseCsv(`${Array.from({ length: 101 }, () => 'x').join(',')}\n1`)).toThrow(
      /列数超过/,
    );
    const header = Array.from({ length: 100 }, (_, index) => `c${index}`).join(',');
    const row = Array.from({ length: 100 }, () => '1').join(',');
    expect(() => parseCsv(`${header}\n${`${row}\n`.repeat(20_001)}`)).toThrow(/单元格超过/);
  });
});

describe('CSV display decimation', () => {
  it('preserves spikes, order and hard gaps while leaving source intact', () => {
    const points: CsvPoint[] = Array.from({ length: 10_000 }, (_, index) => ({
      dataRow: index + 1,
      line: index + 2,
      x: 10_000 - index,
      ys: [index === 5555 ? 9999 : index === 6666 ? -9999 : index === 5000 ? null : 0],
    }));
    const displayed = csvDisplayPoints(points, 0, 400);
    expect(displayed.some((point) => point[1] === 9999)).toBe(true);
    expect(displayed.some((point) => point[1] === -9999)).toBe(true);
    expect(displayed.some((point) => point[1] === null)).toBe(true);
    expect(
      displayed.every((point, index) => index === 0 || point[0]! < displayed[index - 1][0]!),
    ).toBe(true);
    expect(displayed.length).toBeLessThan(500);
    expect(points).toHaveLength(10_000);
    expect(points[5555].ys[0]).toBe(9999);
  });
});
