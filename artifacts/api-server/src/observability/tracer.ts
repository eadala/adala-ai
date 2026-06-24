/**
 * OpenTelemetry Distributed Tracing — عدالة AI
 * ──────────────────────────────────────────────
 * يُفعَّل فقط عند وجود OTEL_EXPORTER_OTLP_ENDPOINT في البيئة.
 * يرسل traces إلى OTel Collector → Grafana Tempo.
 *
 * ⚠️  يجب أن يُستورد هذا الملف قبل أي import آخر في index.ts
 */

const OTEL_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
const SERVICE_NAME  = process.env.OTEL_SERVICE_NAME ?? "adala-api";

export async function initTracer(): Promise<void> {
  if (!OTEL_ENDPOINT) {
    return;
  }

  try {
    /* Dynamic imports → لا يُجبر esbuild على تضمين هذه الحزم */
    const { NodeSDK }                   = await import("@opentelemetry/sdk-node");
    const { Resource }                  = await import("@opentelemetry/resources") as any;
    const { SEMRESATTRS_SERVICE_NAME }  = await import("@opentelemetry/semantic-conventions");
    const { OTLPTraceExporter }         = await import("@opentelemetry/exporter-trace-otlp-http");
    const { BatchSpanProcessor }        = await import("@opentelemetry/sdk-trace-base");
    const { HttpInstrumentation }       = await import("@opentelemetry/instrumentation-http");
    const { ExpressInstrumentation }    = await import("@opentelemetry/instrumentation-express");
    const { PgInstrumentation }         = await import("@opentelemetry/instrumentation-pg");

    const exporter = new OTLPTraceExporter({
      url: `${OTEL_ENDPOINT}/v1/traces`,
      timeoutMillis: 5000,
    });

    const sdk = new NodeSDK({
      resource: new Resource({
        [SEMRESATTRS_SERVICE_NAME]: SERVICE_NAME,
        "deployment.environment": process.env.NODE_ENV ?? "production",
      }),
      spanProcessor: new BatchSpanProcessor(exporter, {
        maxQueueSize:  512,
        scheduledDelayMillis: 5000,
      }),
      instrumentations: [
        new HttpInstrumentation({
          ignoreIncomingRequestHook: (req) => {
            const url = req.url ?? "";
            /* لا نتتبع health checks أو metrics scraping */
            return url === "/api" || url === "/api/ping" || url === "/metrics";
          },
        }),
        new ExpressInstrumentation(),
        new PgInstrumentation({ enhancedDatabaseReporting: false }),
      ],
    });

    sdk.start();

    /* إيقاف آمن عند إغلاق العملية */
    process.on("SIGTERM", () => {
      sdk.shutdown().catch(() => {});
    });

    const { logger } = await import("../lib/logger");
    logger.info({ endpoint: OTEL_ENDPOINT, service: SERVICE_NAME },
      "[OTel] ✅ Distributed tracing active");

  } catch (err: any) {
    /* لا نوقف السيرفر إذا فشل OTel */
    console.warn("[OTel] ⚠️  Failed to initialise tracing:", err?.message);
  }
}
