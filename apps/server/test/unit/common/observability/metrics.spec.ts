// apps/server/test/unit/common/observability/metrics.spec.ts
import {
  metricsRegistry,
  httpRequestsTotal,
  wechatApiCallsTotal,
  queueJobsTotal,
  businessEventsTotal,
} from '../../../../src/common/observability/metrics';

describe('Metrics (Prometheus)', () => {
  it('registry 含默认 Node 指标', async () => {
    const text = await metricsRegistry.metrics();
    expect(text).toMatch(/^# HELP/m);
  });

  it('httpRequestsTotal counter 可递增并出现在输出', async () => {
    httpRequestsTotal.inc({ method: 'GET', route: '/x', status: '200' });
    const text = await metricsRegistry.metrics();
    expect(text).toMatch(/http_requests_total/);
  });

  it('wechatApiCallsTotal counter 可递增', async () => {
    wechatApiCallsTotal.inc({ endpoint: '/cgi-bin/token', result: 'ok' });
    const text = await metricsRegistry.metrics();
    expect(text).toMatch(/wechat_api_calls_total/);
  });

  it('queueJobsTotal counter 可递增', async () => {
    queueJobsTotal.inc({ queue: 'token-refresh', status: 'completed' });
    const text = await metricsRegistry.metrics();
    expect(text).toMatch(/queue_jobs_total/);
  });

  it('businessEventsTotal counter 可递增 (含 tenant_id label)', async () => {
    businessEventsTotal.inc({ event: 'follower_added', tenant_id: 't1' });
    const text = await metricsRegistry.metrics();
    expect(text).toMatch(/business_events_total/);
  });
});
