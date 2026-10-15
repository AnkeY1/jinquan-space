import { createChart, exportChart, type ECharts, type EChartsCoreOption } from '../lib/chart';
import { downloadCsv, type CsvCell } from '../lib/export';
import { statistics } from '../lib/stats';
import {
  focusLogPoints,
  intervalPlotPoints,
  LogError,
  validateLogFile,
  type LogAnalysis,
  type LogEncoding,
  type LogPlotPoint,
  type LogReport,
  type LogWorkerRequest,
  type LogWorkerResponse,
} from '../lib/log';
import { LOG_SAMPLE_A, LOG_SAMPLE_B } from '../lib/log-samples';
import LogWorker from '../workers/log.worker?worker&inline';

function element<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing log analyzer element: ${id}`);
  return node as T;
}
const inputA = element<HTMLInputElement>('log-file-a');
const inputB = element<HTMLInputElement>('log-file-b');
const encoding = element<HTMLSelectElement>('log-encoding');
const segmentA = element<HTMLSelectElement>('log-segment-a');
const segmentB = element<HTMLSelectElement>('log-segment-b');
const startButton = element<HTMLButtonElement>('log-start');
const cancelButton = element<HTMLButtonElement>('log-cancel');
const status = element('log-status');
const progress = element<HTMLProgressElement>('log-progress');
const focus = element<HTMLInputElement>('log-focus');
const lower = element<HTMLInputElement>('log-lower');
const upper = element<HTMLInputElement>('log-upper');
const tableKind = element<HTMLSelectElement>('log-table-kind');
const pageSize = element<HTMLSelectElement>('log-page-size');
const abort = new AbortController();
const charts = new Map<string, ECharts>();
let fileA: File | null = null;
let fileB: File | null = null;
let result: LogAnalysis | null = null;
let worker: Worker | null = null;
let taskId = 0;
let running = false;
let stale = false;
let page = 1;
const flagLabels: Record<string, string> = {
  'segment-start': '分段首条',
  'number-rollback': '编号回退，新分段',
  'after-invalid-candidate': '无效候选后断点',
  'duplicate-ping': '分段内重号',
};

function listen(target: EventTarget, name: string, listener: EventListener) {
  target.addEventListener(name, listener, { signal: abort.signal });
}
function make<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function valueText(value: number | null): string {
  return value === null
    ? '—'
    : Number.isInteger(value)
      ? String(value)
      : value.toLocaleString('zh-CN', { maximumFractionDigits: 3 });
}
function setStatus(message: string, error = false) {
  status.textContent = message;
  status.dataset.state = error ? 'error' : 'normal';
  status.classList.toggle('error', error);
}
function refreshButtons() {
  startButton.disabled = running || !fileA;
  cancelButton.disabled = !running;
  document.querySelectorAll<HTMLButtonElement>('[data-export]').forEach((button) => {
    button.disabled = running || stale || !result;
    if (button.id === 'log-export-b' && !result?.b) button.disabled = true;
    if (
      (button.id === 'log-export-comparison' || button.dataset.png === 'comparison') &&
      !result?.comparison?.pairs.length
    )
      button.disabled = true;
  });
}
function stopWorker() {
  taskId++;
  worker?.terminate();
  worker = null;
  running = false;
  progress.hidden = true;
  element('log-results').setAttribute('aria-busy', 'false');
}
function markStale(message = '文件或计算参数已改变，请开始分析。') {
  if (running) stopWorker();
  stale = Boolean(result);
  element('log-stale').hidden = !stale;
  setStatus(message);
  refreshButtons();
}
function updateFiles() {
  element('log-name-a').textContent = fileA
    ? `${fileA.name} · ${(fileA.size / 1024).toFixed(1)} KiB`
    : '尚未选择';
  element('log-name-b').textContent = fileB
    ? `${fileB.name} · ${(fileB.size / 1024).toFixed(1)} KiB`
    : '尚未选择';
  segmentA.value = '1';
  segmentB.value = '1';
  markStale(fileA ? '准备就绪 · 文件仅在浏览器内处理' : '等待日志 A · 也可以使用示例');
}
function choose(which: 'a' | 'b', file: File | null) {
  try {
    if (file) validateLogFile(file);
  } catch (error) {
    markStale();
    setStatus(error instanceof Error ? error.message : '文件无效，请重新选择。', true);
    return;
  }
  if (which === 'a') fileA = file;
  else fileB = file;
  updateFiles();
}
listen(inputA, 'change', () => {
  const file = inputA.files?.[0] ?? null;
  inputA.value = '';
  choose('a', file);
});
listen(inputB, 'change', () => {
  const file = inputB.files?.[0] ?? null;
  inputB.value = '';
  choose('b', file);
});
for (const select of [encoding, segmentA, segmentB]) listen(select, 'change', () => markStale());
listen(element('log-example'), 'click', () => {
  fileA = new File([LOG_SAMPLE_A], '合成示例-A.log', { type: 'text/plain' });
  fileB = new File([LOG_SAMPLE_B], '合成示例-B.log', { type: 'text/plain' });
  encoding.value = 'utf-8';
  updateFiles();
  void start();
});
const drop = element('log-drop');
listen(drop, 'dragover', (event) => {
  event.preventDefault();
  drop.dataset.drag = 'true';
});
listen(drop, 'dragleave', () => {
  delete drop.dataset.drag;
});
listen(drop, 'drop', (event) => {
  event.preventDefault();
  delete drop.dataset.drag;
  const files = (event as DragEvent).dataTransfer?.files;
  if (!files?.length) return;
  if (files.length > 2) {
    setStatus('一次最多拖入两个文件，请重新选择。', true);
    return;
  }
  try {
    for (const file of Array.from(files)) validateLogFile(file);
  } catch (error) {
    markStale();
    setStatus(error instanceof Error ? error.message : '文件无效。', true);
    return;
  }
  fileA = files[0]!;
  fileB = files[1] ?? null;
  inputA.value = '';
  inputB.value = '';
  updateFiles();
});

function hasResultShape(value: unknown): value is LogAnalysis {
  if (typeof value !== 'object' || value === null || !('a' in value)) return false;
  const candidate = value as Partial<LogAnalysis>;
  const reportShape = (report: unknown) =>
    Boolean(
      report &&
      typeof report === 'object' &&
      'records' in report &&
      Array.isArray(report.records) &&
      'errors' in report &&
      Array.isArray(report.errors) &&
      'segments' in report &&
      Array.isArray(report.segments),
    );
  return (
    reportShape(candidate.a) &&
    (candidate.b === null || reportShape(candidate.b)) &&
    (candidate.comparison === null ||
      Boolean(candidate.comparison && Array.isArray(candidate.comparison.pairs)))
  );
}
async function start() {
  if (!fileA || running) return;
  try {
    validateLogFile(fileA);
    if (fileB) validateLogFile(fileB);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : '文件无效。', true);
    return;
  }
  stopWorker();
  const currentTask = taskId;
  running = true;
  stale = Boolean(result);
  element('log-stale').hidden = !stale;
  element('log-results').setAttribute('aria-busy', 'true');
  progress.hidden = false;
  progress.removeAttribute('value');
  setStatus('读取日志 · 任务在本地 Worker 中运行');
  refreshButtons();
  try {
    worker = new LogWorker();
    worker.onmessage = (event: MessageEvent<unknown>) => {
      const message = event.data as Partial<LogWorkerResponse>;
      if (!message || message.taskId !== taskId || currentTask !== taskId || !running) return;
      if (message.type === 'progress') {
        setStatus(message.stage ?? '处理中');
        if (
          typeof message.total === 'number' &&
          message.total > 0 &&
          typeof message.completed === 'number'
        ) {
          progress.max = message.total;
          progress.value = message.completed;
        } else progress.removeAttribute('value');
      } else if (message.type === 'error') {
        stopWorker();
        stale = Boolean(result);
        setStatus(`${message.message ?? '分析未完成'}（${message.code ?? 'ERROR'}）`, true);
        refreshButtons();
      } else if (message.type === 'result') {
        if (!hasResultShape(message.result)) {
          stopWorker();
          setStatus('Worker 返回格式无效，请清空后重试。', true);
          refreshButtons();
          return;
        }
        result = message.result;
        stopWorker();
        stale = false;
        page = 1;
        element('log-stale').hidden = true;
        renderResult();
        const issues = result.a.errors.length + (result.b?.errors.length ?? 0);
        const duplicateKeys = result.a.duplicates.length + (result.b?.duplicates.length ?? 0);
        setStatus(
          issues || duplicateKeys
            ? `部分完成 · ${issues} 条无效候选，${duplicateKeys} 个分段重号键；可用结果已保留`
            : '分析完成 · 原始数值已保留，可查看和导出',
        );
        refreshButtons();
      }
    };
    worker.onerror = () => {
      if (currentTask !== taskId) return;
      stopWorker();
      setStatus('Worker 未能完成任务，请缩小文件或刷新页面后重试。', true);
      refreshButtons();
    };
    const request: LogWorkerRequest = {
      type: 'run',
      taskId: currentTask,
      tool: 'log-analyzer',
      payload: {
        fileA,
        fileB,
        encoding: encoding.value as LogEncoding,
        segmentA: Number(segmentA.value || 1),
        segmentB: Number(segmentB.value || 1),
      },
    };
    worker.postMessage(request);
  } catch {
    stopWorker();
    setStatus('无法启动本地 Worker，请检查浏览器设置并重试。', true);
    refreshButtons();
  }
}
listen(startButton, 'click', () => {
  void start();
});
listen(cancelButton, 'click', () => {
  stopWorker();
  stale = Boolean(result);
  element('log-stale').hidden = !stale;
  setStatus('已取消 · 可以更换文件或重新分析');
  refreshButtons();
});
function disposeCharts() {
  for (const chart of charts.values()) chart.dispose();
  charts.clear();
}
function clear() {
  stopWorker();
  disposeCharts();
  fileA = null;
  fileB = null;
  result = null;
  stale = false;
  page = 1;
  inputA.value = '';
  inputB.value = '';
  element('log-output').hidden = true;
  element('log-empty').hidden = false;
  element('log-stale').hidden = true;
  element('log-segment-fields').hidden = true;
  element('log-summary').replaceChildren();
  element('log-details').replaceChildren();
  element('log-table').querySelector('tbody')!.replaceChildren();
  element('log-view-error').hidden = true;
  updateFiles();
  refreshButtons();
}
listen(element('log-clear'), 'click', clear);

function summaryCard(label: string, file: File | null, report: LogReport) {
  const card = make('div', undefined, 'log-summary-card');
  card.append(make('h3', `${label} · ${file?.name ?? '日志'}`));
  const dl = make('dl');
  for (const [title, count] of [
    ['总物理行', report.totalLines],
    ['有效记录', report.records.length],
    ['空白行', report.blankLines],
    ['忽略行', report.ignoredLines],
    ['无效候选', report.errors.length],
    ['运行分段', report.segments.length],
    ['重复编号键（分段内）', report.duplicates.length],
  ])
    dl.append(make('dt', String(title)), make('dd', String(count)));
  card.append(dl);
  return card;
}
function renderStats(id: string, values: (number | null)[]) {
  const stats = statistics(values);
  const target = element(`log-stats-${id}`);
  target.replaceChildren();
  const fields: [string, number | null][] = [
    ['有效差值数', stats.count],
    ['均值 / ms', stats.mean],
    ['中位数 / ms', stats.median],
    ['最小 / ms', stats.min],
    ['最大 / ms', stats.max],
    ['总体标准差 / ms', stats.stddev],
  ];
  for (const [label, value] of fields) {
    const node = make('div', undefined, 'stat');
    node.append(make('span', label), make('strong', valueText(value)));
    target.append(node);
  }
}
function updateSegmentOptions(select: HTMLSelectElement, report: LogReport, selected: number) {
  select.replaceChildren();
  for (const segment of report.segments) {
    const option = make(
      'option',
      `第 ${segment.id} 段 · ${segment.count} 条 · 行 ${segment.firstLine}–${segment.lastLine}`,
    );
    option.value = String(segment.id);
    select.append(option);
  }
  select.value = String(selected);
}
function renderResult() {
  if (!result) return;
  element('log-empty').hidden = true;
  element('log-output').hidden = false;
  const summary = element('log-summary');
  summary.replaceChildren(summaryCard('A', fileA, result.a));
  if (result.b) summary.append(summaryCard('B', fileB, result.b));
  const rollbacks =
    result.a.segments.filter((s) => s.reason === 'rollback').length +
    (result.b?.segments.filter((s) => s.reason === 'rollback').length ?? 0);
  element('log-segmentation').textContent = rollbacks
    ? `检测到 ${rollbacks} 次编号回退，按新分段处理：可能重启或乱序，不跨段连接。`
    : '未检测到编号回退。相邻间隔保留原始文件顺序。';
  element('log-b-section').hidden = !result.b;
  element('log-comparison-section').hidden = !result.b;
  if (!result.b)
    for (const id of ['b', 'comparison']) {
      charts.get(id)?.dispose();
      charts.delete(id);
    }
  element('log-segment-fields').hidden = !result.b;
  updateSegmentOptions(segmentA, result.a, result.comparison?.segmentA ?? 1);
  if (result.b) updateSegmentOptions(segmentB, result.b, result.comparison?.segmentB ?? 1);
  if ((result.a.segments.length > 1 || (result.b?.segments.length ?? 0) > 1) && result.b)
    segmentA.closest('details')!.open = true;
  for (const option of Array.from(tableKind.options))
    option.disabled =
      (option.value === 'b' && !result.b) || (option.value === 'comparison' && !result.b);
  if (tableKind.selectedOptions[0]?.disabled) tableKind.value = 'a';
  renderStats(
    'a',
    result.a.records.map((r) => r.intervalMs),
  );
  if (result.b)
    renderStats(
      'b',
      result.b.records.map((r) => r.intervalMs),
    );
  if (result.comparison) {
    const comparison = result.comparison;
    renderStats(
      'comparison',
      comparison.pairs.map((p) => p.differenceMs),
    );
    element('log-comparison-scope').textContent =
      `仅比较所选分段：A 第 ${comparison.segmentA} 段 / B 第 ${comparison.segmentB} 段。正数表示 B 较晚，负数表示 B 较早。唯一配对 ${comparison.pairs.length} 条；重号排除 ${comparison.excluded.length} 个编号（A ${comparison.excludedRecordsA} 条 / B ${comparison.excludedRecordsB} 条）；仅 A ${comparison.onlyA.length} 个 / 仅 B ${comparison.onlyB.length} 个编号。`;
    element('log-no-pairs').hidden = comparison.pairs.length > 0;
  }
  renderCharts();
  renderTable();
  renderDetails();
}

function bounds() {
  if (!focus.checked) return null;
  if (!lower.value.trim() || !upper.value.trim())
    throw new LogError('INVALID_FOCUS', '请填写有限的显示上下界。');
  const range = { lower: Number(lower.value), upper: Number(upper.value) };
  if (!Number.isFinite(range.lower) || !Number.isFinite(range.upper) || range.lower >= range.upper)
    throw new LogError('INVALID_FOCUS', '显示下界必须小于上界，且两者都是有限数值。');
  return range;
}
function comparisonPoints(): LogPlotPoint[] {
  return (
    result?.comparison?.pairs.map((pair, index) => ({
      x: index + 1,
      value: pair.differenceMs,
      original: pair.differenceMs,
      ping: pair.ping,
      line: pair.a.line,
      segment: pair.a.segment,
    })) ?? []
  );
}
function allPointSets(): [string, string, LogPlotPoint[]][] {
  if (!result) return [];
  const sets: [string, string, LogPlotPoint[]][] = [
    ['a', '日志 A：相邻记录时间差', intervalPlotPoints(result.a)],
  ];
  if (result.b) sets.push(['b', '日志 B：相邻记录时间差', intervalPlotPoints(result.b)]);
  if (result.comparison)
    sets.push(['comparison', '同编号时间差：日志 B − 日志 A', comparisonPoints()]);
  return sets;
}
function chartOption(
  id: string,
  title: string,
  points: LogPlotPoint[],
  range: ReturnType<typeof bounds>,
): EChartsCoreOption {
  const display = focusLogPoints(points, range);
  const data = (point: LogPlotPoint) => [
    point.x,
    point.value,
    point.original,
    point.ping,
    point.line,
    point.segment,
  ];
  const markerLimit = 4000;
  const markerSamples = (markers: LogPlotPoint[]) =>
    markers.length <= markerLimit
      ? markers
      : markers.filter((_, i) => i % Math.ceil(markers.length / markerLimit) === 0);
  const up = markerSamples(display.up);
  const down = markerSamples(display.down);
  const note = element(`log-chart-note-${id}`);
  note.textContent = `原始 ${display.originalCount.toLocaleString('zh-CN')} 点 / 主线展示 ${display.line.length.toLocaleString('zh-CN')} 点。${range ? `超出当前显示范围：上 ${display.up.length} 点、下 ${display.down.length} 点；标记展示 ${up.length + down.length} 点，完整明细见记录表。` : '完整范围；分段开头与无效候选之后留空断点。'}统计与导出使用全部原值。`;
  // Half-span avoids overflow when both finite endpoints are near Number.MAX_VALUE.
  const margin = range
    ? Math.max(
        (range.upper / 2 - range.lower / 2) * 0.16,
        Number.EPSILON * Math.max(Math.abs(range.upper), Math.abs(range.lower)) * 16,
        Number.MIN_VALUE,
      )
    : 0;
  const paddedLower =
    range && Number.isFinite(range.lower - margin) ? range.lower - margin : range?.lower;
  const paddedUpper =
    range && Number.isFinite(range.upper + margin) ? range.upper + margin : range?.upper;
  return {
    title: {
      text: title,
      textStyle: { fontSize: 12 },
      subtext: range
        ? `聚焦 [${range.lower}, ${range.upper}] ms · 完整原值见 CSV`
        : '完整显示范围 · 日志未声明时区',
      subtextStyle: { fontSize: 10 },
    },
    grid: { left: 8, right: 18, top: 100, bottom: 68, containLabel: true },
    legend: {
      top: 50,
      left: 0,
      itemWidth: 15,
      textStyle: { fontSize: 10 },
      data: ['记录时间差', ...(range ? ['上超界', '下超界'] : [])],
    },
    tooltip: {
      trigger: 'item',
      renderMode: 'richText',
      confine: true,
      formatter: (entry: { value?: unknown; seriesName?: string }) => {
        const values = entry.value;
        if (!Array.isArray(values)) return '';
        const [x, shown, original, ping, line, segment] = values as (number | null)[];
        const direction =
          range && original !== null
            ? original! > range.upper
              ? '\n向上超界（边界标记）'
              : original! < range.lower
                ? '\n向下超界（边界标记）'
                : ''
            : '';
        return `有效序号：${x}\nPingNumber：${ping}\nA/本文件行号：${line} · 分段：${segment}\n原始时间差：${original ?? shown} ms${direction}`;
      },
    },
    xAxis: {
      type: 'value',
      name: id === 'comparison' ? '匹配记录序号' : '有效记录序号',
      nameLocation: 'middle',
      nameGap: 28,
      minInterval: 1,
      axisLabel: { hideOverlap: true },
    },
    yAxis: {
      type: 'value',
      name: '记录时间差 / ms',
      min: range ? paddedLower : null,
      max: range ? paddedUpper : null,
      scale: true,
    },
    dataZoom: [{ type: 'slider', height: 18, bottom: 8, start: 0, end: 100, filterMode: 'none' }],
    series: [
      {
        name: '记录时间差',
        type: 'line',
        data: display.line.map(data),
        dimensions: ['sequence', 'difference', 'original', 'ping', 'line', 'segment'],
        encode: { x: 0, y: 1 },
        showSymbol: points.filter((p) => p.original !== null).length === 1,
        symbolSize: 6,
        smooth: false,
        connectNulls: false,
        lineStyle: { width: 1.6 },
        emphasis: { focus: 'series' },
      },
      {
        name: '上超界',
        type: 'scatter',
        data: up.map(data),
        dimensions: ['sequence', 'difference', 'original', 'ping', 'line', 'segment'],
        encode: { x: 0, y: 1 },
        symbol: 'triangle',
        symbolSize: 11,
        itemStyle: { color: '#ce6d37' },
      },
      {
        name: '下超界',
        type: 'scatter',
        data: down.map(data),
        dimensions: ['sequence', 'difference', 'original', 'ping', 'line', 'segment'],
        encode: { x: 0, y: 1 },
        symbol: 'triangle',
        symbolRotate: 180,
        symbolSize: 11,
        itemStyle: { color: '#9864bd' },
      },
    ],
  };
}
function renderCharts() {
  if (!result) return;
  let range: ReturnType<typeof bounds>;
  try {
    range = bounds();
    element('log-view-error').hidden = true;
  } catch (error) {
    element('log-view-error').hidden = false;
    element('log-view-error').textContent = error instanceof Error ? error.message : '显示范围无效';
    return;
  }
  for (const [id, title, points] of allPointSets()) {
    const container = element(`log-chart-${id}`);
    if (id === 'comparison' && !points.length) {
      charts.get(id)?.dispose();
      charts.delete(id);
      container.hidden = true;
      element('log-chart-note-comparison').textContent = '无公共唯一编号，因此不绘制时间差曲线。';
      continue;
    }
    container.hidden = false;
    const option = chartOption(id, title, points, range);
    const existing = charts.get(id);
    if (existing) existing.setOption(option, { replaceMerge: ['series'] });
    else charts.set(id, createChart(container, option));
  }
}
for (const input of [focus, lower, upper])
  listen(input, 'change', () => {
    renderCharts();
    page = 1;
    renderTable();
  });

interface TableContent {
  headers: string[];
  rows: CsvCell[][];
}
function tableContent(): TableContent {
  if (!result) return { headers: [], rows: [] };
  const kind = tableKind.value;
  if (kind === 'comparison')
    return {
      headers: [
        'PingNumber',
        'A 段',
        'B 段',
        'A 行号',
        'B 行号',
        'A 原时间',
        'B 原时间',
        'B − A / ms',
      ],
      rows:
        result.comparison?.pairs.map((pair) => [
          pair.ping,
          pair.a.segment,
          pair.b.segment,
          pair.a.line,
          pair.b.line,
          pair.a.rawTime,
          pair.b.rawTime,
          pair.differenceMs,
        ]) ?? [],
    };
  if (kind === 'outliers') {
    let range: ReturnType<typeof bounds>;
    try {
      range = bounds();
    } catch {
      return { headers: ['提示'], rows: [['请先修正显示范围。']] };
    }
    if (!range) return { headers: ['提示'], rows: [['开启“聚焦正常范围”后查看上、下超界明细。']] };
    const rows: CsvCell[][] = [];
    for (const [id, , points] of allPointSets())
      for (const point of points)
        if (
          point.original !== null &&
          (point.original > range.upper || point.original < range.lower)
        )
          rows.push([
            id === 'comparison' ? 'B − A' : id.toUpperCase(),
            point.x,
            point.ping,
            point.line,
            point.segment,
            point.original,
            point.original > range.upper ? '上超界' : '下超界',
          ]);
    return {
      headers: [
        '序列',
        '有效序号',
        'PingNumber',
        '原行号 / A 行号',
        '段号 / A 段号',
        '原值 / ms',
        '方向',
      ],
      rows,
    };
  }
  const report = kind === 'b' ? result.b : result.a;
  return {
    headers: [
      '有效序号',
      'PingNumber',
      '段号',
      '原行号',
      '日志原始时间（未声明时区）',
      '相邻差值 / ms',
      '标志',
    ],
    rows:
      report?.records.map((record) => [
        record.sequence,
        record.ping,
        record.segment,
        record.line,
        record.rawTime,
        record.intervalMs,
        record.flags.map((flag) => flagLabels[flag] ?? flag).join('；'),
      ]) ?? [],
  };
}
function renderTable() {
  if (!result) return;
  const content = tableContent();
  const size = Number(pageSize.value);
  const totalPages = Math.max(1, Math.ceil(content.rows.length / size));
  page = Math.min(Math.max(page, 1), totalPages);
  const table = element('log-table');
  const head = table.querySelector('thead')!;
  const body = table.querySelector('tbody')!;
  const tr = make('tr');
  for (const header of content.headers) {
    const th = make('th', header);
    th.scope = 'col';
    tr.append(th);
  }
  head.replaceChildren(tr);
  body.replaceChildren();
  for (const row of content.rows.slice((page - 1) * size, page * size)) {
    const node = make('tr');
    for (const cell of row)
      node.append(make('td', typeof cell === 'number' ? valueText(cell) : (cell ?? '')));
    body.append(node);
  }
  if (!content.rows.length) {
    const tr = make('tr');
    const td = make('td', '无可显示记录。');
    td.colSpan = content.headers.length;
    tr.append(td);
    body.append(tr);
  }
  element('log-page-info').textContent =
    `第 ${page} / ${totalPages} 页 · 共 ${content.rows.length.toLocaleString('zh-CN')} 条`;
  element<HTMLButtonElement>('log-prev').disabled = page <= 1;
  element<HTMLButtonElement>('log-next').disabled = page >= totalPages;
}
listen(tableKind, 'change', () => {
  page = 1;
  renderTable();
});
listen(pageSize, 'change', () => {
  page = 1;
  renderTable();
});
listen(element('log-prev'), 'click', () => {
  page--;
  renderTable();
});
listen(element('log-next'), 'click', () => {
  page++;
  renderTable();
});
function renderDetails() {
  if (!result) return;
  const details = element('log-details');
  details.replaceChildren();
  const addList = (title: string, lines: string[], total = lines.length) => {
    details.append(make('h3', `${title} · ${total}`));
    if (!lines.length) {
      details.append(make('p', '无', 'muted'));
      return;
    }
    const list = make('ol', undefined, 'log-detail-list');
    for (const text of lines.slice(0, 200)) list.append(make('li', text));
    details.append(list);
    if (total > 200) details.append(make('p', `仅显示前 200 条 / 共 ${total} 条。`, 'muted'));
  };
  const linePreview = (lines: number[]) =>
    `${lines.slice(0, 20).join(', ')}${lines.length > 20 ? `… 共 ${lines.length} 条` : ''}`;
  for (const [label, report] of [
    ['A', result.a],
    ['B', result.b],
  ] as const)
    if (report) {
      addList(
        `日志 ${label} 无效候选`,
        report.errors
          .slice(0, 200)
          .map(
            (issue) => `行 ${issue.line} · ${issue.code} · ${issue.message} 原行：${issue.preview}`,
          ),
        report.errors.length,
      );
      addList(
        `日志 ${label} 分段内重号`,
        report.duplicates
          .slice(0, 200)
          .map(
            (duplicate) =>
              `第 ${duplicate.segment} 段 · PingNumber ${duplicate.ping} · 行 ${linePreview(duplicate.lines)}`,
          ),
        report.duplicates.length,
      );
    }
  if (result.comparison) {
    addList(
      '因重号排除的编号',
      result.comparison.excluded
        .slice(0, 200)
        .map(
          (key) =>
            `PingNumber ${key.ping} · A 行 ${linePreview(key.linesA) || '无'} · B 行 ${linePreview(key.linesB) || '无'}`,
        ),
      result.comparison.excluded.length,
    );
    addList(
      '仅 A 存在的编号',
      result.comparison.onlyA
        .slice(0, 200)
        .map((key) => `PingNumber ${key.ping} · A 行 ${linePreview(key.lines)}`),
      result.comparison.onlyA.length,
    );
    addList(
      '仅 B 存在的编号',
      result.comparison.onlyB
        .slice(0, 200)
        .map((key) => `PingNumber ${key.ping} · B 行 ${linePreview(key.lines)}`),
      result.comparison.onlyB.length,
    );
  }
  element('log-detail-summary').textContent =
    `无效候选 ${result.a.errors.length + (result.b?.errors.length ?? 0)} 条 · 重号键 ${result.a.duplicates.length + (result.b?.duplicates.length ?? 0)} 个 · 展开明细`;
}

function safeExport(action: () => void) {
  if (!result || stale || running) return;
  try {
    action();
    setStatus('导出已生成 · CSV 使用完整原始计算值');
  } catch (error) {
    setStatus(`导出失败：${error instanceof Error ? error.message : '请重新分析后重试'}`, true);
  }
}
function exportIntervals(label: 'a' | 'b') {
  const report = label === 'a' ? result?.a : result?.b;
  if (!report) return;
  downloadCsv(
    `log-${label}-intervals.csv`,
    [
      '段号',
      '原行号',
      '有效序号',
      'PingNumber',
      '原时间字符串',
      '毫秒坐标',
      '相邻差值(ms)',
      '标志',
    ],
    report.records.map((record) => [
      record.segment,
      record.line,
      record.sequence,
      record.ping,
      record.rawTime,
      record.timestampMs,
      record.intervalMs,
      record.flags.join('; '),
    ]),
  );
}
listen(element('log-export-a'), 'click', () => safeExport(() => exportIntervals('a')));
listen(element('log-export-b'), 'click', () => safeExport(() => exportIntervals('b')));
listen(element('log-export-comparison'), 'click', () =>
  safeExport(() => {
    downloadCsv(
      'log-comparison.csv',
      [
        'A段号',
        'B段号',
        'PingNumber',
        'A行号',
        'B行号',
        'A原始时间',
        'B原始时间',
        'A毫秒坐标',
        'B毫秒坐标',
        'B-A(ms)',
      ],
      result!.comparison!.pairs.map((pair) => [
        pair.a.segment,
        pair.b.segment,
        pair.ping,
        pair.a.line,
        pair.b.line,
        pair.a.rawTime,
        pair.b.rawTime,
        pair.a.timestampMs,
        pair.b.timestampMs,
        pair.differenceMs,
      ]),
    );
  }),
);
listen(element('log-export-errors'), 'click', () =>
  safeExport(() => {
    const rows: CsvCell[][] = [];
    for (const [label, report] of [
      ['A', result!.a],
      ['B', result!.b],
    ] as const)
      if (report)
        for (const issue of report.errors)
          rows.push([label, issue.line, issue.code, issue.message, issue.preview]);
    downloadCsv(
      'log-errors.csv',
      ['文件代号', '行号', '错误代码', '中文说明', '截断原行文本'],
      rows,
    );
  }),
);
document.querySelectorAll<HTMLButtonElement>('[data-png]').forEach((button) =>
  listen(button, 'click', () =>
    safeExport(() => {
      const chart = charts.get(button.dataset.png!);
      if (!chart) throw new Error('没有可导出的图表。');
      exportChart(chart, `log-${button.dataset.png}${focus.checked ? '-focused' : ''}.png`);
    }),
  ),
);
document
  .querySelectorAll<HTMLButtonElement>('[data-reset]')
  .forEach((button) =>
    listen(button, 'click', () =>
      charts.get(button.dataset.reset!)?.dispatchAction({ type: 'dataZoom', start: 0, end: 100 }),
    ),
  );
listen(window, 'pagehide', () => {
  stopWorker();
  disposeCharts();
  fileA = null;
  fileB = null;
  result = null;
  abort.abort();
});
refreshButtons();
