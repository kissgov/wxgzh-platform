// apps/server/test/unit/tasks/metrics-wrapper.spec.ts
import {
  recordQueueJob,
  wrapProcessor,
} from '../../../src/tasks/metrics-wrapper';
import { metricsRegistry } from '../../../src/common/observability/metrics';

describe('BullMQ metrics wrapper', () => {
  it('recordQueueJob 增加 queue_jobs_total counter', async () => {
    recordQueueJob('test-queue', 'completed', process.hrtime.bigint());
    const text = await metricsRegistry.metrics();
    expect(text).toMatch(/queue_jobs_total\{[^}]*queue="test-queue"[^}]*status="completed"/);
  });

  it('recordQueueJob 记录 duration histogram', async () => {
    recordQueueJob('test-queue', 'completed', process.hrtime.bigint());
    const text = await metricsRegistry.metrics();
    expect(text).toMatch(/queue_job_duration_seconds_bucket/);
  });

  it('wrapProcessor 成功时 inc completed', async () => {
    const wrapped = wrapProcessor('wrap-test-1', async () => 'ok');
    const result = await wrapped({ id: 'j1' } as any);
    expect(result).toBe('ok');
    const text = await metricsRegistry.metrics();
    expect(text).toMatch(/queue_jobs_total\{[^}]*queue="wrap-test-1"[^}]*status="completed"/);
  });

  it('wrapProcessor 失败时 inc failed 并 rethrow', async () => {
    const wrapped = wrapProcessor('wrap-test-2', async () => {
      throw new Error('boom');
    });
    await expect(wrapped({ id: 'j2' } as any)).rejects.toThrow('boom');
    const text = await metricsRegistry.metrics();
    expect(text).toMatch(/queue_jobs_total\{[^}]*queue="wrap-test-2"[^}]*status="failed"/);
  });
});
