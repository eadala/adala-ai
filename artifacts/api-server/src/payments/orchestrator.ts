/**
 * Legacy entry point — delegates to the unified PaymentService.
 * All checkout, webhook, refund, and status flows must go through PaymentService.
 */
export {
  PaymentService,
  getDefaultPaymentProviderId,
  isStripeProviderEnabled,
} from "./paymentService";

export type {
  PaymentProvider,
  PaymentProviderId,
  CreateCheckoutSessionInput,
  CheckoutSessionResult,
  CreateCheckoutSessionResult,
  WebhookHandleInput,
  WebhookHandleResult,
  RefundPaymentInput,
  RefundPaymentResult,
  PaymentStatusResult,
  PaymentVerification,
} from "./types";
