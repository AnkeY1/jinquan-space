import { createChart, exportChart } from '../lib/chart';
import { downloadCsv } from '../lib/export';
import { TaskRunner } from '../lib/task';
import {
  CSV_DEFAULT_OPTIONS,
  CSV_LIMITS,
  csvDisplayPoints,
  validateCsvFileSize,
} from '../lib/csv-data';
import type { CsvData, CsvOptions, CsvSelection, CsvView } from '../lib/csv-data';
import type { EChartsType } from 'echarts/core';
import CsvWorker from '../workers/csv.worker?worker&inline';

const app = document.getElementById('csv-app');
if (app) setupCsv(app);

function setupCsv(root: HTMLElement) {
  const get = <T extends HTMLElement>(id: string) => {
    const element = document.getElementById(id);
    if (!element) throw new Error('CSV 界面缺少必要控件');
    return element as T;
  };
  const fileInput = get<HTMLInputElement>('csv-file');
  const start = get<HTMLButtonElement>('csv-start');
  const cancel = get<HTMLButtonElement>('csv-cancel');
  const status = get<HTMLParagraphElement>('csv-status');
  const progress = get<HTMLProgressElement>('csv-progress');
  const xInput = get<HTMLSelectElement>('csv-x');
  const ysContainer = get<HTMLDivElement>('csv-ys');
  const titleInput = get<HTMLInputElement>('csv-title');
  const xName = get<HTMLInputElement>('csv-x-name');
  const yName = get<HTMLInputElement>('csv-y-name');
  const xUnit = get<HTMLInputElement>('csv-x-unit');
  const yUnit = get<HTMLInputElement>('csv-y-unit');
  const runner = new TaskRunner();
  let file: File | undefined;
  let data: CsvData | undefined;
  let view: CsvView | undefined;
  let selection: CsvSelection = { x: 'row', ys: [] };
  let chart: EChartsType | undefined;
  let busy = false;
  let stale = true;
  let parseDirty = true;
  let page = 0;
  let version = 0;
  let sampleAbort: AbortController | undefined;

  const format = (value: number | null) =>
    value === null
      ? '—'
      : new Intl.NumberFormat('zh-CN', { maximumSignificantDigits: 8 }).format(value);
  const setStatus = (message: string) => {
    if (status.textContent !== message) status.textContent = message;
  };
  const setSelectionError = (message = '') => {
    const error = get('csv-selection-error');
    error.textContent = message;
    error.hidden = !message;
  };
  const setBusy = (value: boolean) => {
    busy = value;
    start.disabled = value || !file;
    cancel.disabled = !value;
    progress.hidden = !value;
    xInput.disabled = value || parseDirty;
    ysContainer.querySelectorAll<HTMLInputElement>('input').forEach((input) => {
      input.disabled = value || parseDirty || !data?.columns[Number(input.value)]?.numericCount;
    });
    if (value) progress.removeAttribute('value');
  };
  const setExportState = () => {
    ['csv-png', 'csv-export', 'csv-issues-export'].forEach((id) => {
      get<HTMLButtonElement>(id).disabled = stale || busy || !view;
    });
  };
  const markStale = () => {
    stale = true;
    get('csv-stale').hidden = !data;
    setExportState();
  };
  const stopTask = () => {
    version++;
    runner.cancel();
    sampleAbort?.abort();
    sampleAbort = undefined;
    setBusy(false);
  };
  const options = (): CsvOptions => ({
    header: get<HTMLInputElement>('csv-header').checked,
    delimiter:
      get<HTMLSelectElement>('csv-delimiter').value === 'tab'
        ? '\t'
        : (get<HTMLSelectElement>('csv-delimiter').value as CsvOptions['delimiter']),
    encoding: get<HTMLSelectElement>('csv-encoding').value as CsvOptions['encoding'],
  });
  function takeFile(next: File) {
    setSelectionError();
    parseDirty = true;
    stopTask();
    markStale();
    try {
      validateCsvFileSize(next.size);
      file = next;
      get('csv-filename').textContent =
        `${next.name} · ${new Intl.NumberFormat('zh-CN').format(next.size)} bytes`;
      setStatus('文件已准备就绪，点击“开始处理”。');
      start.disabled = false;
    } catch (error) {
      file = undefined;
      start.disabled = true;
      get('csv-filename').textContent = next.name;
      setStatus(error instanceof Error ? error.message : '无法读取文件，请重试。');
    }
  }
  const table = (container: HTMLElement, headers: string[], rows: (string | number | null)[][]) => {
    const element = document.createElement('table');
    const head = element.createTHead().insertRow();
    headers.forEach((text) => {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = text;
      head.append(th);
    });
    const body = element.createTBody();
    rows.forEach((row) => {
      const tr = body.insertRow();
      row.forEach((text) => {
        const value = text === null ? '—' : String(text);
        tr.insertCell().textContent =
          value.length > 1000 ? `${value.slice(0, 1000)}…（此单元格仅截断显示）` : value;
      });
    });
    container.replaceChildren(element);
  };
  function renderColumns() {
    if (!data) return;
    xInput.replaceChildren(new Option('数据行序号（从 1 开始）', 'row'));
    ysContainer.replaceChildren();
    data.columns.forEach((column) => {
      const option = new Option(column.label, String(column.index));
      option.disabled = column.numericCount === 0;
      xInput.append(option);
      const wrapper = document.createElement('div');
      wrapper.className = 'csv-y-option';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = String(column.index);
      input.id = `csv-y-${column.index}`;
      input.checked = selection.ys.includes(column.index);
      input.disabled = column.numericCount === 0;
      const label = document.createElement('label');
      label.htmlFor = input.id;
      label.append(document.createTextNode(column.label));
      const hint = document.createElement('small');
      hint.className = 'muted';
      hint.textContent = column.numericCount
        ? `${column.numericCount.toLocaleString('zh-CN')} 个数值${column.unsafeCount ? ` · ${column.unsafeCount} 个大整数不可精确表示` : ''}`
        : column.unsafeCount
          ? '仅有无法精确表示的大整数'
          : '无可用数值；文本或日期列不能作为数值轴';
      label.append(hint);
      wrapper.append(input, label);
      ysContainer.append(wrapper);
    });
    xInput.value = String(selection.x);
  }
  function renderOverview() {
    if (!data) return;
    const summary = get('csv-summary');
    summary.replaceChildren();
    const items: [string, string][] = [
      ['列数', String(data.columns.length)],
      ['数据记录', data.dataRowCount.toLocaleString('zh-CN')],
      ['无效行', String(data.invalidRowCount)],
      [
        '实际分隔符',
        data.delimiter === '\t' ? '制表符 Tab' : data.delimiter === ';' ? '分号 ;' : '逗号 ,',
      ],
    ];
    items.forEach(([label, value]) => {
      const item = document.createElement('div');
      item.className = 'stat';
      const caption = document.createElement('span');
      caption.className = 'muted';
      caption.textContent = label;
      const strong = document.createElement('strong');
      strong.textContent = value;
      item.append(caption, strong);
      summary.append(item);
    });
    table(
      get('csv-preview'),
      ['数据行', '原行号', ...data.columns.map((column) => column.label)],
      data.rows.slice(0, 20).map((row) => [row.dataRow, row.line, ...row.cells]),
    );
  }
  function renderTable() {
    if (!data || !view) return;
    const size = Number(get<HTMLSelectElement>('csv-page-size').value);
    const pages = Math.max(1, Math.ceil(view.points.length / size));
    page = Math.max(0, Math.min(page, pages - 1));
    const raw = get<HTMLSelectElement>('csv-table-view').value === 'raw';
    const xLabel = selection.x === 'row' ? '数据行序号' : data.columns[selection.x].label;
    const rows = view.points.slice(page * size, (page + 1) * size).map((point, offset) => {
      const original = data!.rows[page * size + offset];
      const x = raw && selection.x !== 'row' ? original.cells[selection.x] : point.x;
      const ys = raw ? selection.ys.map((index) => original.cells[index]) : point.ys;
      return [point.dataRow, point.line, x, ...ys];
    });
    table(
      get('csv-table'),
      ['数据行', '原行号', `X · ${xLabel}`, ...view.series.map((series) => series.column.label)],
      rows,
    );
    get('csv-page').textContent =
      `第 ${page + 1} / ${pages} 页 · ${view.points.length.toLocaleString('zh-CN')} 条有效结构记录`;
    get<HTMLButtonElement>('csv-prev').disabled = page === 0;
    get<HTMLButtonElement>('csv-next').disabled = page >= pages - 1;
  }
  function renderChart() {
    if (!data || !view) return;
    const axisTitle = (name: HTMLInputElement, unit: HTMLInputElement) =>
      `${name.value}${unit.value.trim() ? `（${unit.value.trim()}）` : ''}`;
    const display = view.series.map((_, index) => csvDisplayPoints(view!.points, index));
    const lineTypes = ['solid', 'dashed', 'dotted', 'solid'] as const;
    const option = {
      animation: false,
      title: {
        text: titleInput.value || 'CSV 数据曲线',
        left: 'center',
        textStyle: { fontSize: 15, width: 280, overflow: 'truncate' },
      },
      grid: { left: 65, right: 25, top: 88, bottom: 95 },
      tooltip: { trigger: 'axis', renderMode: 'richText', confine: true },
      legend: { top: 32, type: 'scroll' },
      xAxis: {
        type: 'value',
        name: axisTitle(xName, xUnit),
        nameLocation: 'middle',
        nameGap: 32,
        scale: true,
      },
      yAxis: { type: 'value', name: axisTitle(yName, yUnit), nameGap: 16, scale: true },
      dataZoom: [{ type: 'slider', xAxisIndex: 0, height: 20, bottom: 18, filterMode: 'none' }],
      series: view.series.map((series, index) => ({
        name: series.column.label,
        type: 'line',
        data: display[index],
        connectNulls: false,
        smooth: false,
        // A single point between gaps has no drawable line segment. Show only
        // these isolated samples so valid values never disappear after a gap.
        showSymbol: true,
        symbolSize: (_value: unknown, point: { dataIndex: number }) => {
          const neighbors = display[index];
          const hasValue = (offset: number) =>
            neighbors[offset]?.[0] != null && neighbors[offset]?.[1] != null;
          return hasValue(point.dataIndex) &&
            !hasValue(point.dataIndex - 1) &&
            !hasValue(point.dataIndex + 1)
            ? 8
            : 0;
        },
        lineStyle: { width: 2, type: lineTypes[index] },
      })),
    };
    if (chart) chart.setOption(option, { replaceMerge: ['series'] });
    else chart = createChart(get('csv-chart'), option);
    const counts = display
      .map(
        (points, index) =>
          `${view!.series[index].column.label} ${points.length.toLocaleString('zh-CN')}`,
      )
      .join(' / ');
    get('csv-display-note').textContent =
      `原始结构有效记录 ${view.points.length.toLocaleString('zh-CN')} 条；展示点数：${counts}。大数据按原顺序保留桶内首尾与极值，断点保留，孤立有效点用圆点标示。统计、导出使用完整数据。`;
    const warnings = [];
    if (view.nonMonotonic) warnings.push('当前按原始行顺序连接：数值 X 非单调，未自动排序。');
    if (view.invalidXCount) warnings.push(`${view.invalidXCount} 行 X 无效，对所有系列保留断点。`);
    if (!view.series.some((series) => series.stats.count))
      warnings.push('所选 X / Y 没有完整有效点，请调整选列；当前不绘制数值曲线。');
    const warning = get('csv-warning');
    warning.textContent = warnings.join(' ');
    warning.hidden = !warnings.length;
  }
  function renderView() {
    if (!view) return;
    table(
      get('csv-stats'),
      ['系列', '有效点', '缺失 / 无效点', '最小', '最大', '均值', '中位数', '总体标准差'],
      view.series.map(({ column, stats, invalidCount }) => [
        column.label,
        stats.count,
        invalidCount,
        format(stats.min),
        format(stats.max),
        format(stats.mean),
        format(stats.median),
        format(stats.stddev),
      ]),
    );
    get('csv-issue-summary').textContent =
      `问题记录 · ${view.issues.length.toLocaleString('zh-CN')} 条`;
    table(
      get('csv-issues'),
      ['数据行', '原行号', '列', '代码', '原因', '原始文本（截断）'],
      view.issues
        .slice(0, 200)
        .map((issue) => [
          issue.dataRow,
          issue.line,
          issue.column,
          issue.code,
          issue.message,
          issue.text,
        ]),
    );
    page = 0;
    renderTable();
    renderChart();
  }
  async function compute() {
    if (!data) return;
    markStale();
    if (parseDirty) {
      setStatus('当前文件或解析设置已改变，请重新分析后再选择绘图列。');
      return;
    }
    const current = ++version;
    runner.cancel();
    if (!selection.ys.length) {
      setBusy(false);
      setExportState();
      setSelectionError('需要至少选择一个含有效数值的 Y 列。');
      setStatus(
        data.columns.some((column) => column.numericCount > 0)
          ? '请选择至少一个含有效数值的 Y 列。'
          : '未发现可用数值列。请检查分隔符与编码，或选择包含十进制数值的文件；日期列不会自动解释。',
      );
      return;
    }
    setSelectionError();
    setBusy(true);
    setStatus('正在计算所选列的完整记录与统计…');
    setExportState();
    try {
      const result = await runner.run<CsvView>(new CsvWorker(), {
        action: 'derive',
        data,
        selection,
      });
      if (current !== version) return;
      if (
        !Array.isArray(result.points) ||
        !Array.isArray(result.series) ||
        !Array.isArray(result.issues)
      )
        throw new Error('计算结果格式无效，请重新处理。');
      view = result;
      stale = false;
      get('csv-stale').hidden = true;
      renderView();
      setStatus(
        result.issues.length
          ? `部分完成：${result.points.length.toLocaleString('zh-CN')} 条结构有效记录，${result.issues.length.toLocaleString('zh-CN')} 条问题，见问题记录。`
          : `处理完成：${result.points.length.toLocaleString('zh-CN')} 条记录，${result.series.length} 条曲线。`,
      );
    } catch (error) {
      if (current === version)
        setStatus(error instanceof Error ? error.message : '计算失败，请重新选择列。');
    } finally {
      if (current === version) {
        setBusy(false);
        setExportState();
      }
    }
  }
  async function analyze() {
    if (!file || busy) return;
    markStale();
    setBusy(true);
    setExportState();
    const current = ++version;
    setStatus('正在读取并严格解码本地文件…');
    try {
      const result = await runner.run<CsvData>(
        new CsvWorker(),
        { file, options: options() },
        (message) => {
          if (current !== version) return;
          const report = message as { stage?: string; completed?: number; total?: number };
          if (report.stage === 'reading') setStatus('正在读取本地文件…');
          else setStatus('正在解析 CSV 记录并校验行列上限…');
          if (
            typeof report.completed === 'number' &&
            typeof report.total === 'number' &&
            report.total > 0
          ) {
            progress.max = report.total;
            progress.value = report.completed;
          }
        },
      );
      if (current !== version) return;
      if (
        !Array.isArray(result.columns) ||
        !Array.isArray(result.rows) ||
        !Array.isArray(result.issues)
      )
        throw new Error('解析结果格式无效，请重新处理。');
      data = result;
      parseDirty = false;
      view = undefined;
      selection = {
        x: 'row',
        ys: result.columns
          .filter((column) => column.numericCount > 0)
          .slice(0, 2)
          .map((column) => column.index),
      };
      xName.value = '数据行序号';
      get('csv-empty').hidden = true;
      get('csv-result').hidden = false;
      get('csv-selection').hidden = false;
      renderColumns();
      renderOverview();
      setBusy(false);
      await compute();
    } catch (error) {
      if (current === version) {
        setBusy(false);
        setStatus(error instanceof Error ? error.message : '解析失败，请检查文件格式。');
        setExportState();
      }
    }
  }
  fileInput.addEventListener('change', () => {
    const next = fileInput.files?.[0];
    if (next) takeFile(next);
    fileInput.value = '';
  });
  start.addEventListener('click', () => {
    void analyze();
  });
  cancel.addEventListener('click', () => {
    stopTask();
    markStale();
    setStatus('已取消。可以立即选择新文件或使用示例。');
  });
  get('csv-clear').addEventListener('click', () => {
    setSelectionError();
    parseDirty = true;
    stopTask();
    file = undefined;
    data = undefined;
    view = undefined;
    selection = { x: 'row', ys: [] };
    page = 0;
    stale = true;
    chart?.dispose();
    chart = undefined;
    fileInput.value = '';
    get('csv-filename').textContent = '尚未选择文件';
    get('csv-result').hidden = true;
    get('csv-selection').hidden = true;
    get('csv-empty').hidden = false;
    ['csv-preview', 'csv-table', 'csv-stats', 'csv-issues', 'csv-summary', 'csv-ys'].forEach((id) =>
      get(id).replaceChildren(),
    );
    get<HTMLInputElement>('csv-header').checked = CSV_DEFAULT_OPTIONS.header;
    get<HTMLSelectElement>('csv-delimiter').value = CSV_DEFAULT_OPTIONS.delimiter;
    get<HTMLSelectElement>('csv-encoding').value = CSV_DEFAULT_OPTIONS.encoding;
    titleInput.value = 'CSV 数据曲线';
    xName.value = '数据行序号';
    yName.value = '数值';
    xUnit.value = '';
    yUnit.value = '';
    setStatus('已清空当前页面的数据，可以重新开始。');
    setExportState();
  });
  get('csv-sample').addEventListener('click', () => {
    stopTask();
    const controller = new AbortController();
    sampleAbort = controller;
    setStatus('正在读取本站合成示例…');
    void fetch(root.dataset.sample!, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('示例加载失败，可下载示例后手动选择。');
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        takeFile(new File([blob], '合成示例.csv', { type: 'text/csv' }));
        get<HTMLInputElement>('csv-header').checked = true;
        get<HTMLSelectElement>('csv-delimiter').value = 'auto';
        get<HTMLSelectElement>('csv-encoding').value = 'utf-8';
        void analyze();
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setStatus(error instanceof Error ? error.message : '示例读取失败，请重试。');
      });
  });
  ['csv-header', 'csv-delimiter', 'csv-encoding'].forEach((id) =>
    get(id).addEventListener('change', () => {
      parseDirty = true;
      stopTask();
      markStale();
      setStatus('解析设置已改变，请点击“开始处理”重新分析。');
    }),
  );
  xInput.addEventListener('change', () => {
    selection.x = xInput.value === 'row' ? 'row' : Number(xInput.value);
    xName.value = selection.x === 'row' ? '数据行序号' : (data?.columns[selection.x].label ?? 'X');
    void compute();
  });
  ysContainer.addEventListener('change', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    const selected = Array.from(
      ysContainer.querySelectorAll<HTMLInputElement>('input:checked'),
    ).map((item) => Number(item.value));
    if (selected.length > CSV_LIMITS.series) {
      input.checked = false;
      setSelectionError('最多选择 4 条曲线，请先取消一个 Y 列。');
      setStatus('最多同时选择 4 条曲线，请先取消一个 Y 列。');
      return;
    }
    selection.ys = selected;
    void compute();
  });
  [titleInput, xName, yName, xUnit, yUnit].forEach((input) =>
    input.addEventListener('input', renderChart),
  );
  ['csv-page-size', 'csv-table-view'].forEach((id) =>
    get(id).addEventListener('change', () => {
      page = 0;
      renderTable();
    }),
  );
  get('csv-prev').addEventListener('click', () => {
    page--;
    renderTable();
  });
  get('csv-next').addEventListener('click', () => {
    page++;
    renderTable();
  });
  get('csv-reset').addEventListener('click', () => {
    chart?.dispatchAction({ type: 'dataZoom', start: 0, end: 100 });
  });
  const exportSafely = (operation: () => void) => {
    if (stale || busy || !view) return;
    try {
      operation();
    } catch {
      setStatus('导出失败，请确认浏览器允许下载后重试。');
    }
  };
  get('csv-export').addEventListener('click', () =>
    exportSafely(() => {
      downloadCsv(
        'csv-processed-data.csv',
        ['原数据行号', '原物理行号', 'X', ...view!.series.map((series) => series.column.label)],
        view!.points.map((point) => [point.dataRow, point.line, point.x, ...point.ys]),
      );
    }),
  );
  get('csv-issues-export').addEventListener('click', () =>
    exportSafely(() => {
      downloadCsv(
        'csv-issues.csv',
        ['原数据行号', '原物理行号', '列', '代码', '原因', '原始文本（截断）'],
        view!.issues.map((issue) => [
          issue.dataRow,
          issue.line,
          issue.column,
          issue.code,
          issue.message,
          issue.text,
        ]),
      );
    }),
  );
  get('csv-png').addEventListener('click', () =>
    exportSafely(() => {
      if (chart) exportChart(chart, 'csv-plot.png');
    }),
  );
  const drop = get('csv-drop');
  drop.addEventListener('dragover', (event) => {
    event.preventDefault();
    drop.classList.add('is-dragging');
  });
  drop.addEventListener('dragleave', () => drop.classList.remove('is-dragging'));
  drop.addEventListener('drop', (event) => {
    event.preventDefault();
    drop.classList.remove('is-dragging');
    if (event.dataTransfer?.files.length !== 1) {
      setStatus('每次请选择一个 CSV / TSV 文件。');
      return;
    }
    takeFile(event.dataTransfer.files[0]);
  });
  window.addEventListener(
    'pagehide',
    () => {
      stopTask();
      runner.dispose();
      chart?.dispose();
      file = undefined;
      data = undefined;
      view = undefined;
    },
    { once: true },
  );
}
