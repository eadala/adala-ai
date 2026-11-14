# F-TENANT-AI-AGENT-UNSCOPED-001

**Initial severity:** HIGH  
**Remediation:** logs/workflows require tenant; INSERT/SELECT/UPDATE/DELETE filter `office_id`; logAction fail-closed without office  
**Code:** `modules/ai/ai-agent.ts`, `aiWorkflowBuilder.ts` sibling paths  
**Original exploit reproduced:** YES  
**Post-fix exploit denied:** YES (static)  
**Prompt-injection E2E:** NOT_TESTED  
**Closure:** **CLOSED** for unscoped list/create; AI prompt suite residual  
