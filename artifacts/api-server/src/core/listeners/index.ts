/**
 * Register all event listeners — import once at server startup
 */
import { registerFinanceListeners }       from "./financeListener";
import { registerNotificationListeners }  from "./notificationListener";
import { registerAnalyticsListeners }     from "./analyticsListener";

export function registerAllListeners() {
  registerFinanceListeners();
  registerNotificationListeners();
  registerAnalyticsListeners();
  console.log("[EventBus] ✅ All listeners registered");
}
