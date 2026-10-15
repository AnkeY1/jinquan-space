/// <reference lib="webworker" />
import {
  compareLogSegments,
  LogError,
  parseLog,
  validateLogFile,
  type LogAnalysis,
  type LogWorkerRequest,
  type LogWorkerResponse,
} from '../lib/log';

const scope = self as unknown as DedicatedWorkerGlobalScope;
scope.onmessage = async (event: MessageEvent<unknown>) => {
  const message = event.data as Partial<LogWorkerRequest>;
  if (
    message.type !== 'run' ||
    message.tool !== 'log-analyzer' ||
    !Number.isSafeInteger(message.taskId)
  )
    return;
  const taskId = message.taskId!;
  const send = (response: LogWorkerResponse) => scope.postMessage(response);
  try {
    const payload = message.payload;
    if (
      !payload ||
      !(payload.fileA instanceof File) ||
      (payload.fileB !== null && !(payload.fileB instanceof File)) ||
      !['utf-8', 'gb18030'].includes(payload.encoding) ||
      !Number.isSafeInteger(payload.segmentA) ||
      !Number.isSafeInteger(payload.segmentB) ||
      payload.segmentA < 1 ||
      payload.segmentB < 1
    )
      throw new LogError('INVALID_REQUEST', '日志任务参数无效，请重新选择文件。');
    validateLogFile(payload.fileA);
    if (payload.fileB) validateLogFile(payload.fileB);
    const decode = async (file: File, label: string) => {
      send({ type: 'progress', taskId, stage: `读取日志 ${label}` });
      const bytes = await file.arrayBuffer();
      let text: string;
      try {
        text = new TextDecoder(payload.encoding, { fatal: true }).decode(bytes);
      } catch {
        throw new LogError(
          'DECODE_ERROR',
          `日志 ${label} 无法按 ${payload.encoding.toUpperCase()} 严格解码，请检查文件并选择正确编码。`,
        );
      }
      send({
        type: 'progress',
        taskId,
        stage: `解析日志 ${label}`,
        completed: 0,
        total: text.length,
      });
      const report = parseLog(text, (completed, total) =>
        send({ type: 'progress', taskId, stage: `解析日志 ${label}`, completed, total }),
      );
      if (!report.records.length)
        throw new LogError(
          'NO_VALID_RECORDS',
          `日志 ${label} 没有符合格式的有效记录，请检查格式与编码。`,
        );
      return report;
    };
    const a = await decode(payload.fileA, 'A');
    const b = payload.fileB ? await decode(payload.fileB, 'B') : null;
    send({ type: 'progress', taskId, stage: '计算记录时间差' });
    const result: LogAnalysis = {
      a,
      b,
      comparison: b ? compareLogSegments(a, b, payload.segmentA, payload.segmentB) : null,
    };
    send({ type: 'result', taskId, result });
  } catch (error) {
    send({
      type: 'error',
      taskId,
      code: error instanceof LogError ? error.code : 'PROCESSING_ERROR',
      message:
        error instanceof LogError
          ? error.message
          : '本次分析未完成，可能是浏览器资源不足。请缩小文件后重试。',
    });
  }
};
