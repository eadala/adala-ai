/**
 * Prometheus query client.
 * All metric names match what adala-api exports (prometheus.ts).
 */

const PROM_URL = process.env.PROM_URL ?? "http://prometheus:9090";

async function queryInstant(promQL: string): Promise<number> {
  try {
    const url = `${PROM_URL}/api/v1/query?query=${encodeURIComponent(promQL)}`;
    const res  = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return 0;
    const json = await res.json() as any;
    const val  = json?.data?.result?.[0]?.value?.[1];
    return val ? parseFloat(val) : 0;
  } catch {
    return 0;
  }
}

export interface SystemMetrics {
  cpuPercent:    number;
  memPercent:    number;
  p95LatencyMs:  number;
  errorRateRps:  number;
  dbHealth:      number;
  heapUsedMb:    number;
  aiPending:     number;
}

export async function getSystemMetrics(): Promise<SystemMetrics> {
  const [cpu, mem, p95, errors, dbHealth, heapUsed, heapTotal, aiPending] = await Promise.all([
    // CPU idle → usage %
    queryInstant("100 - (avg(rate(node_cpu_seconds_total{mode='idle'}[2m])) * 100)"),
    // Memory usage %
    queryInstant("(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100"),
    // p95 latency (ms)
    queryInstant("histogram_quantile(0.95, rate(adala_http_request_duration_ms_bucket[5m]))"),
    // 5xx error rate (req/s)
    queryInstant("rate(adala_http_errors_total[5m])"),
    // DB health gauge
    queryInstant("adala_db_health"),
    // Heap used bytes
    queryInstant("adala_node_nodejs_heap_size_used_bytes"),
    // Heap total bytes
    queryInstant("adala_node_nodejs_heap_size_total_bytes"),
    // AI pending tasks
    queryInstant("adala_ai_pending_tasks"),
  ]);

  return {
    cpuPercent:   cpu,
    memPercent:   mem,
    p95LatencyMs: p95,
    errorRateRps: errors,
    dbHealth:     dbHealth,
    heapUsedMb:   heapUsed / 1024 / 1024,
    aiPending:    aiPending,
  };
}
