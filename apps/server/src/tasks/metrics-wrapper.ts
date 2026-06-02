// apps/server/src/tasks/metrics-wrapper.ts
// ---------------------------------------------------------------------------
// BullMQ 任务 metrics 包装辅助:
//   1. recordQueueJob: 在 try/catch 中调用,记录 queue_jobs_total + queue_job_duration_seconds
//   2. wrapProcessor: 高阶函数,自动测量 + 捕获错误 (适合简单 processor)
// ---------------------------------------------------------------------------
import { queueJobsTotal, queueJobDuration } from '../common/observability/metrics';

export type JobStatus = 'completed' | 'failed' | 'retry';

export function recordQueueJob(queueName: string, status: JobStatus, startNs: bigint) {
  const seconds = Number(process.hrtime.bigint() - startNs) / 1e9;
  queueJobsTotal.inc({ queue: queueName, status });
  queueJobDuration.observe({ queue: queueName, status }, seconds);
}

export function wrapProcessor<T>(queueName: string, processor: (job: any) => Promise<T>) {
  return async (job: any): Promise<T> => {
    const start = process.hrtime.bigint();
    try {
      const result = await processor(job);
      recordQueueJob(queueName, 'completed', start);
      return result;
    } catch (err) {
      recordQueueJob(queueName, 'failed', start);
      throw err;
    }
  };
}
