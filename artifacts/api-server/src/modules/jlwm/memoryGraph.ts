/**
 * JLWM — Justice Memory Graph
 * Builds and queries a knowledge graph from the office's legal data.
 * Reads from: cases, clients, contracts, documents, hearings
 * Writes to:  jlwm_memory_nodes, jlwm_memory_edges
 */

import { Router }                  from "express";
import { db }                      from "@workspace/db";
import { sql }                     from "drizzle-orm";
import { requireAuthWithTenant }   from "../../middlewares/requireAuth";
import { auditLog, auditMeta }     from "../../lib/auditLogger";
import { callJLWMAI, extractJSON } from "./jlwmAI";

const router = Router();

/* ─────────────────────────────────────────────────────────────
   GET /jlwm/memory/graph — nodes + edges for visualisation
───────────────────────────────────────────────────────────── */
router.get("/jlwm/memory/graph", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const { type, limit = "200" } = req.query as { type?: string; limit?: string };

    let nodeQuery = sql`
      SELECT id, node_type, node_ref, label, properties, importance_score, is_auto, updated_at
      FROM   jlwm_memory_nodes
      WHERE  office_id = ${officeId}
    `;
    if (type) {
      nodeQuery = sql`
        SELECT id, node_type, node_ref, label, properties, importance_score, is_auto, updated_at
        FROM   jlwm_memory_nodes
        WHERE  office_id = ${officeId} AND node_type = ${type}
        LIMIT  ${parseInt(limit, 10)}
      `;
    } else {
      nodeQuery = sql`
        SELECT id, node_type, node_ref, label, properties, importance_score, is_auto, updated_at
        FROM   jlwm_memory_nodes
        WHERE  office_id = ${officeId}
        ORDER  BY importance_score DESC
        LIMIT  ${parseInt(limit, 10)}
      `;
    }

    const { rows: nodes } = await db.execute(nodeQuery);

    const nodeIds = (nodes as any[]).map(n => n.id);
    let edges: any[] = [];
    if (nodeIds.length > 0) {
      const { rows } = await db.execute(sql`
        SELECT id, from_node_id, to_node_id, edge_type, weight, evidence
        FROM   jlwm_memory_edges
        WHERE  office_id = ${officeId}
          AND  from_node_id = ANY(${nodeIds}::text[])
          AND  to_node_id   = ANY(${nodeIds}::text[])
      `);
      edges = rows as any[];
    }

    const { rows: statsRows } = await db.execute(sql`
      SELECT node_type, COUNT(*) AS count
      FROM   jlwm_memory_nodes WHERE office_id = ${officeId}
      GROUP  BY node_type
    `);

    res.json({ nodes, edges, stats: statsRows });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ─────────────────────────────────────────────────────────────
   GET /jlwm/memory/stats
───────────────────────────────────────────────────────────── */
router.get("/jlwm/memory/stats", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const { rows: byType } = await db.execute(sql`
      SELECT node_type, COUNT(*) AS count, AVG(importance_score)::float AS avg_importance
      FROM   jlwm_memory_nodes WHERE office_id = ${officeId}
      GROUP  BY node_type ORDER BY count DESC
    `);
    const { rows: edgeStats } = await db.execute(sql`
      SELECT edge_type, COUNT(*) AS count, AVG(weight)::float AS avg_weight
      FROM   jlwm_memory_edges WHERE office_id = ${officeId}
      GROUP  BY edge_type ORDER BY count DESC
    `);
    const { rows: totals } = await db.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM jlwm_memory_nodes WHERE office_id = ${officeId}) AS total_nodes,
        (SELECT COUNT(*) FROM jlwm_memory_edges WHERE office_id = ${officeId}) AS total_edges
    `);
    res.json({ byType, edgeStats, totals: totals[0] });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ─────────────────────────────────────────────────────────────
   GET /jlwm/memory/search
───────────────────────────────────────────────────────────── */
router.get("/jlwm/memory/search", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const { q }    = req.query as { q?: string };
    if (!q?.trim()) return res.status(400).json({ error: "q مطلوب" });

    const { rows } = await db.execute(sql`
      SELECT id, node_type, node_ref, label, properties, importance_score
      FROM   jlwm_memory_nodes
      WHERE  office_id = ${officeId}
        AND  (label ILIKE ${"%" + q + "%"} OR properties::text ILIKE ${"%" + q + "%"})
      ORDER  BY importance_score DESC
      LIMIT  30
    `);
    res.json({ results: rows, query: q, total: rows.length });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ─────────────────────────────────────────────────────────────
   POST /jlwm/memory/rebuild — sync from existing DB data
───────────────────────────────────────────────────────────── */
router.post("/jlwm/memory/rebuild", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const userId   = (req as any).auth?.userId ?? "system";

    /* Log the action */
    const { rows: actionRows } = await db.execute(sql`
      INSERT INTO jlwm_command_actions (office_id, user_id, action_type, status)
      VALUES (${officeId}, ${userId}, 'rebuild_graph', 'running')
      RETURNING id
    `);
    const actionId = (actionRows[0] as any)?.id;

    let nodesCreated = 0;
    let edgesCreated = 0;

    /* ── Pull cases ─────────────────────────────────────────── */
    const { rows: cases } = await db.execute(sql`
      SELECT id, title, status, case_type, court_name, lawyer_name
      FROM   cases WHERE office_id = ${officeId} LIMIT 500
    `).catch(() => ({ rows: [] as any[] }));

    for (const c of cases as any[]) {
      const { rows } = await db.execute(sql`
        INSERT INTO jlwm_memory_nodes (office_id, node_type, node_ref, label, properties, importance_score)
        VALUES (${officeId}, 'case', ${String(c.id)},
                ${c.title ?? "قضية"},
                ${JSON.stringify({ status: c.status, type: c.case_type, court: c.court_name })}::jsonb,
                ${c.status === "active" ? 0.9 : 0.6})
        ON CONFLICT (office_id, node_type, node_ref)
        DO UPDATE SET label=EXCLUDED.label, properties=EXCLUDED.properties, updated_at=NOW()
        RETURNING id
      `).catch(() => ({ rows: [] as any[] }));
      if ((rows[0] as any)?.id) nodesCreated++;

      /* Add lawyer node if present */
      if (c.lawyer_name) {
        await db.execute(sql`
          INSERT INTO jlwm_memory_nodes (office_id, node_type, node_ref, label, importance_score)
          VALUES (${officeId}, 'lawyer', ${"lyr_" + c.lawyer_name.replace(/\s/g, "_")}, ${c.lawyer_name}, 0.7)
          ON CONFLICT (office_id, node_type, node_ref) DO NOTHING
        `).catch(() => {});
      }

      /* Add court node if present */
      if (c.court_name) {
        await db.execute(sql`
          INSERT INTO jlwm_memory_nodes (office_id, node_type, node_ref, label, importance_score)
          VALUES (${officeId}, 'court', ${"crt_" + c.court_name.replace(/\s/g, "_")}, ${c.court_name}, 0.6)
          ON CONFLICT (office_id, node_type, node_ref) DO NOTHING
        `).catch(() => {});
      }
    }

    /* ── Pull clients ───────────────────────────────────────── */
    const { rows: clients } = await db.execute(sql`
      SELECT id, name, phone, city
      FROM   clients WHERE office_id = ${officeId} LIMIT 300
    `).catch(() => ({ rows: [] as any[] }));

    for (const cl of clients as any[]) {
      await db.execute(sql`
        INSERT INTO jlwm_memory_nodes (office_id, node_type, node_ref, label, properties, importance_score)
        VALUES (${officeId}, 'client', ${String(cl.id)},
                ${cl.name ?? "عميل"},
                ${JSON.stringify({ city: cl.city })}::jsonb, 0.8)
        ON CONFLICT (office_id, node_type, node_ref)
        DO UPDATE SET label=EXCLUDED.label, properties=EXCLUDED.properties, updated_at=NOW()
        RETURNING id
      `).then(r => { if ((r.rows[0] as any)?.id) nodesCreated++; }).catch(() => {});
    }

    /* ── Link cases → clients via case_clients join ─────────── */
    const { rows: caseClients } = await db.execute(sql`
      SELECT c.id AS case_id, c.client_id
      FROM   cases c
      WHERE  c.office_id = ${officeId} AND c.client_id IS NOT NULL LIMIT 500
    `).catch(() => ({ rows: [] as any[] }));

    for (const cc of caseClients as any[]) {
      const { rows: fromNode } = await db.execute(sql`
        SELECT id FROM jlwm_memory_nodes
        WHERE  office_id=${officeId} AND node_type='case' AND node_ref=${String(cc.case_id)} LIMIT 1
      `).catch(() => ({ rows: [] as any[] }));
      const { rows: toNode } = await db.execute(sql`
        SELECT id FROM jlwm_memory_nodes
        WHERE  office_id=${officeId} AND node_type='client' AND node_ref=${String(cc.client_id)} LIMIT 1
      `).catch(() => ({ rows: [] as any[] }));
      if ((fromNode[0] as any)?.id && (toNode[0] as any)?.id) {
        await db.execute(sql`
          INSERT INTO jlwm_memory_edges (office_id, from_node_id, to_node_id, edge_type, weight)
          VALUES (${officeId}, ${(fromNode[0] as any).id}, ${(toNode[0] as any).id}, 'represents', 1.0)
          ON CONFLICT DO NOTHING
        `).then(() => edgesCreated++).catch(() => {});
      }
    }

    /* ── Pull contracts ─────────────────────────────────────── */
    const { rows: contracts } = await db.execute(sql`
      SELECT id, title, status FROM contracts WHERE office_id=${officeId} LIMIT 200
    `).catch(() => ({ rows: [] as any[] }));

    for (const cn of contracts as any[]) {
      await db.execute(sql`
        INSERT INTO jlwm_memory_nodes (office_id, node_type, node_ref, label, properties, importance_score)
        VALUES (${officeId}, 'contract', ${String(cn.id)},
                ${cn.title ?? "عقد"},
                ${JSON.stringify({ status: cn.status })}::jsonb, 0.65)
        ON CONFLICT (office_id, node_type, node_ref) DO UPDATE SET updated_at=NOW()
      `).catch(() => {});
      nodesCreated++;
    }

    /* Update action status */
    await db.execute(sql`
      UPDATE jlwm_command_actions
      SET status='done', finished_at=NOW(),
          result=${JSON.stringify({ nodesCreated, edgesCreated })}::jsonb
      WHERE id=${actionId}
    `).catch(() => {});

    auditLog({
      ...auditMeta(req), action: "jlwm_memory_rebuild",
      resource: "jlwm", resourceId: officeId,
      details: `nodes:${nodesCreated} edges:${edgesCreated}`,
    }).catch(() => {});

    res.json({ ok: true, nodesCreated, edgesCreated, actionId });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ─────────────────────────────────────────────────────────────
   POST /jlwm/memory/analyze — AI pattern analysis of the graph
───────────────────────────────────────────────────────────── */
router.post("/jlwm/memory/analyze", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const userId   = (req as any).auth?.userId ?? "system";

    const { rows: nodes } = await db.execute(sql`
      SELECT node_type, label, importance_score FROM jlwm_memory_nodes
      WHERE  office_id=${officeId} ORDER BY importance_score DESC LIMIT 50
    `);
    const { rows: edges } = await db.execute(sql`
      SELECT e.edge_type, fn.label AS from_label, tn.label AS to_label, e.weight
      FROM   jlwm_memory_edges e
      JOIN   jlwm_memory_nodes fn ON fn.id = e.from_node_id
      JOIN   jlwm_memory_nodes tn ON tn.id = e.to_node_id
      WHERE  e.office_id=${officeId} LIMIT 100
    `);

    const { reply } = await callJLWMAI({
      task: "memoryAnalysis",
      message: "حلل مخطط المعرفة وأعطني أبرز الرؤى",
      officeId, userId,
      context: { nodes, edges, nodeCount: nodes.length, edgeCount: edges.length },
    });

    res.json({ analysis: reply, nodeCount: nodes.length, edgeCount: edges.length });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ─────────────────────────────────────────────────────────────
   POST /jlwm/memory/nodes — add manual node
───────────────────────────────────────────────────────────── */
router.post("/jlwm/memory/nodes", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const { nodeType, label, properties, importanceScore } = req.body ?? {};
    if (!nodeType || !label) return res.status(400).json({ error: "nodeType و label مطلوبان" });

    const { rows } = await db.execute(sql`
      INSERT INTO jlwm_memory_nodes (office_id, node_type, label, properties, importance_score, is_auto)
      VALUES (${officeId}, ${nodeType}, ${label},
              ${JSON.stringify(properties ?? {})}::jsonb,
              ${importanceScore ?? 0.5}, FALSE)
      RETURNING id, node_type, label
    `);
    res.status(201).json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ─────────────────────────────────────────────────────────────
   POST /jlwm/memory/edges — add manual edge
───────────────────────────────────────────────────────────── */
router.post("/jlwm/memory/edges", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const { fromNodeId, toNodeId, edgeType, weight } = req.body ?? {};
    if (!fromNodeId || !toNodeId || !edgeType)
      return res.status(400).json({ error: "fromNodeId، toNodeId، edgeType مطلوبة" });

    /* Verify both nodes belong to this office */
    const { rows: check } = await db.execute(sql`
      SELECT COUNT(*) AS c FROM jlwm_memory_nodes
      WHERE  id IN (${fromNodeId}, ${toNodeId}) AND office_id=${officeId}
    `);
    if (Number((check[0] as any)?.c) < 2)
      return res.status(403).json({ error: "عقدة غير موجودة أو لا تنتمي للمكتب" });

    const { rows } = await db.execute(sql`
      INSERT INTO jlwm_memory_edges (office_id, from_node_id, to_node_id, edge_type, weight)
      VALUES (${officeId}, ${fromNodeId}, ${toNodeId}, ${edgeType}, ${weight ?? 0.5})
      RETURNING id, edge_type, weight
    `);
    res.status(201).json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ─────────────────────────────────────────────────────────────
   DELETE /jlwm/memory/nodes/:id
───────────────────────────────────────────────────────────── */
router.delete("/jlwm/memory/nodes/:id", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const { id }   = req.params as { id: string };
    await db.execute(sql`
      DELETE FROM jlwm_memory_nodes WHERE id=${id} AND office_id=${officeId}
    `);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
