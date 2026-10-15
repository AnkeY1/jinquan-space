export const tools = [
  {
    id: 'log-analyzer',
    title: '日志时间差分析器',
    summary: '逐条检查记录间隔，按编号比较两份日志。让正负差值与异常都保持原样。',
    path: '/tools/log-analyzer/',
    tags: ['日志', '时间差', 'Web Worker'],
    format: 'LOG / TXT',
    limit: '每个 10 MiB · 最多 2 个',
    visibility: 'public',
    kind: 'demo',
  },
  {
    id: 'csv-plotter',
    title: '浏览器数据绘图器',
    summary: '选取数据列，在浏览器中绘制曲线。缺失值保留断点，结果可以直接导出。',
    path: '/tools/csv-plotter/',
    tags: ['CSV', '数据可视化', 'Web Worker'],
    format: 'CSV / TSV',
    limit: '10 MiB · 最多 4 条曲线',
    visibility: 'public',
    kind: 'demo',
  },
] as const;
