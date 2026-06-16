import { randomUUID as uuid } from "crypto";
import { TenantContext } from "./tenant-context";
import { IsolatedMemory } from "./memory/isolated-memory";
import { aiRouter, detectAgentIntent } from "./router";
import type { AIAgentType, AIRequest, AIResponse } from "./types";
import { buildOfficeContext } from "./context-builder";

export async function aiOrchestrator(
  request: AIRequest & { isSuperAdmin?: boolean }
): Promise<AIResponse> {
  const { officeId, userId, message, history = [], model = "auto" } = request;

  if (!officeId) throw new Error("MISSING_TENANT");
  if (!message?.trim()) throw new Error("EMPTY_MESSAGE");

  const sessionId = request.sessionId ?? uuid();

  const agentType: AIAgentType =
    request.agentType ?? detectAgentIntent(message);

  const tenant = new TenantContext(officeId, userId, request.role);

  const memHistory = IsolatedMemory.get(officeId, sessionId);
  const fullHistory = [
    ...memHistory.map(m => ({ role: m.role, content: m.content })),
    ...history.slice(-10),
  ];

  IsolatedMemory.add(officeId, sessionId, {
    role: "user", content: message, agent: agentType, ts: Date.now(),
  });

  const { output, modelUsed, diagnostics } = await aiRouter(
    agentType, officeId, message, fullHistory, model
  );

  IsolatedMemory.add(officeId, sessionId, {
    role: "assistant", content: output, agent: agentType, ts: Date.now(),
  });

  IsolatedMemory.persistSession(
    officeId, userId, agentType, sessionId,
    IsolatedMemory.get(officeId, sessionId)
  ).catch(() => {});

  const officeCtx = agentType !== "developer"
    ? await buildOfficeContext(officeId).catch(() => null)
    : null;

  return {
    agent: agentType,
    output,
    sessionId,
    modelUsed,
    requiresApproval: agentType === "developer",
    ...(officeCtx ? { context: officeCtx } : {}),
  };
}
