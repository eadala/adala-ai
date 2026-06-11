import { getStripeSync } from './stripeClient';
import { provisionTenant } from './services/tenantProvisioning';
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    /* ── Parse event — ONLY accept verified Stripe signatures ── */
    let event: any;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (webhookSecret) {
      /* Production path: strict signature verification */
      try {
        const sync = await getStripeSync();
        // @ts-ignore — access internal stripe instance
        const stripeRaw = (sync as any)._stripe ?? (sync as any).stripe;
        if (stripeRaw) {
          event = stripeRaw.webhooks.constructEvent(payload, signature, webhookSecret);
        }
      } catch (err) {
        console.error('[Webhook] Signature verification failed — rejecting event');
        throw new Error('Webhook signature verification failed');
      }
    } else {
      /* No webhook secret configured — skip custom provisioning entirely.
         StripeSync will still run below, but we do NOT parse unsigned payloads
         for privileged operations like tenant provisioning. */
      console.warn('[Webhook] STRIPE_WEBHOOK_SECRET not set — skipping event-based provisioning');
    }

    /* ── Handle checkout.session.completed ──────── */
    if (event?.type === 'checkout.session.completed') {
      const session = event.data?.object as any;
      const plan      = session?.metadata?.plan ?? session?.metadata?.planId ?? 'basic';
      const email     = session?.customer_email ?? session?.customer_details?.email ?? 'unknown';
      const officeId  = session?.metadata?.officeId ?? 'default';
      const amountPaid = session?.amount_total ?? 0;

      console.log(`[Webhook] checkout.session.completed — office=${officeId} plan=${plan} email=${email}`);

      try {
        const result = await provisionTenant({
          officeId,
          plan,
          email,
          stripeSessionId: session.id,
          amountPaid,
        });
        console.log('[Webhook] Tenant provisioned successfully', result);
      } catch (err) {
        console.error('[Webhook] Tenant provisioning error:', err);
      }
    }

    /* ── Handle subscription events ─────────────── */
    if (event?.type === 'customer.subscription.deleted') {
      const sub = event.data?.object as any;
      const officeId = sub?.metadata?.officeId ?? 'default';
      try {
        await db.execute(sql`
          UPDATE subscriptions SET status = 'cancelled' WHERE office_id = ${officeId}
        `);
        console.log(`[Webhook] Subscription cancelled for office=${officeId}`);
      } catch { /* non-critical */ }
    }

    if (event?.type === 'invoice.payment_failed') {
      const inv = event.data?.object as any;
      const officeId = inv?.metadata?.officeId ?? 'default';
      try {
        await db.execute(sql`
          UPDATE subscriptions SET status = 'past_due' WHERE office_id = ${officeId}
        `);
      } catch { /* non-critical */ }
    }

    /* ── StripeSync (handles DB sync for Stripe objects) ── */
    try {
      const sync = await getStripeSync();
      await sync.processWebhook(payload, signature);
    } catch (err) {
      // StripeSync may fail if webhook secret not set; our provisioning already ran above
      console.warn('[Webhook] StripeSync warning:', (err as Error).message);
    }
  }
}
