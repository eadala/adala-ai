import axios from "axios";
import crypto from "crypto";
import { requireProductionBaseUrl } from "../../lib/productionUrl";
import type {
  CreateCheckoutSessionInput,
  CheckoutSessionResult,
  PaymentProvider,
  PaymentStatusValue,
  PaymentVerification,
  RefundPaymentInput,
  RefundPaymentResult,
  WebhookHandleInput,
  WebhookHandleResult,
  PaymentStatusResult,
} from "../types";
import { MOYASAR_CHECKOUT_METHODS } from "../types";

const API_BASE = "https://api.moyasar.com/v1";
const CHECKOUT_BASE = "https://checkout.moyasar.com/v1";

function mapMoyasarStatus(raw?: string): PaymentStatusValue {
  switch ((raw ?? "").toLowerCase()) {
    case "paid":
    case "captured":
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "refunded":
      return "refunded";
    case "cancelled":
    case "canceled":
      return "cancelled";
    case "initiated":
    case "authorized":
      return "processing";
    default:
      return "pending";
  }
}

function secretKey(): string {
  return process.env.MOYASAR_SECRET_KEY?.trim() ?? "";
}

function publishableKey(): string {
  return process.env.MOYASAR_PUBLISHABLE_KEY?.trim() ?? "";
}

function webhookSecret(): string {
  return process.env.MOYASAR_WEBHOOK_SECRET?.trim() ?? "";
}

export class MoyasarProvider implements PaymentProvider {
  readonly id = "moyasar" as const;

  get enabled(): boolean {
    return !!(secretKey() && publishableKey());
  }

  async createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CheckoutSessionResult> {
    if (!this.enabled) {
      throw new Error(
        "Moyasar غير مُهيَّأ — عيّن MOYASAR_SECRET_KEY و MOYASAR_PUBLISHABLE_KEY"
      );
    }

    const baseUrl = requireProductionBaseUrl();
    const txRef = `ADALA-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    const amountHalalas = Math.round(input.amount * 100);
    const methods = (input.paymentMethods?.length
      ? input.paymentMethods
      : [...MOYASAR_CHECKOUT_METHODS]
    ).join(",");

    const callbackUrl = `${baseUrl}/api/webhook/moyasar/callback?ref=${encodeURIComponent(txRef)}`;
    const successUrl = `${baseUrl}/api/payments/moyasar/success?ref=${encodeURIComponent(txRef)}`;

    const params = new URLSearchParams({
      publishable_api_key: publishableKey(),
      amount: String(amountHalalas),
      currency: input.currency ?? "SAR",
      description: input.description ?? "خدمة قانونية",
      callback_url: callbackUrl,
      success_url: successUrl,
      methods,
      "metadata[tenant_id]": input.tenantId,
      "metadata[ref]": txRef,
    });

    if (input.invoiceId) params.set("metadata[invoice_id]", input.invoiceId);
    if (input.subscriptionId) params.set("metadata[subscription_id]", input.subscriptionId);
    if (input.customerId) params.set("metadata[customer_id]", input.customerId);

    return {
      provider: "moyasar",
      sessionId: txRef,
      checkoutUrl: `${CHECKOUT_BASE}?${params.toString()}`,
      status: "pending",
      transactionReference: txRef,
      amount: input.amount,
    };
  }

  async verifyPayment(
    transactionReference: string,
    gatewayPaymentId?: string
  ): Promise<PaymentVerification> {
    const status = await this.getPaymentStatus(transactionReference, gatewayPaymentId);
    return {
      provider: "moyasar",
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
    if (!this.enabled) {
      return {
        provider: "moyasar",
        transactionReference,
        status: "pending",
      };
    }

    const id = gatewayPaymentId ?? transactionReference;
    const res = await axios
      .get(`${API_BASE}/payments/${id}`, {
        auth: { username: secretKey(), password: "" },
      })
      .catch(() => ({ data: null }));

    const d = (res as { data: Record<string, unknown> | null }).data;
    if (!d) {
      return { provider: "moyasar", transactionReference, status: "pending" };
    }

    return {
      provider: "moyasar",
      transactionReference,
      gatewayPaymentId: String(d.id ?? gatewayPaymentId ?? ""),
      status: mapMoyasarStatus(String(d.status ?? "")),
      amount: Number(d.amount ?? 0) / 100,
      currency: String(d.currency ?? "SAR"),
      raw: d,
    };
  }

  async handleWebhook(input: WebhookHandleInput): Promise<WebhookHandleResult> {
    const body =
      input.rawBody instanceof Buffer
        ? JSON.parse(input.rawBody.toString("utf8"))
        : (input.rawBody as Record<string, unknown>);

    const secret = webhookSecret();
    if (secret) {
      const sigHeader = input.headers["x-moyasar-signature"] as string | undefined;
      if (!sigHeader) {
        return { ok: false, error: "Missing x-moyasar-signature header" };
      }
      const expected = crypto.createHmac("sha256", secret).update(JSON.stringify(body)).digest("hex");
      const valid =
        sigHeader.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(sigHeader), Buffer.from(expected));
      if (!valid) {
        return { ok: false, error: "توقيع Moyasar غير صحيح" };
      }
    }

    const gatewayPaymentId = String(body.id ?? "");
    const metadata = (body.metadata ?? {}) as Record<string, string>;
    const transactionReference =
      metadata.ref ?? metadata.transaction_reference ?? gatewayPaymentId;
    const status = mapMoyasarStatus(String(body.status ?? ""));

    return {
      ok: true,
      webhookEventId: gatewayPaymentId || `moyasar-${Date.now()}`,
      transactionReference,
      gatewayPaymentId,
      status,
    };
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult> {
    if (!this.enabled) {
      return { success: false, status: "failed", raw: { error: "Moyasar not configured" } };
    }

    const paymentId = input.gatewayPaymentId ?? input.transactionReference;
    const res = await axios
      .post(
        `${API_BASE}/payments/${paymentId}/refund`,
        input.amount ? { amount: Math.round(input.amount * 100) } : {},
        { auth: { username: secretKey(), password: "" } }
      )
      .catch((e) => ({ data: { error: e.message } }));

    const d = (res as { data: Record<string, unknown> }).data;
    if (d.error) {
      return { success: false, status: "failed", raw: d };
    }

    return {
      success: true,
      refundId: String(d.id ?? paymentId),
      status: "refunded",
      raw: d,
    };
  }
}

export const moyasarProvider = new MoyasarProvider();
