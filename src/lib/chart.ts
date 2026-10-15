import { init, use, type ECharts, type EChartsCoreOption } from 'echarts/core';
import { LineChart, ScatterChart } from 'echarts/charts';
import {
  GridComponent,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  ToolboxComponent,
  MarkLineComponent,
  MarkPointComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
use([
  LineChart,
  ScatterChart,
  GridComponent,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  ToolboxComponent,
  MarkLineComponent,
  MarkPointComponent,
  CanvasRenderer,
]);
export type { ECharts, EChartsCoreOption };
function palette() {
  const css = getComputedStyle(document.documentElement);
  return {
    text: css.getPropertyValue('--text').trim(),
    muted: css.getPropertyValue('--muted').trim(),
    border: css.getPropertyValue('--border').trim(),
    bg: css.getPropertyValue('--surface').trim(),
  };
}
export function createChart(element: HTMLElement, option: EChartsCoreOption): ECharts {
  const chart = init(element, undefined, { renderer: 'canvas' });
  const base: EChartsCoreOption = {
    animation: false,
    color: ['#3679dc', '#df773b', '#2b9c87', '#ad77cd'],
    grid: { left: 60, right: 24, top: 64, bottom: 70, containLabel: true },
    tooltip: { trigger: 'axis', renderMode: 'richText', confine: true },
    legend: { top: 30 },
    dataZoom: [{ type: 'slider', height: 20, bottom: 12 }],
    ...option,
  };
  chart.setOption(base);
  const applyTheme = () => {
    const p = palette();
    chart.setOption({
      backgroundColor: p.bg,
      textStyle: { color: p.text, fontFamily: 'system-ui, Microsoft YaHei, sans-serif' },
      title: { textStyle: { color: p.text, fontSize: 14 }, subtextStyle: { color: p.muted } },
      legend: { textStyle: { color: p.muted } },
      xAxis: {
        axisLabel: { color: p.muted },
        nameTextStyle: { color: p.muted },
        axisLine: { lineStyle: { color: p.border } },
        splitLine: { lineStyle: { color: p.border } },
      },
      yAxis: {
        axisLabel: { color: p.muted },
        nameTextStyle: { color: p.muted },
        axisLine: { lineStyle: { color: p.border } },
        splitLine: { lineStyle: { color: p.border } },
      },
    });
  };
  applyTheme();
  const observer = new ResizeObserver(() => chart.resize());
  observer.observe(element);
  document.addEventListener('jinquan:theme-change', applyTheme);
  const dispose = chart.dispose.bind(chart);
  chart.dispose = () => {
    observer.disconnect();
    document.removeEventListener('jinquan:theme-change', applyTheme);
    dispose();
  };
  return chart;
}
export function exportChart(chart: ECharts, filename: string): void {
  if (chart.isDisposed()) throw new Error('图表已释放，请重新计算后导出');
  const a = document.createElement('a');
  a.href = chart.getDataURL({
    type: 'png',
    pixelRatio: 2,
    backgroundColor: palette().bg,
    excludeComponents: ['toolbox'],
  });
  a.download = filename.endsWith('.png') ? filename : `${filename}.png`;
  a.click();
}
