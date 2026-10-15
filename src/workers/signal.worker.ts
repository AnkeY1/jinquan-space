/// <reference lib="webworker" />
import { generateSignal } from '../lib/signal';

const scope = self as unknown as DedicatedWorkerGlobalScope;
scope.addEventListener('message', (event: MessageEvent<unknown>) => {
  if (!event.data || typeof event.data !== 'object') return;
  const request = event.data as { type?: unknown; taskId?: unknown; payload?: unknown };
  if (
    request.type !== 'run' ||
    !Number.isSafeInteger(request.taskId) ||
    (request.taskId as number) < 0
  )
    return;
  const taskId = request.taskId as number;
  try {
    const result = generateSignal(request.payload);
    scope.postMessage({ taskId, type: 'success', result }, [
      result.time.buffer,
      result.samples.buffer,
      result.frequencies.buffer,
      result.amplitudes.buffer,
    ]);
  } catch (error) {
    scope.postMessage({
      taskId,
      type: 'error',
      code: 'SIGNAL_PARAMETERS',
      message: error instanceof Error ? error.message : '信号计算失败，请检查参数后重试。',
    });
  }
});
