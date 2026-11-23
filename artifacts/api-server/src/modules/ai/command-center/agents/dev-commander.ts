import { callAI } from "../../aiChat";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import * as os from "os";

function rows(r: any) { return Array.isArray(r) ? r : (r?.rows ?? []); }
function first(r: any) { const a = rows(r); return a[0] ?? null; }

async function gatherPlatformDiagnostics() {
  const totalMem = os.totalmem();
  const freeMem  = os.freemem();
  const memPct   = Math.round(((totalMem - freeMem) / totalMem) * 100);

  const [tables, platform, connections, events] = await Promise.all([
    db.execute(sql`
      SELECT
        schemaname, tablename AS name,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
        (xpath('/row/c/text()',
          query_to_xml('SELECT COUNT(*) AS c FROM '||schemaname||'.'||tablename,false,true,''))
        )[1]::text::int AS rows
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
      LIMIT 12`),
    db.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM offices)::int               AS offices,
        (SELECT COUNT(*) FROM office_members)::int        AS users,
        (SELECT COUNT(*) FROM cases)::int                 AS cases,
        (SELECT COUNT(*) FROM client_invoices WHERE status='unpaid')::int AS unpaid_invoices`),
    db.execute(sql`SELECT COUNT(*)::int AS active FROM pg_stat_activity WHERE state = 'active'`),
    db.execute(sql`
      SELECT event_type, COUNT(*)::int AS count
      FROM system_events
      WHERE created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY event_type ORDER BY count DESC LIMIT 5`),
  ]);

  const p = first(platform) ?? {};
  return {
    system: { memUsedPct: memPct, cpuLoad: os.loadavg()[0].toFixed(2), uptimeMins: Math.round(process.uptime() / 60) },
    platform: { offices: p.offices ?? 0, users: p.users ?? 0, cases: p.cases ?? 0, unpaidInvoices: p.unpaid_invoices ?? 0 },
    database: {
      activeConnections: Number(first(connections)?.active ?? 0),
      tables: rows(tables).map((t: any) => ({ name: t.name, size: t.size, rows: t.rows })),
    },
    recentEvents: rows(events),
  };
}

export async function devCommanderAgent(
  message: string,
  history: { role: string; content: string }[] = [],
  model: any = "auto"
): Promise<{ output: string; modelUsed?: string; diagnostics?: any }> {
  const diagnostics = await gatherPlatformDiagnostics();

  const tableLines = diagnostics.database.tables
    .slice(0, 8)
    .map((t: any) => `${t.name}: ${t.size} (${(t.rows ?? 0).toLocaleString()} صف)`)
    .join("\n");

  const eventLines = diagnostics.recentEvents
    .map((e: any) => `${e.event_type}: ${e.count}x`)
    .join(" | ") || "لا أحداث";

  const system = `أنت قائد التطوير ومهندس المنصة الأول لعدالة AI. لديك صلاحيات كاملة وسياق المنصة الحي:

🖥️ النظام:
- الذاكرة: ${diagnostics.system.memUsedPct}% مستخدمة
- CPU Load: ${diagnostics.system.cpuLoad}
- وقت التشغيل: ${diagnostics.system.uptimeMins} دقيقة

🏢 المنصة:
- مكاتب: ${diagnostics.platform.offices} | مستخدمون: ${diagnostics.platform.users}
- قضايا: ${diagnostics.platform.cases} | فواتير غير محصّلة: ${diagnostics.platform.unpaidInvoices}

🗄️ قاعدة البيانات (${diagnostics.database.activeConnections} اتصال نشط):
${tableLines}

📡 الأحداث (24 ساعة): ${eventLines}

قدّم تشخيصاً تقنياً دقيقاً وتوصيات للتحسين. إذا اكتشفت مشكلة قابلة للإصلاح تلقائياً، أضفها بصيغة: [PROPOSAL: العنوان | الوصف | التصنيف | SQL_SAFE/MANUAL]. أجب بالعربية.`;

  const { reply, modelUsed } = await callAI(system, message, history, model);
  return { output: reply, modelUsed, diagnostics };
}
