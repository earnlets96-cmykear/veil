/**
 * Worker Pool / Manager for VEIL Media Transformations.
 *
 * Maintains a reusable Web Worker instance to eliminate worker creation overhead
 * across media operations. Correlates asynchronous requests, supports cancellation,
 * manages execution timeouts, and provides automatic recovery and non-browser fallback.
 */

export interface MediaWorkerProgress {
  chunkIndex: number;
  totalChunks: number;
  totalDecryptedSoFar: number;
}

interface PendingRequest {
  resolve: (result: any) => void;
  reject: (error: Error) => void;
  onProgress?: (progress: MediaWorkerProgress) => void;
  timeoutId: any;
}

export class MediaWorkerPool {
  private static instance: MediaWorkerPool | null = null;
  private worker: Worker | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private requestCounter = 0;

  private constructor() {}

  public static getInstance(): MediaWorkerPool {
    if (!MediaWorkerPool.instance) {
      MediaWorkerPool.instance = new MediaWorkerPool();
    }
    return MediaWorkerPool.instance;
  }

  /**
   * Checks whether Web Workers are supported in the current environment.
   */
  public isWorkerSupported(): boolean {
    return typeof Worker !== 'undefined';
  }

  /**
   * Lazily initializes and returns the shared Web Worker instance.
   */
  private getWorker(): Worker | null {
    if (!this.isWorkerSupported()) {
      return null;
    }

    if (!this.worker) {
      try {
        this.worker = new Worker(
          new URL('./mediaWorker.ts', import.meta.url),
          { type: 'module' }
        );

        this.worker.onmessage = (event: MessageEvent) => {
          const { type, requestId, result, error, progress } = event.data;
          if (!requestId) return;

          const pending = this.pendingRequests.get(requestId);
          if (!pending) return;

          if (type === 'PROGRESS') {
            if (pending.onProgress && progress) {
              try {
                pending.onProgress(progress);
              } catch (_e) {}
            }
          } else if (type === 'SUCCESS') {
            clearTimeout(pending.timeoutId);
            this.pendingRequests.delete(requestId);
            pending.resolve(result);
          } else if (type === 'ERROR') {
            clearTimeout(pending.timeoutId);
            this.pendingRequests.delete(requestId);
            pending.reject(new Error(error || 'Media worker operation failed'));
          }
        };

        this.worker.onerror = (err: ErrorEvent) => {
          const errMsg = err?.message || 'Media worker runtime error';
          // Reject all pending requests
          for (const [reqId, pending] of this.pendingRequests.entries()) {
            clearTimeout(pending.timeoutId);
            pending.reject(new Error(errMsg));
          }
          this.pendingRequests.clear();
          this.terminate();
        };
      } catch (_initErr) {
        this.worker = null;
        return null;
      }
    }

    return this.worker;
  }

  /**
   * Dispatches a CPU-heavy task to the reusable media worker.
   */
  public execute<T>(
    type: string,
    payload: any,
    transferList: Transferable[] = [],
    onProgress?: (progress: MediaWorkerProgress) => void,
    timeoutMs = 60000
  ): { requestId: string; promise: Promise<T> } {
    const worker = this.getWorker();
    if (!worker) {
      throw new Error('Web Workers are not supported or failed to initialize');
    }

    const requestId = `mreq_${Date.now()}_${++this.requestCounter}_${Math.random().toString(36).slice(2, 8)}`;

    const promise = new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          try {
            worker.postMessage({ type: 'CANCEL', requestId });
          } catch (_e) {}
          reject(new Error(`Media operation timed out after ${Math.round(timeoutMs / 1000)}s`));
        }
      }, timeoutMs);

      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        onProgress,
        timeoutId,
      });

      try {
        worker.postMessage(
          {
            type,
            requestId,
            payload,
          },
          transferList
        );
      } catch (postErr) {
        clearTimeout(timeoutId);
        this.pendingRequests.delete(requestId);
        reject(postErr instanceof Error ? postErr : new Error(String(postErr)));
      }
    });

    return { requestId, promise };
  }

  /**
   * Cancels an in-flight operation by requestId.
   */
  public cancel(requestId: string): boolean {
    const pending = this.pendingRequests.get(requestId);
    if (!pending) return false;

    clearTimeout(pending.timeoutId);
    this.pendingRequests.delete(requestId);
    pending.reject(new Error('Operation cancelled'));

    if (this.worker) {
      try {
        this.worker.postMessage({ type: 'CANCEL', requestId });
      } catch (_e) {}
    }

    return true;
  }

  /**
   * Terminates the current worker and cleans up resources.
   */
  public terminate(): void {
    if (this.worker) {
      try {
        this.worker.terminate();
      } catch (_e) {}
      this.worker = null;
    }
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timeoutId);
      pending.reject(new Error('Media worker terminated'));
    }
    this.pendingRequests.clear();
  }

  public get pendingCount(): number {
    return this.pendingRequests.size;
  }
}
