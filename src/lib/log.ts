/** Numeric fields are interpreted with UTC arithmetic, without declaring the log's timezone. */
export const LOG_LIMITS = {
  bytes: 10 * 1024 * 1024,
  candidates: 100_000,
  lines: 500_000,
  lineBytes: 64 * 1024,
} as const;
export type LogEncoding = 'utf-8' | 'gb18030';
export class LogError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'LogError';
  }
}
export interface LogRecord {
  sequence: number;
  line: number;
  segment: number;
  ping: number;
  rawTime: string;
  timestampMs: number;
  intervalMs: number | null;
  duplicate: boolean;
  flags: string[];
}
export interface LogIssue {
  line: number;
  code: string;
  message: string;
  preview: string;
}
export interface LogSegment {
  id: number;
  count: number;
  firstLine: number;
  lastLine: number;
  reason: 'start' | 'rollback';
}
export interface LogDuplicate {
  segment: number;
  ping: number;
  lines: number[];
}
export interface LogReport {
  records: LogRecord[];
  errors: LogIssue[];
  segments: LogSegment[];
  duplicates: LogDuplicate[];
  totalLines: number;
  blankLines: number;
  ignoredLines: number;
  candidateLines: number;
}
export interface LogPair {
  ping: number;
  a: LogRecord;
  b: LogRecord;
  differenceMs: number;
}
export interface LogComparison {
  segmentA: number;
  segmentB: number;
  pairs: LogPair[];
  excluded: { ping: number; linesA: number[]; linesB: number[] }[];
  onlyA: { ping: number; lines: number[] }[];
  onlyB: { ping: number; lines: number[] }[];
  excludedRecordsA: number;
  excludedRecordsB: number;
}
export interface LogAnalysis {
  a: LogReport;
  b: LogReport | null;
  comparison: LogComparison | null;
}
export interface LogWorkerPayload {
  fileA: File;
  fileB: File | null;
  encoding: LogEncoding;
  segmentA: number;
  segmentB: number;
}
export interface LogWorkerRequest {
  type: 'run';
  taskId: number;
  tool: 'log-analyzer';
  payload: LogWorkerPayload;
}
export type LogWorkerResponse =
  | { type: 'progress'; taskId: number; stage: string; completed?: number; total?: number }
  | { type: 'result'; taskId: number; result: LogAnalysis }
  | { type: 'error'; taskId: number; code: string; message: string };

export function validateLogFile(file: Pick<File, 'size'>): void {
  if (file.size === 0) throw new LogError('EMPTY_FILE', '文件为空，请选择包含日志记录的文件。');
  if (file.size > LOG_LIMITS.bytes)
    throw new LogError('FILE_LIMIT', '每个日志文件最多 10 MiB，请先缩小文件。');
}

function parseCandidate(
  line: string,
): Omit<LogRecord, 'sequence' | 'line' | 'segment' | 'intervalMs' | 'duplicate' | 'flags'> {
  const candidate = line.slice(line.indexOf('PingNumber:'));
  // Whole tokens are captured before semantic checks: illegal numeric suffixes are never truncated.
  const match =
    /^PingNumber:[ \t]*([^ \t]+)[ \t]+Time:[ \t]*([^ \t]+)[ \t]+([^ \t]+)[ \t]+([^ \t]+)[ \t]+([^ \t]+)[ \t]+([^ \t]+)[ \t]+([^ \t]+)[ \t]+([^ \t]+)/.exec(
      candidate,
    );
  if (!match) throw new LogError('INVALID_FORMAT', '需要完整的 PingNumber 和七项 Time 数字字段。');
  const pingToken = match[1]!;
  const normalizedPing = pingToken.replace(/^0+/, '') || '0';
  if (!/^\d+$/.test(pingToken) || normalizedPing.length > 10 || Number(pingToken) > 4_294_967_295)
    throw new LogError('INVALID_PING', 'PingNumber 必须是 0 至 4294967295 的十进制整数。');
  const tokens = match.slice(2);
  if (!/^(?:\d{2}|\d{4})$/.test(tokens[0]!) || tokens.some((token) => !/^\d+$/.test(token)))
    throw new LogError(
      'INVALID_TIME',
      'Time 必须包含数字年、月、日、时、分、秒、毫秒，年份为两位或四位。',
    );
  const numbers = tokens.map(Number);
  const [yearValue, month, day, hour, minute, second, millisecond] = numbers as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const year = tokens[0]!.length === 2 ? 2000 + yearValue : yearValue;
  if (
    !numbers.every(Number.isSafeInteger) ||
    year < 2000 ||
    year > 2099 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59 ||
    millisecond < 0 ||
    millisecond > 999
  )
    throw new LogError('TIME_RANGE', '日期或时间字段超出允许范围；毫秒为 0 至 999。');
  const timestampMs = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  const date = new Date(timestampMs);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute ||
    date.getUTCSeconds() !== second ||
    date.getUTCMilliseconds() !== millisecond
  )
    throw new LogError('INVALID_DATE', '不存在的日历日期，请检查月份、日期和闰年。');
  return { ping: Number(pingToken), rawTime: tokens.join(' '), timestampMs };
}

export function parseLog(
  text: string,
  progress?: (completed: number, total: number) => void,
): LogReport {
  const report: LogReport = {
    records: [],
    errors: [],
    segments: [],
    duplicates: [],
    totalLines: 0,
    blankLines: 0,
    ignoredLines: 0,
    candidateLines: 0,
  };
  if (text.includes('\0'))
    throw new LogError('BINARY_CONTENT', '文件包含二进制空字节，请选择纯文本日志。');
  let start = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  let previous: LogRecord | undefined;
  let comparable = false;
  let lastProgress = 0;
  const groups = new Map<number, Map<number, LogRecord[]>>();
  const encoder = new TextEncoder();
  // Scan instead of splitting: physical-line and line-length limits apply before large allocations.
  while (start < text.length) {
    let end = text.indexOf('\n', start);
    if (end === -1) end = text.length;
    report.totalLines++;
    if (report.totalLines > LOG_LIMITS.lines)
      throw new LogError('LINE_LIMIT', '物理行数超过 500,000 行，请缩小日志。');
    if (end - start > LOG_LIMITS.lineBytes)
      throw new LogError(
        'LINE_LENGTH_LIMIT',
        `第 ${report.totalLines} 行超过 64 KiB，请检查日志格式。`,
      );
    const line = text.slice(start, end).replace(/\r$/, '');
    if (encoder.encode(line).byteLength > LOG_LIMITS.lineBytes)
      throw new LogError(
        'LINE_LENGTH_LIMIT',
        `第 ${report.totalLines} 行超过 64 KiB，请检查日志格式。`,
      );
    start = end + 1;
    if (!line.trim()) report.blankLines++;
    else if (!line.includes('PingNumber:')) report.ignoredLines++;
    else {
      report.candidateLines++;
      if (report.candidateLines > LOG_LIMITS.candidates)
        throw new LogError('RECORD_LIMIT', '候选记录超过 100,000 条，请缩小日志。');
      let parsed: ReturnType<typeof parseCandidate> | null = null;
      try {
        parsed = parseCandidate(line);
      } catch (error) {
        if (!(error instanceof LogError)) throw error;
        report.errors.push({
          line: report.totalLines,
          code: error.code,
          message: error.message,
          preview: line.length > 160 ? `${line.slice(0, 160)}…` : line,
        });
        comparable = false;
      }
      if (parsed) {
        const rollback = previous !== undefined && parsed.ping < previous.ping;
        const newSegment = !previous || rollback;
        const segment = newSegment ? report.segments.length + 1 : previous!.segment;
        if (newSegment)
          report.segments.push({
            id: segment,
            count: 0,
            firstLine: report.totalLines,
            lastLine: report.totalLines,
            reason: rollback ? 'rollback' : 'start',
          });
        const flags: string[] = [];
        if (newSegment) flags.push(rollback ? 'number-rollback' : 'segment-start');
        else if (!comparable) flags.push('after-invalid-candidate');
        const record: LogRecord = {
          ...parsed,
          sequence: report.records.length + 1,
          line: report.totalLines,
          segment,
          intervalMs:
            previous && comparable && !newSegment
              ? parsed.timestampMs - previous.timestampMs
              : null,
          duplicate: false,
          flags,
        };
        report.records.push(record);
        const summary = report.segments[segment - 1]!;
        summary.count++;
        summary.lastLine = record.line;
        let segmentGroups = groups.get(segment);
        if (!segmentGroups) {
          segmentGroups = new Map();
          groups.set(segment, segmentGroups);
        }
        const samePing = segmentGroups.get(record.ping) ?? [];
        samePing.push(record);
        segmentGroups.set(record.ping, samePing);
        previous = record;
        comparable = true;
      }
    }
    if (start - lastProgress > 16_384) {
      progress?.(Math.min(start, text.length), text.length);
      lastProgress = start;
    }
  }
  for (const [segment, segmentGroups] of groups)
    for (const [ping, records] of segmentGroups)
      if (records.length > 1) {
        report.duplicates.push({ segment, ping, lines: records.map((record) => record.line) });
        for (const record of records) {
          record.duplicate = true;
          record.flags.push('duplicate-ping');
        }
      }
  progress?.(text.length, text.length);
  return report;
}

export function compareLogSegments(
  a: LogReport,
  b: LogReport,
  segmentA = 1,
  segmentB = 1,
): LogComparison {
  const recordsA = a.records.filter((record) => record.segment === segmentA);
  const recordsB = b.records.filter((record) => record.segment === segmentB);
  const group = (records: LogRecord[]) => {
    const map = new Map<number, LogRecord[]>();
    for (const record of records) {
      const matches = map.get(record.ping) ?? [];
      matches.push(record);
      map.set(record.ping, matches);
    }
    return map;
  };
  const mapA = group(recordsA);
  const mapB = group(recordsB);
  const result: LogComparison = {
    segmentA,
    segmentB,
    pairs: [],
    excluded: [],
    onlyA: [],
    onlyB: [],
    excludedRecordsA: 0,
    excludedRecordsB: 0,
  };
  for (const ping of new Set([...mapA.keys(), ...mapB.keys()])) {
    const rowsA = mapA.get(ping) ?? [];
    const rowsB = mapB.get(ping) ?? [];
    if (rowsA.length > 1 || rowsB.length > 1) {
      result.excluded.push({
        ping,
        linesA: rowsA.map((r) => r.line),
        linesB: rowsB.map((r) => r.line),
      });
      result.excludedRecordsA += rowsA.length;
      result.excludedRecordsB += rowsB.length;
    }
    if (!rowsB.length) result.onlyA.push({ ping, lines: rowsA.map((r) => r.line) });
    if (!rowsA.length) result.onlyB.push({ ping, lines: rowsB.map((r) => r.line) });
  }
  for (const rowA of recordsA) {
    const rowsB = mapB.get(rowA.ping);
    if (mapA.get(rowA.ping)!.length === 1 && rowsB?.length === 1)
      result.pairs.push({
        ping: rowA.ping,
        a: rowA,
        b: rowsB[0]!,
        differenceMs: rowsB[0]!.timestampMs - rowA.timestampMs,
      });
  }
  return result;
}

export interface LogPlotPoint {
  x: number;
  value: number | null;
  ping: number;
  line: number;
  segment: number;
  original: number | null;
  direction?: 'up' | 'down';
}
/** Preserve first/min/max/last in original order within each bucket; nulls remain hard boundaries. */
export function sampleLogPoints(points: LogPlotPoint[], target = 4000): LogPlotPoint[] {
  if (points.length <= target) return points.slice();
  const bucketSize = Math.max(1, Math.ceil(points.length / Math.max(1, target / 4)));
  const output: LogPlotPoint[] = [];
  let start = 0;
  while (start < points.length) {
    if (points[start]!.value === null) {
      output.push(points[start]!);
      let end = start + 1;
      while (end < points.length && points[end]!.value === null) end++;
      if (end > start + 1) output.push(points[end - 1]!);
      start = end;
      continue;
    }
    let end = start + 1;
    while (
      end < points.length &&
      end - start < bucketSize &&
      points[end]!.value !== null &&
      points[end]!.segment === points[start]!.segment
    )
      end++;
    let min = start;
    let max = start;
    for (let i = start + 1; i < end; i++) {
      if (points[i]!.value! < points[min]!.value!) min = i;
      if (points[i]!.value! > points[max]!.value!) max = i;
    }
    for (const index of [...new Set([start, min, max, end - 1])].sort((x, y) => x - y))
      output.push(points[index]!);
    start = end;
  }
  return output;
}

export function focusLogPoints(
  points: LogPlotPoint[],
  bounds: { lower: number; upper: number } | null,
) {
  if (
    bounds &&
    (!Number.isFinite(bounds.lower) ||
      !Number.isFinite(bounds.upper) ||
      bounds.lower >= bounds.upper)
  )
    throw new LogError('INVALID_FOCUS', '显示下界必须小于上界，且两者都是有限数值。');
  const up: LogPlotPoint[] = [];
  const down: LogPlotPoint[] = [];
  const line = points.map((point): LogPlotPoint => {
    if (bounds && point.original !== null && point.original > bounds.upper) {
      up.push({ ...point, value: bounds.upper, direction: 'up' });
      return { ...point, value: null };
    }
    if (bounds && point.original !== null && point.original < bounds.lower) {
      down.push({ ...point, value: bounds.lower, direction: 'down' });
      return { ...point, value: null };
    }
    return { ...point };
  });
  return { line: sampleLogPoints(line), up, down, originalCount: points.length };
}

export function intervalPlotPoints(report: LogReport): LogPlotPoint[] {
  return report.records.map((record) => ({
    x: record.sequence,
    value: record.intervalMs,
    original: record.intervalMs,
    ping: record.ping,
    line: record.line,
    segment: record.segment,
  }));
}
