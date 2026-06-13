/**
 * Payment Abstraction Layer — عدالة AI
 * Adapters: Stripe | Moyasar | Checkout.com
 * Usage: PaymentService.createPayment("stripe" | "moyasar" | "checkout", data)
 */
import { getUncachableStripeClient } from "../stripeClient";
import axios from "axios";

/* ── Interface ────────────────────────────────── */
export interface PaymentProvider {
  createPayment(data: PaymentData): Promise<PaymentResult>;
  verifyPayment(ref: string): Promise<any>;
  refund(paymentId: string, amount?: number): Promise<any>;
}

export interface PaymentData {
  amount: number;            // SAR
  currency?: string;
  description?: string;
  reference?: string;
  clientEmail?: string;
  clientName?: string;
  metadata?: Record<string, any>;
  token?: string;            // card token (Checkout.com)
}

export interface PaymentResult {
  success: boolean;
  paymentId: string;
  clientSecret?: string;
  checkoutUrl?: string;
  status: string;
  raw?: any;
}

/* ── Stripe Adapter ─────────────────────────── */
class StripeAdapter implements PaymentProvider {
  async createPayment(data: PaymentData): Promise<PaymentResult> {
    const stripe = await getUncachableStripeClient();
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(data.amount * 100),
      currency: data.currency?.toLowerCase() ?? "sar",
      description: data.description,
      metadata: {
        reference: data.reference ?? "",
        ...data.metadata,
      },
      automatic_payment_methods: { enabled: true },
    });
    return {
      success: intent.status !== "canceled",
      paymentId: intent.id,
      clientSecret: intent.client_secret ?? undefined,
      status: intent.status,
      raw: intent,
    };
  }

  async verifyPayment(ref: string): Promise<any> {
    const stripe = await getUncachableStripeClient();
    return stripe.paymentIntents.retrieve(ref);
  }

  async refund(paymentId: string, amount?: number): Promise<any> {
    const stripe = await getUncachableStripeClient();
    const params: any = { payment_intent: paymentId };
    if (amount) params.amount = Math.round(amount * 100);
    return stripe.refunds.create(params);
  }
}

/* ── Moyasar Adapter ────────────────────────── */
class MoyasarAdapter implements PaymentProvider {
  private get apiKey() { return process.env.MOYASAR_SECRET_KEY ?? ""; }
  private baseURL = "https://api.moyasar.com/v1";

  async createPayment(data: PaymentData): Promise<PaymentResult> {
    if (!this.apiKey) {
      return { success: false, paymentId: "", status: "no_key", raw: { error: "Moyasar key not configured" } };
    }
    const res = await axios.post(
      `${this.baseURL}/invoices`,
      {
        amount: Math.round(data.amount * 100),
        currency: data.currency ?? "SAR",
        description: data.description ?? "خدمة قانونية",
        callback_url: `${process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "https://adala-ai.app"}/api/webhook/moyasar`,
        metadata: data.metadata ?? {},
      },
      { auth: { username: this.apiKey, password: "" } }
    ).catch(e => ({ data: { error: e.message, id: "", status: "failed", url: "" } }));

    const d = (res as any).data;
    return {
      success: !d.error,
      paymentId: d.id ?? "",
      checkoutUrl: d.url ?? "",
      status: d.status ?? "failed",
      raw: d,
    };
  }

  async verifyPayment(ref: string): Promise<any> {
    if (!this.apiKey) return { error: "no key" };
    const res = await axios.get(`${this.baseURL}/payments/${ref}`, {
      auth: { username: this.apiKey, password: "" },
    }).catch(e => ({ data: { error: e.message } }));
    return (res as any).data;
  }

  async refund(paymentId: string, amount?: number): Promise<any> {
    if (!this.apiKey) return { error: "no key" };
    const res = await axios.post(
      `${this.baseURL}/payments/${paymentId}/refund`,
      amount ? { amount: Math.round(amount * 100) } : {},
      { auth: { username: this.apiKey, password: "" } }
    ).catch(e => ({ data: { error: e.message } }));
    return (res as any).data;
  }
}

/* ── Checkout.com Adapter ───────────────────── */
class CheckoutAdapter implements PaymentProvider {
  private get apiKey() { return process.env.CHECKOUT_SECRET_KEY ?? ""; }
  private baseURL = "https://api.checkout.com";

  async createPayment(data: PaymentData): Promise<PaymentResult> {
    if (!this.apiKey) {
      return { success: false, paymentId: "", status: "no_key", raw: { error: "Checkout key not configured" } };
    }
    const body: any = {
      amount: Math.round(data.amount * 100),
      currency: data.currency ?? "SAR",
      reference: data.reference,
      description: data.description,
    };
    if (data.token) {
      body.source = { type: "token", token: data.token };
    } else {
      body.source = { type: "card" };
    }
    const res = await axios.post(`${this.baseURL}/payments`, body, {
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
    }).catch(e => ({ data: { error: e.message, id: "", status: "failed" } }));

    const d = (res as any).data;
    return {
      success: d.approved ?? false,
      paymentId: d.id ?? "",
      checkoutUrl: d._links?.redirect?.href ?? "",
      status: d.status ?? "failed",
      raw: d,
    };
  }

  async verifyPayment(ref: string): Promise<any> {
    if (!this.apiKey) return { error: "no key" };
    const res = await axios.get(`${this.baseURL}/payments/${ref}`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    }).catch(e => ({ data: { error: e.message } }));
    return (res as any).data;
  }

  async refund(paymentId: string, amount?: number): Promise<any> {
    if (!this.apiKey) return { error: "no key" };
    const body: any = {};
    if (amount) body.amount = Math.round(amount * 100);
    const res = await axios.post(`${this.baseURL}/payments/${paymentId}/refunds`, body, {
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
    }).catch(e => ({ data: { error: e.message } }));
    return (res as any).data;
  }
}

/* ── Orchestrator ───────────────────────────── */
class PaymentOrchestrator {
  private adapters: Record<string, PaymentProvider> = {
    stripe:   new StripeAdapter(),
    moyasar:  new MoyasarAdapter(),
    checkout: new CheckoutAdapter(),
  };

  async createPayment(provider: string, data: PaymentData): Promise<PaymentResult> {
    const adapter = this.adapters[provider];
    if (!adapter) throw new Error(`بوابة الدفع غير معروفة: ${provider}`);
    return adapter.createPayment(data);
  }

  async verifyPayment(provider: string, ref: string): Promise<any> {
    const adapter = this.adapters[provider];
    if (!adapter) throw new Error(`بوابة الدفع غير معروفة: ${provider}`);
    return adapter.verifyPayment(ref);
  }

  async refund(provider: string, paymentId: string, amount?: number): Promise<any> {
    const adapter = this.adapters[provider];
    if (!adapter) throw new Error(`بوابة الدفع غير معروفة: ${provider}`);
    return adapter.refund(paymentId, amount);
  }

  listProviders() {
    return [
      { id: "stripe",   name: "Stripe",        region: "Global",    configured: !!process.env.STRIPE_SECRET_KEY },
      { id: "moyasar",  name: "Moyasar",       region: "KSA / MENA", configured: !!process.env.MOYASAR_SECRET_KEY },
      { id: "checkout", name: "Checkout.com",  region: "Global",    configured: !!process.env.CHECKOUT_SECRET_KEY },
    ];
  }
}

export const PaymentService = new PaymentOrchestrator();
