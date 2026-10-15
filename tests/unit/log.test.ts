import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  compareLogSegments,
  focusLogPoints,
  intervalPlotPoints,
  LOG_LIMITS,
  parseLog,
  sampleLogPoints,
  validateLogFile,
} from '../../src/lib/log';
import { statistics } from '../../src/lib/stats';

const fixture = (name: string) =>
  readFileSync(new URL(`../fixtures/log/${name}.log`, import.meta.url), 'utf8');
const line = (ping: number | string, time: string) => `PingNumber: ${ping} Time: ${time}`;

describe('日志完整数值链', () => {
  it('固定 A/B 样例保留正负时间差，统计不受显示聚焦影响', () => {
    const a = parseLog(fixture('standard-a'));
    const b = parseLog(fixture('standard-b'));
    expect(a.records.map((r) => r.intervalMs)).toEqual([null, 100, 100, 2100, -900]);
    expect(b.records.map((r) => r.intervalMs)).toEqual([null, 103, 98, 2102, -903]);
    const compared = compareLogSegments(a, b);
    expect(compared.pairs.map((p) => p.differenceMs)).toEqual([5, 8, 6, 8, 5]);
    const stats = statistics(compared.pairs.map((p) => p.differenceMs));
    expect(stats.mean).toBeCloseTo(6.4, 12);
    expect(stats.median).toBe(6);
    expect(stats.stddev).toBeCloseTo(1.3564659966250536, 12);
    expect(statistics(a.records.map((r) => r.intervalMs)).mean).toBe(350);
    expect(statistics(b.records.map((r) => r.intervalMs)).median).toBe(100.5);
    const focused = focusLogPoints(intervalPlotPoints(a), { lower: -500, upper: 500 });
    expect(focused.up.map((p) => p.original)).toEqual([2100]);
    expect(focused.down.map((p) => p.original)).toEqual([-900]);
    expect(focused.line.map((p) => p.value)).toEqual([null, 100, 100, null, null]);
    expect(a.records[3]!.intervalMs).toBe(2100);
    expect(a.records[4]!.intervalMs).toBe(-900);
  });
  it('完整日期跨年 100 ms，且不受运行环境时区影响', () => {
    const original = process.env.TZ;
    try {
      for (const timezone of ['UTC', 'Asia/Shanghai', 'America/New_York']) {
        process.env.TZ = timezone;
        expect(parseLog(fixture('cross-year')).records.map((r) => r.intervalMs)).toEqual([
          null,
          100,
        ]);
      }
    } finally {
      process.env.TZ = original;
    }
  });
  it('仅唯一编号配对，重号整组排除', () => {
    const a = parseLog(fixture('duplicate-a'));
    const b = parseLog(fixture('duplicate-b'));
    expect(a.records.map((r) => r.duplicate)).toEqual([false, true, true, false]);
    const result = compareLogSegments(a, b);
    expect(result.pairs.map((p) => [p.ping, p.differenceMs])).toEqual([
      [1, 5],
      [3, 9],
    ]);
    expect(result.excluded).toEqual([{ ping: 2, linesA: [2, 3], linesB: [2] }]);
    expect([result.excludedRecordsA, result.excludedRecordsB]).toEqual([2, 1]);
  });
  it('编号回退开新段，不跨段连接；时间回退不分段', () => {
    const report = parseLog(fixture('rollback'));
    expect(report.segments).toHaveLength(2);
    expect(report.records.map((r) => r.intervalMs)).toEqual([null, 100, null, 100]);
    expect(report.records.map((r) => r.segment)).toEqual([1, 1, 2, 2]);
    expect(parseLog(fixture('standard-a')).segments).toHaveLength(1);
  });
  it('无关行不打断，候选无效行打断并保留行号', () => {
    const report = parseLog(fixture('invalid-gap'));
    expect([report.records.length, report.ignoredLines, report.errors.length]).toEqual([3, 1, 1]);
    expect(report.records.map((r) => r.intervalMs)).toEqual([null, 100, null]);
    expect(report.errors[0]!.line).toBe(4);
  });
});

describe('日志语义和输入边界', () => {
  it.each([
    '26 02 29 10 00 00 0',
    '26 02 30 10 00 00 0',
    '26 10 15 10 00 60 0',
    '26 10 15 10 00 00 1000',
    '26 10 15 10 00 00',
    '26 10 15 10 00 00 4abc',
    '2100 10 15 10 00 00 0',
  ])('拒绝非法日期或完整字段：%s', (time) => {
    expect(parseLog(line(1, time)).errors).toHaveLength(1);
  });
  it('闰年和整数毫秒正确，前缀、制表符、BOM、CRLF可用', () => {
    const report = parseLog(
      '\ufeff[INFO] ' +
        line(0, '24 02 29 10 00 00 004') +
        '\r\n' +
        line(1, '2024\t02\t29\t10\t00\t00\t4') +
        ' trailing text',
    );
    expect(report.records.map((r) => r.intervalMs)).toEqual([null, 0]);
    expect(report.totalLines).toBe(2);
  });
  it.each(['4294967296', '-1', '1abc', '1.5', '9007199254740993', '0x10', 'Infinity', '__proto__'])(
    '拒绝非法编号 %s',
    (ping) => {
      expect(parseLog(line(ping, '26 10 15 10 00 00 0')).records).toHaveLength(0);
    },
  );
  it('空白、未匹配和单侧编号有明确空结果', () => {
    expect(parseLog('')).toMatchObject({ totalLines: 0, records: [] });
    expect(parseLog('\n \ninfo')).toMatchObject({ totalLines: 3, blankLines: 2, ignoredLines: 1 });
    const result = compareLogSegments(
      parseLog(line(1, '26 10 15 10 00 00 0')),
      parseLog(line(2, '26 10 15 10 00 00 0')),
    );
    expect(result.pairs).toEqual([]);
    expect(result.onlyA[0]!.ping).toBe(1);
    expect(result.onlyB[0]!.ping).toBe(2);
  });
  it('大小限制读取前生效，其他上限扫描时生效', () => {
    expect(() => validateLogFile({ size: 0 })).toThrow(/为空/);
    expect(() => validateLogFile({ size: LOG_LIMITS.bytes + 1 })).toThrow(/10 MiB/);
    expect(() => parseLog('x'.repeat(LOG_LIMITS.lineBytes + 1))).toThrow(/64 KiB/);
    expect(() => parseLog('\n'.repeat(LOG_LIMITS.lines + 1))).toThrow(/500,000/);
    expect(() =>
      parseLog((line(1, '26 10 15 10 00 00 0') + '\n').repeat(LOG_LIMITS.candidates + 1)),
    ).toThrow(/100,000/);
    expect(() => parseLog('abc\0')).toThrow(/二进制/);
  });
  it('确定性生成 10,000 条记录，完整解析和计算', () => {
    const input = Array.from({ length: 10_000 }, (_, index) =>
      line(
        index,
        `26 10 15 10 ${Math.floor(index / 600)} ${Math.floor(index / 10) % 60} ${(index % 10) * 100}`,
      ),
    ).join('\n');
    const report = parseLog(input);
    expect(report.records).toHaveLength(10_000);
    expect(report.records.at(-1)!.intervalMs).toBe(100);
    expect(report.errors).toHaveLength(0);
  });
  it('显示抽样保持尖峰和顺序，null 是硬边界；聚焦范围校验', () => {
    const points = Array.from({ length: 10_000 }, (_, x) => ({
      x,
      value: x === 1234 ? 99_999 : x === 1235 ? null : 0,
      original: x === 1234 ? 99_999 : x === 1235 ? null : 0,
      ping: x,
      line: x + 1,
      segment: 1,
    }));
    const sampled = sampleLogPoints(points);
    expect(sampled.some((p) => p.value === 99_999)).toBe(true);
    expect(sampled.some((p) => p.value === null)).toBe(true);
    expect(sampled.map((p) => p.x)).toEqual(sampled.map((p) => p.x).sort((a, b) => a - b));
    expect(() => focusLogPoints(points, { lower: 2, upper: 1 })).toThrow(/下界/);
    expect(focusLogPoints(points, null).up).toEqual([]);
  });
});
