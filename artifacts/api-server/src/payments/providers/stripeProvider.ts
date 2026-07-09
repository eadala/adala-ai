import type {
  CreateCheckoutSessionInput,
  CheckoutSessionResult,
  PaymentProvider,
  PaymentVerification,
  RefundPaymentInput,
  RefundPaymentResult,
  WebhookHandleInput,
  WebhookHandleResult,
  PaymentStatusResult,
  PaymentStatusValue,
} from "../types";

/** Stripe is optional — enabled only when explicitly turned on and configured */
export function isStripeProviderEnabled(): boolean {
  return (
    process.env.STRIPE_ENABLED === "true" &&
    !!process.env.STRIPE_SECRET_KEY?.trim() &&
    !!process.env.STRIPE_WEBHOOK_SECRET?.trim()
  );
}

function stripeDisabledError(): Error {
  return new Error(
    "Stripe معطّل — فعّل STRIPE_ENABLED=true وعيّن STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET"
  );
}

function mapStripeStatus(raw?: string): PaymentStatusValue {
  switch ((raw ?? "").toLowerCase()) {
    case "succeeded":
      return "completed";
    case "processing":
    case "requires_action":
    case "requires_confirmation":
      return "processing";
    case "canceled":
      return "cancelled";
    case "failed":
      return "failed";
    default:
      return "pending";
  }
}

export class StripeProvider implements PaymentProvider {
  readonly id = "stripe" as const;

  get enabled(): boolean {
    return isStripeProviderEnabled();
  }

  private async client() {
    if (!this.enabled) throw stripeDisabledError();
    const { getUncachableStripeClient } = await import("../../stripeClient");
    return getUncachableStripeClient();
  }

  async createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CheckoutSessionResult> {
    const stripe = await this.client();
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(input.amount * 100),
      currency: (input.currency ?? "sar").toLowerCase(),
      description: input.description,
      metadata: {
        tenant_id: input.tenantId,
        invoice_id: input.invoiceId ?? "",
        subscription_id: input.subscriptionId ?? "",
        customer_id: input.customerId ?? "",
        ...input.metadata,
      },
      automatic_payment_methods: { enabled: true },
    });

    return {
      provider: "stripe",
      sessionId: intent.id,
      clientSecret: intent.client_secret ?? undefined,
      status: mapStripeStatus(intent.status),
      transactionReference: intent.id,
      gatewayPaymentId: intent.id,
      amount: input.amount,
    };
  }

  async verifyPayment(
    transactionReference: string,
    gatewayPaymentId?: string
  ): Promise<PaymentVerification> {
    const status = await this.getPaymentStatus(transactionReference, gatewayPaymentId);
    return {
      provider: "stripe",
      transactionReference,
      gatewayPaymentId: status.gatewayPaymentId,
      status: status.status,
      amount: status.amount,
      currency: status.currency,
      raw: status.raw,
    };
  }

  async getPaymentStatus(
    transactionReference: string,
    gatewayPaymentId?: string
  ): Promise<PaymentStatusResult> {
    const stripe = await this.client();
    const id = gatewayPaymentId ?? transactionReference;
    const intent = await stripe.paymentIntents.retrieve(id);
    return {
      provider: "stripe",
      transactionReference,
      gatewayPaymentId: intent.id,
      status: mapStripeStatus(intent.status),
      amount: intent.amount / 100,
      currency: intent.currency.toUpperCase(),
      raw: intent,
    };
  }

  async handleWebhook(_input: WebhookHandleInput): Promise<WebhookHandleResult> {
    return {
      ok: false,
      error: "Stripe webhooks are handled by /api/stripe/webhook (legacy path)",
      skipped: true,
    };
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult> {
    const stripe = await this.client();
    const paymentId = input.gatewayPaymentId ?? input.transactionReference;
    const params: { payment_intent: string; amount?: number } = { payment_intent: paymentId };
    if (input.amount) params.amount = Math.round(input.amount * 100);
    const refund = await stripe.refunds.create(params);
    return {
      success: refund.status === "succeeded",
      refundId: refund.id,
      status: refund.status === "succeeded" ? "refunded" : "failed",
      raw: refund,
    };
  }
}

export const stripeProvider = new StripeProvider();
