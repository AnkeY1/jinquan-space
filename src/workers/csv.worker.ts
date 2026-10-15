import {
  CsvError,
  decodeCsv,
  deriveCsv,
  isCsvOptions,
  parseCsv,
  validateCsvFileSize,
} from '../lib/csv-data';
import type { CsvData, CsvSelection } from '../lib/csv-data';

self.onmessage = async (event: MessageEvent<unknown>) => {
  const message = event.data;
  if (!message || typeof message !== 'object') return;
  const request = message as { taskId?: number; payload?: unknown };
  if (!Number.isSafeInteger(request.taskId)) return;
  const taskId = request.taskId;
  try {
    if (!request.payload || typeof request.payload !== 'object')
      throw new CsvError('REQUEST', '任务参数无效。');
    const payload = request.payload as {
      action?: string;
      file?: File;
      options?: unknown;
      data?: CsvData;
      selection?: CsvSelection;
    };
    if (payload.action === 'derive') {
      if (
        !payload.data ||
        !Array.isArray(payload.data.rows) ||
        !Array.isArray(payload.data.columns) ||
        !payload.selection
      )
        throw new CsvError('REQUEST', '绘图数据无效，请重新解析文件。');
      self.postMessage({ taskId, type: 'progress', stage: 'computing' });
      self.postMessage({
        taskId,
        type: 'success',
        result: deriveCsv(payload.data, payload.selection),
      });
      return;
    }
    if (!(payload.file instanceof File) || !isCsvOptions(payload.options))
      throw new CsvError('REQUEST', '请重新选择文件并检查解析设置。');
    validateCsvFileSize(payload.file.size);
    self.postMessage({ taskId, type: 'progress', stage: 'reading' });
    const buffer = await payload.file.arrayBuffer();
    const text = decodeCsv(buffer, payload.options.encoding);
    self.postMessage({ taskId, type: 'progress', stage: 'parsing' });
    const result = parseCsv(text, payload.options, (completed, total) => {
      self.postMessage({ taskId, type: 'progress', stage: 'parsing', completed, total });
    });
    self.postMessage({ taskId, type: 'success', result });
  } catch (error) {
    self.postMessage({
      taskId,
      type: 'error',
      code: error instanceof CsvError ? error.code : 'CSV_ERROR',
      message:
        error instanceof CsvError
          ? error.message
          : 'CSV 处理失败，可能是浏览器内存不足。请缩小文件后重试。',
    });
  }
};
