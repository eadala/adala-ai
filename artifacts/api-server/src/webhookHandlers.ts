import { getStripeSync, getUncachableStripeClient } from './stripeClient';
import { provisionTenant } from './services/tenantProvisioning';
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

/* ── Revenue calculation (mirrors the document spec) ──────────────
   Platform fee : 10%
   Stripe fee   : 2.9% + 1.00 SAR fixed  (approximate for SAR)
   Net          : gross - platformFee - stripeFee
──────────────────────────────────────────────────────────────────── */
const PLATFORM_FEE_PCT = 0.10;
const STRIPE_FEE_PCT   = 0.029;
const STRIPE_FEE_FIXED = 1.00; // 1 SAR fixed fee per transaction

function calcRevenue(grossSAR: number) {
  const platformFee = parseFloat((grossSAR * PLATFORM_FEE_PCT).toFixed(2));
  const stripeFee   = parseFloat((grossSAR * STRIPE_FEE_PCT + STRIPE_FEE_FIXED).toFixed(2));
  const net         = parseFloat((grossSAR - platformFee - stripeFee).toFixed(2));
  return { gross: grossSAR, platformFee, stripeFee, net };
}

/* ── Write a credit line to office_ledger with full breakdown ──── */
async function recordRevenue(opts: {
  officeId: string;
  grossSAR: number;
  ref: string;
  description: string;
  stripeId?: string;
  stripeEventId?: string;
}) {
  const { officeId, grossSAR, ref, description, stripeId, stripeEventId } = opts;
  const { platformFee, stripeFee, net } = calcRevenue(grossSAR);
  await db.execute(sql`
    INSERT INTO office_ledger
      (office_id, type, amount, currency, ref, description,
       stripe_id, stripe_event_id, platform_fee, stripe_fee, net_amount)
    VALUES
      (${officeId}, 'credit', ${grossSAR}, 'SAR', ${ref}, ${description},
       ${stripeId ?? null}, ${stripeEventId ?? null},
       ${platformFee}, ${stripeFee}, ${net})
    ON CONFLICT DO NOTHING
  `);
  return { platformFee, stripeFee, net };
}

/* ── Downgrade office to free ────────────────────────────────── */
async function downgradeToFree(officeId: string, reason: string) {
  try {
    await provisionTenant({ officeId, plan: 'free', email: 'system' });
    await db.execute(sql`
      INSERT INTO plan_notifications (office_id, type, old_plan, new_plan, title, message, is_read)
      VALUES (${officeId}, 'downgrade', 'paid', 'free',
        'تم تخفيض الباقة تلقائياً ⚠️',
        ${reason}, FALSE)
    `);
    console.log(`[Webhook] Downgraded office=${officeId} to free — ${reason}`);
  } catch (err) {
    console.error('[Webhook] Downgrade error:', err);
  }
}

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    /* ── Signature verification ─────────────────────────────── */
    let event: any;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (webhookSecret) {
      try {
        const stripe = await getUncachableStripeClient();
        event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
      } catch (err) {
        console.error('[Webhook] Signature verification failed — rejecting event');
        throw new Error('Webhook signature verification failed');
      }
    } else {
      console.warn('[Webhook] STRIPE_WEBHOOK_SECRET not set — skipping provisioning');
    }

    if (!event) {
      /* StripeSync still runs below even without a verified event */
      await runStripeSync(payload, signature);
      return;
    }

    const eventId   = event.id as string;
    const eventType = event.type as string;
    console.log(`[Webhook] Processing event: ${eventType} (${eventId})`);

    /* ══════════════════════════════════════════════════════════════
       1. checkout.session.completed → activate subscription
    ══════════════════════════════════════════════════════════════ */
    if (eventType === 'checkout.session.completed') {
      const session  = event.data.object as any;
      const plan     = session?.metadata?.plan ?? session?.metadata?.planId ?? 'basic';
      const email    = session?.customer_email ?? session?.customer_details?.email ?? 'unknown';
      const officeId = session?.metadata?.officeId ?? 'default';
      const grossSAR = (session?.amount_total ?? 0) / 100;

      console.log(`[Webhook] checkout.session.completed — office=${officeId} plan=${plan} amount=${grossSAR} SAR`);

      try {
        await provisionTenant({ officeId, plan, email, stripeSessionId: session.id, amountPaid: session?.amount_total ?? 0 });

        if (grossSAR > 0) {
          const rev = await recordRevenue({
            officeId,
            grossSAR,
            ref:         `CHECKOUT_${plan.toUpperCase()}`,
            description: `اشتراك باقة ${plan} — ${email}`,
            stripeId:    session.id,
            stripeEventId: eventId,
          });
          console.log(`[Webhook] Revenue recorded: gross=${grossSAR} platform=${rev.platformFee} stripe=${rev.stripeFee} net=${rev.net}`);
        }
      } catch (err) {
        console.error('[Webhook] checkout provisioning error:', err);
      }
    }

    /* ══════════════════════════════════════════════════════════════
       2. invoice.paid → record subscription renewal revenue
    ══════════════════════════════════════════════════════════════ */
    if (eventType === 'invoice.paid') {
      const inv      = event.data.object as any;
      const grossSAR = (inv?.amount_paid ?? 0) / 100;
      if (grossSAR <= 0) { /* free plan / zero invoice */ }
      else {
        const officeId    = inv?.metadata?.officeId ?? inv?.subscription_details?.metadata?.officeId ?? 'default';
        const plan        = inv?.metadata?.plan     ?? inv?.subscription_details?.metadata?.plan     ?? 'unknown';
        const email       = inv?.customer_email ?? 'unknown';
        const periodEnd   = inv?.lines?.data?.[0]?.period?.end
          ? new Date(inv.lines.data[0].period.end * 1000).toLocaleDateString('ar-SA')
          : '';

        try {
          const rev = await recordRevenue({
            officeId,
            grossSAR,
            ref:         `RENEWAL_${plan.toUpperCase()}`,
            description: `تجديد اشتراك ${plan}${periodEnd ? ' — حتى ' + periodEnd : ''} — ${email}`,
            stripeId:    inv.id,
            stripeEventId: eventId,
          });
          console.log(`[Webhook] invoice.paid: gross=${grossSAR} platform=${rev.platformFee} stripe=${rev.stripeFee} net=${rev.net}`);

          /* Also update platform_billing_invoices status */
          await db.execute(sql`
            UPDATE platform_billing_invoices
            SET status = 'paid', paid_at = NOW()
            WHERE stripe_id = ${inv.id} OR (status = 'unpaid' AND office_id = ${officeId})
          `).catch(() => {});
        } catch (err) {
          console.error('[Webhook] invoice.paid error:', err);
        }
      }
    }

    /* ══════════════════════════════════════════════════════════════
       3. customer.subscription.updated → sync plan changes
    ══════════════════════════════════════════════════════════════ */
    if (eventType === 'customer.subscription.updated') {
      const sub      = event.data.object as any;
      const officeId = sub?.metadata?.officeId ?? 'default';
      const plan     = sub?.metadata?.plan     ?? sub?.metadata?.planId ?? null;
      const status   = sub?.status as string;

      console.log(`[Webhook] subscription.updated — office=${officeId} status=${status} plan=${plan}`);

      try {
        /* Sync status */
        await db.execute(sql`
          UPDATE subscriptions SET status = ${status} WHERE office_id = ${officeId}
        `).catch(() => {});

        /* If plan changed, re-provision */
        if (plan && status === 'active') {
          const email = sub?.customer_email ?? 'system';
          await provisionTenant({ officeId, plan, email });
        }

        /* Cancellation scheduled */
        if (sub?.cancel_at_period_end) {
          const cancelDate = new Date((sub.current_period_end ?? 0) * 1000).toLocaleDateString('ar-SA');
          await db.execute(sql`
            INSERT INTO plan_notifications (office_id, type, old_plan, new_plan, title, message, is_read)
            VALUES (${officeId}, 'downgrade', ${plan ?? 'paid'}, 'free',
              'إلغاء الاشتراك مجدول 📅',
              ${`سيتوقف اشتراكك تلقائياً في ${cancelDate}. يمكنك إلغاء قرار الإلغاء من لوحة التحكم.`}, FALSE)
          `).catch(() => {});
        }
      } catch (err) {
        console.error('[Webhook] subscription.updated error:', err);
      }
    }

    /* ══════════════════════════════════════════════════════════════
       4. customer.subscription.deleted → downgrade to free
    ══════════════════════════════════════════════════════════════ */
    if (eventType === 'customer.subscription.deleted') {
      const sub      = event.data.object as any;
      const officeId = sub?.metadata?.officeId ?? 'default';
      try {
        await db.execute(sql`
          UPDATE subscriptions SET status = 'cancelled' WHERE office_id = ${officeId}
        `).catch(() => {});
        await downgradeToFree(officeId, 'انتهى الاشتراك وتم تخفيض الباقة إلى المجاني تلقائياً.');
      } catch (err) {
        console.error('[Webhook] subscription.deleted error:', err);
      }
    }

    /* ══════════════════════════════════════════════════════════════
       5. invoice.payment_failed → mark past_due + notify
    ══════════════════════════════════════════════════════════════ */
    if (eventType === 'invoice.payment_failed') {
      const inv       = event.data.object as any;
      const officeId  = inv?.metadata?.officeId ?? 'default';
      const attempt   = inv?.attempt_count ?? 1;

      try {
        await db.execute(sql`
          UPDATE subscriptions SET status = 'past_due' WHERE office_id = ${officeId}
        `).catch(() => {});

        await db.execute(sql`
          INSERT INTO plan_notifications (office_id, type, old_plan, new_plan, title, message, is_read)
          VALUES (${officeId}, 'downgrade', 'paid', 'paid',
            ${'فشل تجديد الاشتراك ❌ (محاولة ' + attempt + ')'},
            'فشلت عملية الدفع. يُرجى تحديث بيانات بطاقتك لتجنب تعليق الخدمة.', FALSE)
        `).catch(() => {});

        /* Auto-downgrade after 3 failed attempts */
        if (attempt >= 3) {
          await downgradeToFree(officeId, `تم تخفيض الباقة إلى المجاني بعد ${attempt} محاولات دفع فاشلة.`);
        }

        console.log(`[Webhook] invoice.payment_failed — office=${officeId} attempt=${attempt}`);
      } catch (err) {
        console.error('[Webhook] payment_failed error:', err);
      }
    }

    /* ══════════════════════════════════════════════════════════════
       6. customer.subscription.trial_will_end → remind user
    ══════════════════════════════════════════════════════════════ */
    if (eventType === 'customer.subscription.trial_will_end') {
      const sub      = event.data.object as any;
      const officeId = sub?.metadata?.officeId ?? 'default';
      const trialEnd = new Date((sub?.trial_end ?? 0) * 1000).toLocaleDateString('ar-SA');
      try {
        await db.execute(sql`
          INSERT INTO plan_notifications (office_id, type, old_plan, new_plan, title, message, is_read)
          VALUES (${officeId}, 'info', 'trial', 'trial',
            'تنتهي فترة التجربة قريباً ⏰',
            ${`تنتهي فترة تجربتك المجانية في ${trialEnd}. أضف بيانات الدفع للاستمرار.`}, FALSE)
        `).catch(() => {});
      } catch { /* non-critical */ }
    }

    /* ── StripeSync (handles low-level DB sync) ─────────────── */
    await runStripeSync(payload, signature);
  }
}

async function runStripeSync(payload: Buffer, signature: string) {
  try {
    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);
  } catch (err) {
    console.warn('[Webhook] StripeSync warning:', (err as Error).message);
  }
}
