import Papa from 'papaparse';
import { statistics } from './stats';

export const CSV_LIMITS = {
  bytes: 10 * 1024 * 1024,
  rows: 100_000,
  columns: 100,
  cells: 2_000_000,
  series: 4,
  displayPoints: 4000,
} as const;

export type CsvDelimiter = 'auto' | ',' | '\t' | ';';
export interface CsvOptions {
  header: boolean;
  delimiter: CsvDelimiter;
  encoding: 'utf-8' | 'gb18030';
}
export const CSV_DEFAULT_OPTIONS: CsvOptions = {
  header: true,
  delimiter: 'auto',
  encoding: 'utf-8',
};
export class CsvError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'CsvError';
  }
}
export interface CsvIssue {
  dataRow: number;
  line: number;
  column: string;
  code: string;
  message: string;
  text: string;
}
export interface CsvColumn {
  index: number;
  header: string;
  label: string;
  numericCount: number;
  emptyCount: number;
  unsafeCount: number;
}
export interface CsvRow {
  dataRow: number;
  line: number;
  cells: string[];
}
export interface CsvData {
  columns: CsvColumn[];
  rows: CsvRow[];
  issues: CsvIssue[];
  dataRowCount: number;
  invalidRowCount: number;
  delimiter: ',' | '\t' | ';';
}
export type CsvNumber =
  | { value: number; code: null }
  | { value: null; code: 'EMPTY' | 'NOT_NUMERIC' | 'NOT_FINITE' | 'UNSAFE_INTEGER' };
const DECIMAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
export function csvNumber(text: string): CsvNumber {
  const trimmed = text.trim();
  if (!trimmed) return { value: null, code: 'EMPTY' };
  if (!DECIMAL.test(trimmed)) return { value: null, code: 'NOT_NUMERIC' };
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return { value: null, code: 'NOT_FINITE' };
  if (Number.isInteger(value) && !Number.isSafeInteger(value))
    return { value: null, code: 'UNSAFE_INTEGER' };
  return { value, code: null };
}

export function validateCsvFileSize(size: number): void {
  if (!Number.isSafeInteger(size) || size < 0)
    throw new CsvError('FILE_SIZE', '无法识别文件大小，请重新选择文件。');
  if (size > CSV_LIMITS.bytes)
    throw new CsvError('FILE_TOO_LARGE', '文件超过 10 MiB 上限，请拆分文件后重试。');
  if (size === 0) throw new CsvError('EMPTY_FILE', '文件为空，请选择有数据的 CSV 或 TSV。');
}

export function decodeCsv(buffer: ArrayBuffer, encoding: CsvOptions['encoding']): string {
  validateCsvFileSize(buffer.byteLength);
  let text: string;
  try {
    text = new TextDecoder(encoding, { fatal: true }).decode(buffer);
  } catch {
    throw new CsvError(
      'DECODE_ERROR',
      `无法按 ${encoding.toUpperCase()} 解码，请核对高级设置中的编码。`,
    );
  }
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text))
    throw new CsvError('BINARY_FILE', '文件含有二进制控制字符，请选择文本 CSV / TSV 文件。');
  return text.replace(/^\ufeff/, '');
}

export function isCsvOptions(value: unknown): value is CsvOptions {
  if (!value || typeof value !== 'object') return false;
  const options = value as Partial<CsvOptions>;
  return (
    typeof options.header === 'boolean' &&
    ['auto', ',', '\t', ';'].includes(options.delimiter ?? '') &&
    ['utf-8', 'gb18030'].includes(options.encoding ?? '')
  );
}

/** Papa's step callback bounds retained records before an unbounded matrix can form. */
export function parseCsv(
  input: string,
  options: CsvOptions = CSV_DEFAULT_OPTIONS,
  onProgress?: (completed: number, total: number) => void,
): CsvData {
  if (!isCsvOptions(options)) throw new CsvError('OPTIONS', '解析参数无效，请重置后重试。');
  const text = input.replace(/^\ufeff/, '');
  if (!text.trim()) throw new CsvError('EMPTY_FILE', '文件没有非空数据记录。');
  const rows: CsvRow[] = [];
  const issues: CsvIssue[] = [];
  let headers: string[] | undefined;
  let width = 0;
  let dataRowCount = 0;
  let cellCount = 0;
  let cursor = 0;
  let nextLine = 1;
  // Ignore empty physical records when scoring delimiter candidates, while the
  // real step pass keeps them to preserve exact source line numbers.
  let delimiter: CsvData['delimiter'] =
    options.delimiter === 'auto'
      ? (Papa.parse<string[]>(text, {
          preview: 10,
          skipEmptyLines: true,
          dynamicTyping: false,
          delimitersToGuess: [',', '\t', ';'],
        }).meta.delimiter as CsvData['delimiter'])
      : options.delimiter;
  let fatal: CsvError | undefined;
  const numericCounts: number[] = [];
  const emptyCounts: number[] = [];
  const unsafeCounts: number[] = [];
  Papa.parse<string[]>(text, {
    header: false,
    delimiter,
    delimitersToGuess: [',', '\t', ';'],
    dynamicTyping: false,
    skipEmptyLines: false,
    worker: false,
    step(result, parser) {
      const stop = (code: string, message: string) => {
        fatal = new CsvError(code, message);
        parser.abort();
      };
      if (fatal) return;
      const startLine = nextLine;
      const end = result.meta.cursor;
      // Count physical lines once; embedded quoted newlines remain one CSV record.
      for (let i = cursor; i < end; i++) {
        if (text[i] === '\n') nextLine++;
        else if (text[i] === '\r' && text[i + 1] !== '\n') nextLine++;
      }
      cursor = end;
      delimiter = result.meta.delimiter as CsvData['delimiter'];
      const quoteError = result.errors.find((error) => error.type === 'Quotes');
      if (quoteError) {
        stop(
          'CSV_QUOTES',
          `第 ${startLine} 行引号边界无效，无法可靠继续解析。请检查未闭合或未转义的双引号。`,
        );
        return;
      }
      const cells = result.data;
      // Only physically blank records are skipped. Delimiter-only rows retain missing cells.
      if (cells.length === 1 && cells[0].trim() === '') return;
      if (cells.length > CSV_LIMITS.columns) {
        stop('COLUMN_LIMIT', `列数超过 ${CSV_LIMITS.columns} 列上限，解析已停止。`);
        return;
      }
      if (!width) {
        width = cells.length;
        if (options.header) {
          headers = cells.slice();
          return;
        }
        headers = Array.from({ length: width }, () => '');
      }
      dataRowCount++;
      cellCount += cells.length;
      if (dataRowCount > CSV_LIMITS.rows) {
        stop(
          'ROW_LIMIT',
          `数据行超过 ${CSV_LIMITS.rows.toLocaleString('zh-CN')} 行上限，解析已停止。`,
        );
        return;
      }
      if (cellCount > CSV_LIMITS.cells) {
        stop(
          'CELL_LIMIT',
          `单元格超过 ${CSV_LIMITS.cells.toLocaleString('zh-CN')} 个上限，解析已停止。`,
        );
        return;
      }
      if (cells.length !== width) {
        issues.push({
          dataRow: dataRowCount,
          line: startLine,
          column: '整行',
          code: 'COLUMN_MISMATCH',
          message: `应有 ${width} 列，实际 ${cells.length} 列；已排除此行。`,
          text: cells.join(delimiter).slice(0, 180),
        });
      } else {
        rows.push({ dataRow: dataRowCount, line: startLine, cells });
        cells.forEach((cell, index) => {
          const numeric = csvNumber(cell);
          if (numeric.value !== null) numericCounts[index] = (numericCounts[index] ?? 0) + 1;
          if (numeric.code === 'EMPTY') emptyCounts[index] = (emptyCounts[index] ?? 0) + 1;
          if (numeric.code === 'UNSAFE_INTEGER')
            unsafeCounts[index] = (unsafeCounts[index] ?? 0) + 1;
        });
      }
      if (dataRowCount % 1000 === 0) onProgress?.(cursor, text.length);
    },
  });
  if (fatal) throw fatal;
  if (!rows.length)
    throw new CsvError('NO_DATA', '没有可用的数据行，请核对分隔符、表头设置与列数。');
  const names = headers ?? [];
  const counts = new Map<string, number>();
  names.forEach((header) => counts.set(header.trim(), (counts.get(header.trim()) ?? 0) + 1));
  const columns = names.map((header, index) => {
    const name = header.trim();
    return {
      index,
      header,
      label: !name
        ? `第 ${index + 1} 列`
        : (counts.get(name) ?? 0) > 1
          ? `${name}（第 ${index + 1} 列）`
          : name,
      numericCount: numericCounts[index] ?? 0,
      emptyCount: emptyCounts[index] ?? 0,
      unsafeCount: unsafeCounts[index] ?? 0,
    };
  });
  onProgress?.(text.length, text.length);
  return { columns, rows, issues, dataRowCount, invalidRowCount: issues.length, delimiter };
}

export interface CsvSelection {
  x: number | 'row';
  ys: number[];
}
export interface CsvPoint {
  dataRow: number;
  line: number;
  x: number | null;
  ys: (number | null)[];
}
export interface CsvView {
  points: CsvPoint[];
  series: { column: CsvColumn; stats: ReturnType<typeof statistics>; invalidCount: number }[];
  issues: CsvIssue[];
  nonMonotonic: boolean;
  invalidXCount: number;
}
const NUMBER_MESSAGES = {
  EMPTY: '缺失值，按断点处理',
  NOT_NUMERIC: '不是支持的十进制数值（日期列可改用行序号横轴）',
  NOT_FINITE: '数值超出有限数范围',
  UNSAFE_INTEGER: '超出 JavaScript 安全整数范围，无法精确表示',
};
export function deriveCsv(data: CsvData, selection: CsvSelection): CsvView {
  const hasColumn = (index: number) =>
    Number.isInteger(index) && index >= 0 && index < data.columns.length;
  if (
    (selection.x !== 'row' && !hasColumn(selection.x)) ||
    selection.ys.length < 1 ||
    selection.ys.length > CSV_LIMITS.series ||
    selection.ys.some((index) => !hasColumn(index)) ||
    new Set(selection.ys).size !== selection.ys.length
  )
    throw new CsvError('SELECTION', '请选择 1～4 个不同的 Y 列和一个有效横轴。');
  const issues = data.issues.slice();
  let invalidXCount = 0;
  let nonMonotonic = false;
  let previousX: number | undefined;
  const addIssue = (row: CsvRow, index: number, result: CsvNumber, axis: string) => {
    if (result.code === null) return;
    issues.push({
      dataRow: row.dataRow,
      line: row.line,
      column: data.columns[index].label,
      code: result.code,
      message: `${axis}：${NUMBER_MESSAGES[result.code]}`,
      text: row.cells[index].slice(0, 180),
    });
  };
  const points = data.rows.map((row) => {
    const xResult: CsvNumber =
      selection.x === 'row'
        ? { value: row.dataRow, code: null }
        : csvNumber(row.cells[selection.x]);
    if (selection.x !== 'row') addIssue(row, selection.x, xResult, 'X');
    const x = xResult.value;
    if (x === null) invalidXCount++;
    else {
      if (previousX !== undefined && x < previousX) nonMonotonic = true;
      previousX = x;
    }
    const ys = selection.ys.map((index) => {
      const parsed = csvNumber(row.cells[index]);
      if (index !== selection.x) addIssue(row, index, parsed, 'Y');
      return x === null ? null : parsed.value;
    });
    return { dataRow: row.dataRow, line: row.line, x, ys };
  });
  return {
    points,
    issues,
    nonMonotonic,
    invalidXCount,
    series: selection.ys.map((index, seriesIndex) => {
      const values = points.map((point) => point.ys[seriesIndex]);
      const stats = statistics(values);
      return { column: data.columns[index], stats, invalidCount: points.length - stats.count };
    }),
  };
}

/** Each null run is a hard boundary; extrema are retained in source order. */
export function csvDisplayPoints(
  points: CsvPoint[],
  seriesIndex: number,
  target: number = CSV_LIMITS.displayPoints,
): (number | null)[][] {
  if (points.length <= target) return points.map((point) => [point.x, point.ys[seriesIndex]]);
  const size = Math.max(1, Math.ceil(points.length / Math.max(1, Math.floor(target / 4))));
  const selected = new Set<number>();
  let runStart = 0;
  while (runStart < points.length) {
    const value = points[runStart].ys[seriesIndex];
    if (value === null || points[runStart].x === null) {
      selected.add(runStart);
      while (
        runStart + 1 < points.length &&
        (points[runStart + 1].ys[seriesIndex] === null || points[runStart + 1].x === null)
      )
        runStart++;
      selected.add(runStart++);
      continue;
    }
    let runEnd = runStart;
    while (
      runEnd < points.length &&
      points[runEnd].x !== null &&
      points[runEnd].ys[seriesIndex] !== null
    )
      runEnd++;
    for (let start = runStart; start < runEnd; start += size) {
      const end = Math.min(runEnd, start + size);
      let min = start;
      let max = start;
      for (let i = start + 1; i < end; i++) {
        if (points[i].ys[seriesIndex]! < points[min].ys[seriesIndex]!) min = i;
        if (points[i].ys[seriesIndex]! > points[max].ys[seriesIndex]!) max = i;
      }
      [start, min, max, end - 1].forEach((index) => selected.add(index));
    }
    runStart = runEnd;
  }
  return [...selected]
    .sort((a, b) => a - b)
    .map((index) => [points[index].x, points[index].ys[seriesIndex]]);
}
