export type AIAgentType =
  | "legal"
  | "finance"
  | "hr"
  | "security"
  | "analytics"
  | "growth"
  | "operations"
  | "developer";

export interface AIRequest {
  officeId: string;
  userId: string;
  role: string;
  message: string;
  agentType?: AIAgentType;
  sessionId?: string;
  history?: { role: string; content: string }[];
  model?: "auto" | "gemini" | "claude" | "openai";
}

export interface AIResponse {
  agent: AIAgentType;
  output: string;
  sessionId: string;
  modelUsed?: string;
  requiresApproval: boolean;
  context?: OfficeContext;
}

export interface OfficeContext {
  officeId: string;
  activeCases: number;
  openClients: number;
  unpaidInvoices: number;
  unpaidAmount: number;
  pendingTasks: number;
  employees: number;
  monthRevenue: number;
  criticalCases: number;
  upcomingSessions: number;
}

export interface AutonomousReport {
  id: string;
  officeId: string;
  reportType: "daily" | "weekly" | "alert" | "health";
  title: string;
  summary: string;
  recommendations: string[];
  priority: "low" | "medium" | "high" | "critical";
  generatedAt: Date;
}

export interface SelfHealingProposal {
  id: string;
  category: "performance" | "security" | "data" | "ux" | "business";
  title: string;
  description: string;
  impact: string;
  autoFixable: boolean;
  fixPayload?: string;
}
