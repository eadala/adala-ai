/**
 * Fake payment-provider transport for LOCAL refund workflows (ADALA-031).
 * Never talks to live Stripe/Moyasar. Success is explicit transport outcome only.
 */
export type FakeRefundOutcome = "ok" | "fail" | "timeout";

export interface FakeRefundResult {
  ok: boolean;
  providerRefundId: string | null;
  providerStatus: string;
  note: string;
}

export class FakePaymentTransport {
  constructor(private outcome: FakeRefundOutcome = "ok") {}

  setOutcome(outcome: FakeRefundOutcome) {
    this.outcome = outcome;
  }

  async refund(paymentId: string, amount: number): Promise<FakeRefundResult> {
    if (this.outcome === "fail") {
      return {
        ok: false,
        providerRefundId: null,
        providerStatus: "failed",
        note: `fake transport refused refund for ${paymentId} amount=${amount}`,
      };
    }
    if (this.outcome === "timeout") {
      return {
        ok: false,
        providerRefundId: null,
        providerStatus: "timeout",
        note: "fake transport timeout — local success must NOT be inferred",
      };
    }
    return {
      ok: true,
      providerRefundId: `fake_rf_${paymentId.slice(0, 8)}_${Date.now()}`,
      providerStatus: "succeeded",
      note: "fake transport succeeded (synthetic)",
    };
  }
}

let _transport: FakePaymentTransport = new FakePaymentTransport("ok");

export function getFakePaymentTransport(): FakePaymentTransport {
  return _transport;
}

export function setFakePaymentTransportForTests(t: FakePaymentTransport) {
  _transport = t;
}

export function liveRefundsForbidden(): boolean {
  return process.env.ADALA_FAKE_PAYMENTS === "1" || !process.env.STRIPE_SECRET_KEY;
}
