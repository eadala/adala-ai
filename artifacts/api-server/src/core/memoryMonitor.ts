/**
 * Memory Monitor — مراقبة الذاكرة دورياً كل دقيقتين
 * يطبع RSS / HeapUsed / HeapTotal / External
 * ويُصدر تحذيراً عند تجاوز الحدود الآمنة
 */

const WARN_HEAP_MB  = 250;   // تحذير إذا تجاوز الـ heap هذا الحد
const WARN_RSS_MB   = 320;   // تحذير إذا تجاوز الـ RSS هذا الحد
const CHECK_INTERVAL_MS = 2 * 60 * 1000; // كل دقيقتين

let _started = false;

export function startMemoryMonitor(): void {
  if (_started) return;
  _started = true;

  function check() {
    const m = process.memoryUsage();
    const toMB = (bytes: number) => Math.round(bytes / 1024 / 1024);

    const rss      = toMB(m.rss);
    const heapUsed = toMB(m.heapUsed);
    const heapTotal= toMB(m.heapTotal);
    const external = toMB(m.external);

    const tag = heapUsed > WARN_HEAP_MB || rss > WARN_RSS_MB ? "⚠️ WARN" : "✅ OK";

    console.log(
      `[Memory] ${tag} | RSS=${rss}MB HeapUsed=${heapUsed}MB HeapTotal=${heapTotal}MB External=${external}MB`
    );

    if (heapUsed > WARN_HEAP_MB) {
      console.warn(`[Memory] ⚠️ HeapUsed ${heapUsed}MB تجاوز الحد الآمن ${WARN_HEAP_MB}MB — قد تكون هناك تسرب ذاكرة`);
    }
    if (rss > WARN_RSS_MB) {
      console.warn(`[Memory] ⚠️ RSS ${rss}MB تجاوز الحد الآمن ${WARN_RSS_MB}MB`);
    }
  }

  /* فحص فوري عند بدء التشغيل */
  check();

  /* فحص دوري كل دقيقتين */
  const timer = setInterval(check, CHECK_INTERVAL_MS);
  timer.unref(); /* لا يمنع Node.js من الإغلاق */

  console.log("[MemoryMonitor] ✅ Started — checking every 2 minutes");
}

/** snapshot فوري (للاستخدام من routes) */
export function getMemorySnapshot() {
  const m = process.memoryUsage();
  const toMB = (b: number) => Math.round(b / 1024 / 1024);
  return {
    rss:       toMB(m.rss),
    heapUsed:  toMB(m.heapUsed),
    heapTotal: toMB(m.heapTotal),
    external:  toMB(m.external),
    warnHeap:  WARN_HEAP_MB,
    warnRss:   WARN_RSS_MB,
    status:    toMB(m.heapUsed) > WARN_HEAP_MB || toMB(m.rss) > WARN_RSS_MB ? "warn" : "ok",
  };
}
