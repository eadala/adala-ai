import type { PaymentProvider, PaymentProviderId } from "./types";
import { moyasarProvider } from "./providers/moyasarProvider";
import { stripeProvider, isStripeProviderEnabled } from "./providers/stripeProvider";
import {
  createPaymentTransaction,
  updatePaymentByGatewayId,
  updatePaymentByReference,
  generateTransactionReference,
  findByTransactionReference,
  markLinkedInvoicePaid,
} from "./paymentRepository";
import type {
  CreateCheckoutSessionInput,
  CheckoutSessionResult,
  ProviderInfo,
  RefundPaymentInput,
  RefundPaymentResult,
  WebhookHandleInput,
  WebhookHandleResult,
  PaymentStatusResult,
  PaymentVerification,
} from "./types";

export { isStripeProviderEnabled };

function primaryProviderId(): PaymentProviderId {
  const raw = (process.env.PAYMENT_PROVIDER ?? "moyasar").toLowerCase();
  if (raw === "stripe" || raw === "hyperpay" || raw === "paytabs" || raw === "checkout") {
    return raw as PaymentProviderId;
  }
  return "moyasar";
}

export function getDefaultPaymentProviderId(): PaymentProviderId {
  return PaymentService.getPrimaryProviderId();
}

class PaymentServiceImpl {
  private providers: Record<PaymentProviderId, PaymentProvider | undefined> = {
    moyasar: moyasarProvider,
    stripe: stripeProvider,
    hyperpay: undefined,
    paytabs: undefined,
    checkout: undefined,
  };

  getPrimaryProviderId(): PaymentProviderId {
    const preferred = primaryProviderId();
    const provider = this.providers[preferred];
    if (provider?.enabled) return preferred;
    if (moyasarProvider.enabled) return "moyasar";
    if (stripeProvider.enabled) return "stripe";
    return preferred;
  }

  resolveProvider(id?: PaymentProviderId): PaymentProvider {
    const providerId = id ?? this.getPrimaryProviderId();
    const provider = this.providers[providerId];
    if (!provider) {
      throw new Error(`بوابة الدفع "${providerId}" غير مدعومة بعد — قيد التطوير`);
    }
    if (!provider.enabled) {
      throw new Error(`بوابة الدفع "${providerId}" غير مفعّلة — راجع متغيرات البيئة`);
    }
    return provider;
  }

  listProviders(): ProviderInfo[] {
    const primary = this.getPrimaryProviderId();
    return [
      {
        id: "moyasar",
        name: "Moyasar (مدى · Apple Pay · STC Pay · Visa/Mastercard)",
        region: "KSA / MENA",
        enabled: moyasarProvider.enabled,
        primary: primary === "moyasar",
      },
      {
        id: "stripe",
        name: "Stripe (اختياري)",
        region: "Global",
        enabled: stripeProvider.enabled,
        primary: primary === "stripe",
      },
      {
        id: "hyperpay",
        name: "HyperPay",
        region: "KSA / MENA",
        enabled: false,
        primary: false,
      },
      {
        id: "paytabs",
        name: "PayTabs",
        region: "MENA",
        enabled: false,
        primary: false,
      },
    ];
  }

  async createCheckoutSession(
    input: CreateCheckoutSessionInput
  ): Promise<CheckoutSessionResult> {
    const provider = this.resolveProvider(input.provider);
    const commission = input.commissionPercent ?? 10;
    const platformFee =
      input.platformFee ?? parseFloat((input.amount * commission / 100).toFixed(2));
    const netAmount = input.netAmount ?? parseFloat((input.amount - platformFee).toFixed(2));

    const session = await provider.createCheckoutSession(input);
    const txRef = session.transactionReference || generateTransactionReference();
    const record = await createPaymentTransaction({
      ...input,
      platformFee,
      netAmount,
      provider: provider.id,
      transactionReference: txRef,
      status: session.status,
      gatewayPaymentId: session.gatewayPaymentId ?? txRef,
    });

    return {
      ...session,
      transactionReference: txRef,
      transactionId: record.id,
      platformFee,
      netAmount,
    };
  }

  async verifyPayment(
    transactionReference: string,
    providerId?: PaymentProviderId,
    gatewayPaymentId?: string
  ): Promise<PaymentVerification> {
    const provider = this.resolveProvider(providerId);
    return provider.verifyPayment(transactionReference, gatewayPaymentId);
  }

  async getPaymentStatus(
    transactionReference: string,
    providerId?: PaymentProviderId,
    gatewayPaymentId?: string
  ): Promise<PaymentStatusResult> {
    const provider = this.resolveProvider(providerId);
    return provider.getPaymentStatus(transactionReference, gatewayPaymentId);
  }

  async handleWebhook(input: WebhookHandleInput): Promise<WebhookHandleResult> {
    const provider = this.resolveProvider(input.provider);
    const result = await provider.handleWebhook(input);

    if (result.ok && result.transactionReference && result.status) {
      const updated = await updatePaymentByReference({
        transactionReference: result.transactionReference,
        gatewayPaymentId: result.gatewayPaymentId,
        paymentStatus: result.status,
        webhookEventId: result.webhookEventId,
        tenantId: input.tenantId,
      });

      if (!updated && result.gatewayPaymentId) {
        await updatePaymentByGatewayId({
          gatewayPaymentId: result.gatewayPaymentId,
          paymentStatus: result.status,
          webhookEventId: result.webhookEventId,
          tenantId: input.tenantId,
        });
      }

      if (result.status === "completed") {
        const existing = await findByTransactionReference(result.transactionReference);
        await markLinkedInvoicePaid(existing?.invoiceId);
      }
    }

    return result;
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult> {
    const provider = this.resolveProvider(input.provider);
    const result = await provider.refundPayment(input);

    if (result.success) {
      await updatePaymentByReference({
        transactionReference: input.transactionReference,
        gatewayPaymentId: input.gatewayPaymentId,
        paymentStatus: "refunded",
      });
    }

    return result;
  }

  async syncPaymentStatus(
    transactionReference: string,
    providerId?: PaymentProviderId
  ): Promise<PaymentStatusResult> {
    const existing = await findByTransactionReference(transactionReference);
    const provider = this.resolveProvider(providerId ?? existing?.paymentProvider);
    const status = await provider.getPaymentStatus(
      transactionReference,
      existing?.gatewayPaymentId ?? undefined
    );

    await updatePaymentByReference({
      transactionReference,
      gatewayPaymentId: status.gatewayPaymentId,
      paymentStatus: status.status,
      tenantId: existing?.tenantId,
    });

    if (status.status === "completed") {
      await markLinkedInvoicePaid(existing?.invoiceId);
    }

    return status;
  }

  /** @deprecated fincore compat — use createCheckoutSession */
  async createPayment(
    provider: string,
    data: {
      amount: number;
      currency?: string;
      description?: string;
      metadata?: Record<string, string>;
      invoiceId?: string;
      subscriptionId?: string;
      customerId?: string;
    }
  ): Promise<CheckoutSessionResult> {
    const tenantId = data.metadata?.tenant_id ?? data.metadata?.officeId ?? "default";
    return this.createCheckoutSession({
      tenantId,
      amount: data.amount,
      currency: data.currency,
      description: data.description,
      invoiceId: data.invoiceId ?? data.metadata?.invoice_id,
      subscriptionId: data.subscriptionId ?? data.metadata?.subscription_id,
      customerId: data.customerId ?? data.metadata?.customer_id,
      metadata: data.metadata,
      provider: provider as PaymentProviderId,
    });
  }

  /** @deprecated fincore compat — use refundPayment */
  async refund(
    provider: string,
    paymentId: string,
    amount?: number
  ): Promise<RefundPaymentResult> {
    return this.refundPayment({
      tenantId: "default",
      transactionReference: paymentId,
      gatewayPaymentId: paymentId,
      amount,
      provider: provider as PaymentProviderId,
    });
  }
}

export const PaymentService = new PaymentServiceImpl();
