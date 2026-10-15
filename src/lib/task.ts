export interface TaskProgress {
  stage?: string;
  completed?: number;
  total?: number;
}
/** A CPU-bound Worker is cancelled by termination; stale task messages cannot win. */
export class TaskRunner {
  private current: Worker | null = null;
  private taskId = 0;
  private rejectCurrent: ((reason: Error) => void) | null = null;
  run<T>(
    source: Worker | (() => Worker),
    payload: unknown,
    onProgress?: (progress: TaskProgress) => void,
  ): Promise<T> {
    this.cancel();
    const worker = typeof source === 'function' ? source() : source;
    this.current = worker;
    const id = ++this.taskId;
    return new Promise<T>((resolve, reject) => {
      this.rejectCurrent = reject;
      const finish = () => {
        worker.terminate();
        if (this.current === worker) {
          this.current = null;
          this.rejectCurrent = null;
        }
      };
      worker.onmessage = (event: MessageEvent<unknown>) => {
        const message = event.data;
        if (
          !message ||
          typeof message !== 'object' ||
          !('taskId' in message) ||
          message.taskId !== id ||
          this.current !== worker ||
          !('type' in message)
        )
          return;
        if (message.type === 'progress') {
          onProgress?.(message as TaskProgress);
          return;
        }
        if ((message.type === 'success' || message.type === 'result') && 'result' in message) {
          finish();
          resolve(message.result as T);
        } else if (message.type === 'error') {
          finish();
          reject(
            new Error(
              'message' in message && typeof message.message === 'string'
                ? message.message
                : '计算失败，请检查输入后重试',
            ),
          );
        } else {
          finish();
          reject(new Error('计算模块返回了无效消息，请重试'));
        }
      };
      worker.onerror = () => {
        finish();
        reject(new Error('计算模块未能运行，请重新加载页面后重试'));
      };
      worker.onmessageerror = () => {
        finish();
        reject(new Error('计算结果无法读取，请尝试较小文件'));
      };
      worker.postMessage({ type: 'run', taskId: id, payload });
    });
  }
  cancel(): void {
    this.taskId++;
    this.current?.terminate();
    this.current = null;
    this.rejectCurrent?.(new Error('任务已取消'));
    this.rejectCurrent = null;
  }
  dispose(): void {
    this.cancel();
  }
}
