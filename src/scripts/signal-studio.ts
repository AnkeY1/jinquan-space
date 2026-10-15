import { SIGNAL_DEFAULTS, SIGNAL_PRESETS, type SignalParameters } from '../data/experiments';
import { downloadCsv } from '../lib/export';
import {
  isSignalResult,
  parseSignalSearch,
  signalParametersToSearch,
  signalPlotPoints,
  validateSignalParameters,
  type SignalResult,
} from '../lib/signal';
import { TaskRunner } from '../lib/task';
import type { ECharts, EChartsCoreOption } from '../lib/chart';
import SignalWorker from '../workers/signal.worker?worker&inline';

function initializeSignalStudio(): void {
  const form = document.querySelector<HTMLFormElement>('#signal-form');
  if (!form) return;
  const get = <T extends HTMLElement = HTMLElement>(id: string): T => {
    const element = document.getElementById(id);
    if (!element) throw new Error(`缺少信号实验室组件：${id}`);
    return element as T;
  };
  const runner = new TaskRunner();
  const events = new AbortController();
  const status = get('signal-status');
  const resultArea = document.querySelector<HTMLElement>('.signal-results')!;
  const cancel = get<HTMLButtonElement>('signal-cancel');
  const calculate = get<HTMLButtonElement>('signal-recalculate');
  const retryChart = get<HTMLButtonElement>('signal-retry-chart');
  const exportButtons = [
    'signal-export-time',
    'signal-export-spectrum',
    'signal-export-time-image',
    'signal-export-image',
    'signal-share',
    'signal-reset-view',
    'signal-zoom-time',
  ].map((id) => get<HTMLButtonElement>(id));
  let result: SignalResult | null = null;
  let charts: { time: ECharts; spectrum: ECharts } | null = null;
  let chartModule: typeof import('../lib/chart') | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;
  let disposed = false;
  let fresh = false;
  let linkWarnings: string[] = [];

  const on = <K extends keyof HTMLElementEventMap>(
    element: HTMLElement,
    type: K,
    listener: (event: HTMLElementEventMap[K]) => void,
  ) => element.addEventListener(type, listener as EventListener, { signal: events.signal });
  const number = (value: number, digits = 4) =>
    Number(value.toFixed(digits)).toLocaleString('zh-CN', { maximumFractionDigits: digits });
  const setStatus = (message: string, state: string) => {
    status.textContent = message;
    status.dataset.state = state;
    status.classList.toggle('error', state === 'error');
  };
  function setExports(): void {
    for (const button of exportButtons) {
      const needsChart = [
        'signal-export-image',
        'signal-export-time-image',
        'signal-reset-view',
        'signal-zoom-time',
      ].includes(button.id);
      button.disabled = !fresh || (needsChart && !charts);
    }
  }
  function invalidate(): void {
    fresh = false;
    resultArea.dataset.stale = result ? 'true' : 'false';
    setExports();
  }
  function showWarnings(messages: string[]): void {
    const container = get('signal-warnings');
    container.replaceChildren();
    for (const message of messages) {
      const paragraph = document.createElement('p');
      paragraph.textContent = message;
      container.append(paragraph);
    }
    container.hidden = messages.length === 0;
  }
  function formValues(): Record<string, string> {
    return Object.fromEntries(
      Array.from(new FormData(form!).entries(), ([key, value]) => [key, String(value)]),
    );
  }
  function clearErrors(): void {
    for (const input of form!.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[name]')) {
      input.removeAttribute('aria-invalid');
      const error = document.getElementById(`signal-${input.name}-error`);
      if (error) error.textContent = '';
    }
  }
  function validateForm(): SignalParameters | null {
    clearErrors();
    const validation = validateSignalParameters(formValues());
    if (validation.ok) return validation.value;
    for (const [key, message] of Object.entries(validation.errors)) {
      const input = form!.elements.namedItem(key);
      if (input instanceof HTMLElement) input.setAttribute('aria-invalid', 'true');
      const error = document.getElementById(`signal-${key}-error`);
      if (error) error.textContent = message;
    }
    setStatus(
      `参数需要调整。${result ? '结果已过期，请修正参数后重新计算。' : '请修正标出的参数。'}`,
      'error',
    );
    return null;
  }
  function updateFrequencyRange(fs: number): void {
    for (const key of ['f1', 'f2']) {
      const input = form!.elements.namedItem(key) as HTMLInputElement;
      const range = form!.querySelector<HTMLInputElement>(`[data-signal-range="${key}"]`)!;
      input.max = String(fs * 2);
      range.max = String(fs * 2);
    }
  }
  function fillForm(parameters: SignalParameters): void {
    updateFrequencyRange(parameters.fs);
    for (const [key, value] of Object.entries(parameters)) {
      const input = form!.elements.namedItem(key);
      if (input instanceof HTMLInputElement || input instanceof HTMLSelectElement)
        input.value = String(value);
      const range = form!.querySelector<HTMLInputElement>(`[data-signal-range="${key}"]`);
      if (range) range.value = String(value);
    }
    clearErrors();
  }
  function chartOption(kind: 'time' | 'spectrum', data: [number, number][]): EChartsCoreOption {
    const timeDomain = kind === 'time';
    return {
      title: { text: timeDomain ? '时域采样波形' : '单边幅度谱', left: 'center', top: 8 },
      grid: { left: 32, right: 24, top: 54, bottom: 64, containLabel: true },
      legend: { show: false },
      tooltip: { trigger: 'axis', renderMode: 'richText', confine: true },
      xAxis: {
        type: 'value',
        name: timeDomain ? '时间 / s' : '频率 / Hz',
        nameLocation: 'middle',
        nameGap: 30,
        min: 0,
        max: timeDomain ? undefined : result!.parameters.fs / 2,
        axisLabel: { hideOverlap: true },
      },
      yAxis: {
        type: 'value',
        name: timeDomain ? '信号幅度' : '线性幅度',
        nameGap: 16,
        min: timeDomain ? undefined : 0,
      },
      dataZoom: [{ type: 'slider', height: 16, bottom: 3, start: 0, end: 100 }],
      series: [
        {
          name: timeDomain ? '合成采样信号' : '单边幅度',
          type: 'line',
          data,
          smooth: false,
          showSymbol: false,
          symbol: 'circle',
          lineStyle: { width: timeDomain ? 1.3 : 1.6 },
          color: timeDomain ? '#357d82' : '#b67a35',
        },
      ],
    };
  }
  async function renderCharts(expected: SignalResult): Promise<void> {
    const generationAtStart = generation;
    try {
      chartModule ??= await import('../lib/chart');
      if (disposed || expected !== result || generationAtStart !== generation) return;
      const time = signalPlotPoints(expected.time, expected.samples);
      const spectrum = signalPlotPoints(expected.frequencies, expected.amplitudes);
      if (!charts) {
        const timeChart = chartModule.createChart(
          get('signal-time-chart'),
          chartOption('time', time),
        );
        try {
          charts = {
            time: timeChart,
            spectrum: chartModule.createChart(
              get('signal-spectrum-chart'),
              chartOption('spectrum', spectrum),
            ),
          };
        } catch (error) {
          timeChart.dispose();
          throw error;
        }
        for (const kind of ['time', 'spectrum'] as const) {
          charts[kind].on('datazoom', () => {
            if (!charts) return;
            const option = charts[kind].getOption();
            const zoom = (
              option.dataZoom as Array<{ start?: number; end?: number }> | undefined
            )?.[0];
            const container = get(`signal-${kind}-chart`);
            const start = zoom?.start ?? 0;
            const end = zoom?.end ?? 100;
            container.dataset.viewStart = String(start);
            container.dataset.viewEnd = String(end);
            const original = container.getAttribute('aria-label')?.split(' 当前视图：')[0] ?? '';
            container.setAttribute(
              'aria-label',
              `${original} 当前视图：${number(start)}% 到 ${number(end)}%。`,
            );
          });
        }
      } else {
        charts.time.setOption(chartOption('time', time));
        charts.spectrum.setOption(chartOption('spectrum', spectrum));
      }
      const timeDescription = `原始 ${expected.parameters.n} 点 / 展示 ${time.length} 点；最后采样时刻 ${number(expected.lastSampleTime, 6)} s。${time.length < expected.parameters.n ? '图表按桶保留首尾与极值；CSV 保留全部样本。' : '图表展示全部样本。'}`;
      get('signal-sample-description').textContent = timeDescription;
      get('signal-time-chart').setAttribute('aria-label', `时域采样波形，${timeDescription}`);
      get('signal-spectrum-chart').setAttribute(
        'aria-label',
        `单边幅度谱，最大频点 ${number(expected.peakFrequency)} Hz，幅度 ${number(expected.peakAmplitude)}；频率间隔 ${number(expected.deltaF)} Hz。`,
      );
      for (const kind of ['time', 'spectrum']) {
        get(`signal-${kind}-chart`).dataset.viewStart = '0';
        get(`signal-${kind}-chart`).dataset.viewEnd = '100';
      }
      retryChart.hidden = true;
      setExports();
    } catch (error) {
      if (disposed || generationAtStart !== generation) return;
      retryChart.hidden = false;
      setStatus(
        `数值已计算，图表加载失败。${error instanceof Error ? error.message : '请点击重试加载图表。'}`,
        'partial',
      );
    }
  }
  function renderResult(expected: SignalResult): void {
    get('signal-delta').textContent = `${number(expected.deltaF)} Hz`;
    get('signal-duration').textContent = `${number(expected.duration, 6)} s`;
    get('signal-peak').textContent = `${number(expected.peakFrequency)} Hz`;
    get('signal-window-description').textContent =
      `${expected.parameters.window === 'hann-periodic' ? '周期 Hann 窗' : '矩形窗'} · 实际窗系数和 W=${number(expected.windowSum, 6)} · ${expected.amplitudes.length} 个完整单边频点。`;
    showWarnings([...linkWarnings, ...expected.warnings]);
    const rows: HTMLTableRowElement[] = [];
    for (let i = 0; i < Math.min(16, expected.parameters.n); i++) {
      const row = document.createElement('tr');
      for (const value of [
        i,
        expected.time[i]!,
        expected.samples[i]!,
        expected.frequencies[i]!,
        expected.amplitudes[i]!,
      ]) {
        const cell = document.createElement('td');
        cell.textContent = number(value, 6);
        row.append(cell);
      }
      rows.push(row);
    }
    get('signal-data-table').replaceChildren(...rows);
    void renderCharts(expected);
  }
  async function compute(): Promise<void> {
    const parameters = validateForm();
    if (!parameters) return;
    const currentGeneration = ++generation;
    invalidate();
    cancel.disabled = false;
    calculate.disabled = true;
    resultArea.setAttribute('aria-busy', 'true');
    setStatus('正在本地合成信号并计算 FFT…', 'computing');
    try {
      const response = await runner.run<unknown>(new SignalWorker(), parameters);
      if (disposed || currentGeneration !== generation) return;
      if (!isSignalResult(response)) throw new Error('计算模块返回的数据格式不正确，请重试。');
      result = response;
      fresh = true;
      resultArea.dataset.stale = 'false';
      setExports();
      setStatus(
        `计算完成：${response.parameters.n} 个样本，${response.amplitudes.length} 个单边频点。`,
        'success',
      );
      renderResult(response);
    } catch (error) {
      if (disposed || currentGeneration !== generation) return;
      setStatus(error instanceof Error ? error.message : '计算失败，请检查参数后重试。', 'error');
    } finally {
      if (!disposed && currentGeneration === generation) {
        cancel.disabled = true;
        calculate.disabled = false;
        resultArea.removeAttribute('aria-busy');
      }
    }
  }
  function schedule(): void {
    clearTimeout(timer);
    generation++;
    runner.cancel();
    cancel.disabled = true;
    calculate.disabled = false;
    invalidate();
    resultArea.removeAttribute('aria-busy');
    if (!validateForm()) return;
    setStatus(result ? '参数已变化，结果已过期；即将重新计算…' : '参数已就绪，即将计算…', 'ready');
    timer = setTimeout(() => void compute(), 100);
  }
  on(form, 'input', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement)) return;
    linkWarnings = [];
    if (input instanceof HTMLInputElement && input.dataset.signalRange) {
      const numberInput = form.elements.namedItem(input.dataset.signalRange) as HTMLInputElement;
      numberInput.value = input.value;
    } else if (input.name) {
      const range = form.querySelector<HTMLInputElement>(`[data-signal-range="${input.name}"]`);
      if (range && input.value !== '' && Number.isFinite(Number(input.value)))
        range.value = input.value;
    }
    if (input.name === 'fs') updateFrequencyRange(Number(input.value));
    schedule();
  });
  on(form, 'submit', (event) => {
    event.preventDefault();
    clearTimeout(timer);
    void compute();
  });
  on(cancel, 'click', () => {
    clearTimeout(timer);
    generation++;
    runner.cancel();
    invalidate();
    cancel.disabled = true;
    calculate.disabled = false;
    resultArea.removeAttribute('aria-busy');
    setStatus(
      `计算已取消。${result ? '保留的结果已过期，可重新计算。' : '可调整参数后重新计算。'}`,
      'cancelled',
    );
  });
  on(get('signal-reset'), 'click', () => {
    fillForm({ ...SIGNAL_DEFAULTS });
    linkWarnings = [];
    history.pushState(null, '', location.pathname);
    schedule();
  });
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-signal-preset]')) {
    on(button, 'click', () => {
      const preset = SIGNAL_PRESETS.find(
        (candidate) => candidate.id === button.dataset.signalPreset,
      );
      if (!preset) return;
      fillForm({ ...preset.parameters });
      linkWarnings = [];
      schedule();
    });
  }
  function exportCurrent(action: (current: SignalResult) => void): void {
    if (!fresh || !result) return;
    try {
      action(result);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '导出失败，请重试。', 'error');
    }
  }
  on(get('signal-export-time'), 'click', () =>
    exportCurrent((current) => {
      downloadCsv(
        'signal-time-synthetic.csv',
        ['sample_index', 'time_s', 'signal_amplitude'],
        Array.from(current.samples, (value, i) => [i, current.time[i]!, value]),
      );
      setStatus(`已导出全部 ${current.parameters.n} 个时域样本。`, 'success');
    }),
  );
  on(get('signal-export-spectrum'), 'click', () =>
    exportCurrent((current) => {
      downloadCsv(
        'signal-spectrum-synthetic.csv',
        ['frequency_Hz', 'one_sided_linear_amplitude'],
        Array.from(current.amplitudes, (value, i) => [current.frequencies[i]!, value]),
      );
      setStatus(`已导出全部 ${current.amplitudes.length} 个单边幅度频点。`, 'success');
    }),
  );
  on(get('signal-export-image'), 'click', () =>
    exportCurrent(() => {
      if (!charts || !chartModule) throw new Error('图表尚未准备好，请重试加载。');
      chartModule.exportChart(charts.spectrum, 'signal-spectrum-synthetic.png');
      setStatus('已导出带标题与坐标单位的幅度谱 PNG。', 'success');
    }),
  );
  on(get('signal-export-time-image'), 'click', () =>
    exportCurrent(() => {
      if (!charts || !chartModule) throw new Error('图表尚未准备好，请重试加载。');
      chartModule.exportChart(charts.time, 'signal-time-synthetic.png');
      setStatus('已导出带标题与坐标单位的时域 PNG。', 'success');
    }),
  );
  on(get('signal-zoom-time'), 'click', () => {
    charts?.time.dispatchAction({ type: 'dataZoom', start: 0, end: 25 });
    setStatus('时域图已放大到前 1/4 采样窗；CSV 仍保留完整数据。', 'success');
  });
  on(get('signal-reset-view'), 'click', () => {
    charts?.time.dispatchAction({ type: 'dataZoom', start: 0, end: 100 });
    charts?.spectrum.dispatchAction({ type: 'dataZoom', start: 0, end: 100 });
    setStatus('两个图表均已恢复完整视图。', 'success');
  });
  on(get('signal-share'), 'click', () => {
    if (!fresh || !result) return;
    const url = new URL(location.href);
    url.search = signalParametersToSearch(result.parameters);
    url.hash = '';
    history.pushState(null, '', url);
    if (!navigator.clipboard?.writeText) {
      setStatus('当前浏览器无法直接复制。参数链接已写入地址栏，可从地址栏复制。', 'partial');
      return;
    }
    void navigator.clipboard
      .writeText(url.href)
      .then(() => setStatus('参数链接已复制；相同种子可复现相同合成数据。', 'success'))
      .catch(() => {
        setStatus('浏览器未允许复制。参数链接已写入地址栏，可从地址栏复制。', 'partial');
      });
  });
  on(retryChart, 'click', () => {
    if (result && fresh) void renderCharts(result);
  });
  window.addEventListener(
    'popstate',
    () => {
      const parsed = parseSignalSearch(location.search);
      linkWarnings = parsed.warnings;
      fillForm(parsed.parameters);
      showWarnings(linkWarnings);
      schedule();
    },
    { signal: events.signal },
  );
  window.addEventListener(
    'pagehide',
    () => {
      disposed = true;
      generation++;
      clearTimeout(timer);
      events.abort();
      runner.dispose();
      charts?.time.dispose();
      charts?.spectrum.dispose();
      charts = null;
      result = null;
    },
    { signal: events.signal, once: true },
  );

  const parsed = parseSignalSearch(location.search);
  linkWarnings = parsed.warnings;
  fillForm(parsed.parameters);
  showWarnings(linkWarnings);
  void compute();
}

initializeSignalStudio();
window.addEventListener('pageshow', (event) => {
  if (event.persisted) initializeSignalStudio();
});
