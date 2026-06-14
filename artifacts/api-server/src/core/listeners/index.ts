/**
 * Register all event listeners — import once at server startup
 */
import { registerFinanceListeners }       from "./financeListener";
import { registerNotificationListeners }  from "./notificationListener";
import { registerAnalyticsListeners }     from "./analyticsListener";
import { registerAutopilotListeners }     from "./autopilotListener";

export function registerAllListeners() {
  registerFinanceListeners();
  registerNotificationListeners();
  registerAnalyticsListeners();
  registerAutopilotListeners();
  console.log("[EventBus] ✅ All listeners registered");
}
