// apps/server/src/common/observability/otel.ts
// ---------------------------------------------------------------------------
// OpenTelemetry SDK 初始化
// - 启动 NodeSDK: Prometheus 指标导出 + 自动 instrumentations
// - 幂等:重复调用不抛
// - 必须在 main.ts 顶部、所有业务 import 完成之前调用
// ---------------------------------------------------------------------------
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { Resource } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

let started = false;
let sdk: NodeSDK | undefined;

export function startOtel() {
  if (started) return sdk;
  const promPort = Number(process.env['OTEL_PROM_PORT'] || 9464);
  sdk = new NodeSDK({
    resource: new Resource({
      [SEMRESATTRS_SERVICE_NAME]: 'wxgzh-api',
      [SEMRESATTRS_SERVICE_VERSION]: process.env['APP_VERSION'] || 'dev',
      'deployment.environment': process.env['NODE_ENV'] || 'development',
    }),
    metricReader: new PrometheusExporter({ port: promPort }),
    instrumentations: [
      getNodeAutoInstrumentations({
        // 关掉 fs instrumentation — 噪音太大
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });
  sdk.start();
  started = true;
  return sdk;
}

export function isOtelStarted(): boolean {
  return started;
}

// 测试用 — 重置幂等标记 (单元测试之间隔离)
export function _resetOtelForTest() {
  started = false;
  sdk = undefined;
}
