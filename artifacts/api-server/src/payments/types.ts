/** Supported payment gateway identifiers */
export type PaymentProviderId =
  | "moyasar"
  | "stripe"
  | "hyperpay"
  | "paytabs"
  | "checkout";

export type PaymentStatusValue =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "refunded"
  | "cancelled";

/** Moyasar-hosted checkout methods (Visa/Mastercard via creditcard, Mada, Apple Pay, STC Pay) */
export const MOYASAR_CHECKOUT_METHODS = [
  "creditcard",
  "applepay",
  "stcpay",
  "mada",
] as const;

export interface CreateCheckoutSessionInput {
  tenantId: string;
  amount: number;
  currency?: string;
  description?: string;
  invoiceId?: string;
  subscriptionId?: string;
  customerId?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  metadata?: Record<string, string>;
  provider?: PaymentProviderId;
  paymentMethods?: string[];
  platformFee?: number;
  netAmount?: number;
  commissionPercent?: number;
}

export interface CheckoutSessionResult {
  provider: PaymentProviderId;
  sessionId: string;
  checkoutUrl?: string;
  clientSecret?: string;
  status: PaymentStatusValue;
  transactionReference: string;
  gatewayPaymentId?: string;
  transactionId?: string;
  amount: number;
  platformFee?: number;
  netAmount?: number;
}

/** @deprecated alias */
export type CreateCheckoutSessionResult = CheckoutSessionResult;

export interface PaymentVerification {
  provider: PaymentProviderId;
  transactionReference: string;
  gatewayPaymentId?: string;
  status: PaymentStatusValue;
  amount?: number;
  currency?: string;
  raw?: unknown;
}

export interface WebhookHandleInput {
  provider: PaymentProviderId;
  rawBody: Buffer | Record<string, unknown>;
  headers: Record<string, string | string[] | undefined>;
  tenantId?: string;
}

export interface WebhookHandleResult {
  ok: boolean;
  webhookEventId?: string;
  transactionReference?: string;
  gatewayPaymentId?: string;
  status?: PaymentStatusValue;
  skipped?: boolean;
  error?: string;
}

export interface RefundPaymentInput {
  tenantId: string;
  transactionReference: string;
  gatewayPaymentId?: string;
  amount?: number;
  provider?: PaymentProviderId;
}

export interface RefundPaymentResult {
  success: boolean;
  refundId?: string;
  status: PaymentStatusValue | "failed";
  raw?: unknown;
}

export interface PaymentStatusResult {
  provider: PaymentProviderId;
  transactionReference: string;
  gatewayPaymentId?: string;
  status: PaymentStatusValue;
  amount?: number;
  currency?: string;
  raw?: unknown;
}

export interface PaymentTransactionRecord {
  id: string;
  tenantId: string;
  invoiceId?: string | null;
  subscriptionId?: string | null;
  customerId?: string | null;
  paymentProvider: PaymentProviderId;
  paymentStatus: PaymentStatusValue;
  transactionReference: string;
  gatewayPaymentId?: string | null;
  webhookEventId?: string | null;
  amount: number;
  description?: string | null;
}

/** Provider contract — all gateways implement this surface */
export interface PaymentProvider {
  readonly id: PaymentProviderId;
  readonly enabled: boolean;
  createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CheckoutSessionResult>;
  verifyPayment(transactionReference: string, gatewayPaymentId?: string): Promise<PaymentVerification>;
  handleWebhook(input: WebhookHandleInput): Promise<WebhookHandleResult>;
  refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult>;
  getPaymentStatus(transactionReference: string, gatewayPaymentId?: string): Promise<PaymentStatusResult>;
}

export interface ProviderInfo {
  id: PaymentProviderId;
  name: string;
  region: string;
  enabled: boolean;
  primary: boolean;
}
