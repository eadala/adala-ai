import { getStripeSync, getUncachableStripeClient } from './stripeClient';
import { provisionTenant } from './services/tenantProvisioning';
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { randomBytes, randomUUID } from "crypto";
import nodemailer from "nodemailer";

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

    /* ══════════════════════════════════════════════════════════════
       7. Office service payment → auto-create case + client + portal
    ══════════════════════════════════════════════════════════════ */
    if (eventType === 'checkout.session.completed') {
      const session = event.data.object as any;
      const officeSlug  = session?.metadata?.officeSlug;
      const serviceName = session?.metadata?.serviceName ?? "";
      const clientName  = session?.metadata?.clientName  ?? "";
      const clientPhone = session?.metadata?.clientPhone ?? "";
      const clientEmail = session?.metadata?.clientEmail
        ?? session?.customer_email
        ?? session?.customer_details?.email
        ?? "";

      if (officeSlug && !session?.metadata?.plan) {
        console.log(`[Webhook] Office service checkout — slug=${officeSlug} client=${clientName}`);
        try {
          await handleOfficeServicePayment({
            stripeSessionId: session.id as string,
            officeSlug, clientName, clientPhone, clientEmail, serviceName,
          });
        } catch (err) {
          console.error('[Webhook] handleOfficeServicePayment error:', err);
        }
      }
    }

    /* ── StripeSync (handles low-level DB sync) ─────────────── */
    await runStripeSync(payload, signature);
  }
}

/* ── Office service payment: auto-provision client + case + portal ── */
async function handleOfficeServicePayment(opts: {
  stripeSessionId: string;
  officeSlug: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  serviceName: string;
}) {
  const { stripeSessionId, officeSlug, clientName, clientPhone, clientEmail, serviceName } = opts;

  function sqlOne(r: any) { return (r?.rows ?? r)?.[0] ?? null; }

  /* 1 ─ Make sure extra columns exist on office_orders */
  await db.execute(sql`
    ALTER TABLE office_orders
      ADD COLUMN IF NOT EXISTS status        TEXT DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS auto_case_id  TEXT,
      ADD COLUMN IF NOT EXISTS portal_token  TEXT
  `).catch(() => {});

  /* 2 ─ Get the order & office */
  const orderRow = sqlOne(await db.execute(sql`
    SELECT oo.*, op.id AS office_page_id, op.name AS office_name, op.email AS office_email
    FROM office_orders oo
    JOIN office_page   op ON op.id = oo.office_id
    WHERE oo.stripe_session_id = ${stripeSessionId}
    LIMIT 1
  `));
  if (!orderRow) {
    console.warn('[Webhook] No order found for session', stripeSessionId);
    return;
  }
  const officeId = orderRow.office_page_id as string;

  /* 3 ─ Mark order as paid */
  await db.execute(sql`
    UPDATE office_orders SET status = 'paid', updated_at = NOW()
    WHERE stripe_session_id = ${stripeSessionId}
  `).catch(() => {});

  /* 4 ─ Ensure client_accounts table exists */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS client_accounts (
      id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      email          TEXT UNIQUE NOT NULL,
      password_hash  TEXT,
      name           TEXT,
      phone          TEXT,
      email_verified BOOLEAN DEFAULT false,
      otp            TEXT,
      otp_expires    TIMESTAMPTZ,
      created_at     TIMESTAMPTZ DEFAULT NOW(),
      updated_at     TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {});

  /* 5 ─ Get or create client account */
  let clientId: string;
  if (clientEmail) {
    const existing = sqlOne(await db.execute(sql`
      SELECT id FROM client_accounts WHERE email = ${clientEmail.toLowerCase()} LIMIT 1
    `));
    if (existing) {
      clientId = existing.id as string;
      /* Update name/phone if missing */
      await db.execute(sql`
        UPDATE client_accounts
        SET name  = COALESCE(name,  ${clientName  || null}),
            phone = COALESCE(phone, ${clientPhone || null}),
            updated_at = NOW()
        WHERE id = ${clientId}
      `).catch(() => {});
    } else {
      clientId = randomBytes(16).toString("hex");
      await db.execute(sql`
        INSERT INTO client_accounts (id, email, name, phone, email_verified)
        VALUES (${clientId}, ${clientEmail.toLowerCase()}, ${clientName || null}, ${clientPhone || null}, true)
      `);
    }
  } else {
    /* No email — create anonymous account keyed by phone */
    clientId = randomBytes(16).toString("hex");
    const fakeEmail = `${clientId}@noemail.adala.sa`;
    await db.execute(sql`
      INSERT INTO client_accounts (id, email, name, phone)
      VALUES (${clientId}, ${fakeEmail}, ${clientName || null}, ${clientPhone || null})
    `).catch(() => {});
  }

  /* 6 ─ Auto-create a case */
  const svcLabel = serviceName || orderRow.service_name || "خدمة قانونية";
  const caseTitle = `${svcLabel} — ${clientName || clientPhone || "عميل جديد"}`;
  const caseId = randomUUID();

  await db.execute(sql`
    INSERT INTO cases (id, title, description, case_type, status, client_name, created_by)
    VALUES (
      ${caseId},
      ${caseTitle},
      ${'تم إنشاء هذه القضية تلقائياً عند اكتمال الدفع الإلكتروني عبر بوابة المكتب.'},
      'civil',
      'open',
      ${clientName || null},
      ${officeId}
    )
  `).catch(() => {});

  /* 7 ─ Create portal token */
  const portalToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 365 * 86400000); // 1 year

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS client_portal_tokens (
      id               TEXT PRIMARY KEY,
      case_id          TEXT NOT NULL,
      token            TEXT NOT NULL UNIQUE,
      client_email     TEXT,
      client_name      TEXT,
      expires_at       TIMESTAMPTZ,
      last_accessed    TIMESTAMPTZ,
      access_count     INTEGER DEFAULT 0,
      show_invoices    BOOLEAN DEFAULT true,
      show_timeline    BOOLEAN DEFAULT true,
      allowed_to_upload BOOLEAN DEFAULT false,
      shared_documents JSONB DEFAULT '[]',
      created_at       TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {});

  const portalId = randomUUID();
  await db.execute(sql`
    INSERT INTO client_portal_tokens
      (id, case_id, token, client_email, client_name, expires_at,
       show_invoices, show_timeline, allowed_to_upload, shared_documents, created_at)
    VALUES
      (${portalId}, ${caseId}, ${portalToken},
       ${clientEmail || null}, ${clientName || null},
       ${expiresAt.toISOString()},
       true, true, true, '[]', NOW())
    ON CONFLICT DO NOTHING
  `).catch(() => {});

  /* 8 ─ Link case to client account */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS client_case_links (
      id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      client_id       TEXT NOT NULL,
      case_id         TEXT NOT NULL,
      portal_token_id TEXT,
      portal_token    TEXT,
      office_id       TEXT,
      linked_at       TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(client_id, case_id)
    )
  `).catch(() => {});

  await db.execute(sql`
    INSERT INTO client_case_links (client_id, case_id, portal_token_id, portal_token, office_id)
    VALUES (${clientId}, ${caseId}, ${portalId}, ${portalToken}, ${officeId})
    ON CONFLICT (client_id, case_id) DO NOTHING
  `).catch(() => {});

  /* 9 ─ Store portal token on the order for frontend retrieval */
  await db.execute(sql`
    UPDATE office_orders
    SET auto_case_id = ${caseId}, portal_token = ${portalToken}
    WHERE stripe_session_id = ${stripeSessionId}
  `).catch(() => {});

  /* 10 ─ Add initial timeline entry */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS case_timeline (
      id          TEXT PRIMARY KEY,
      case_id     TEXT NOT NULL,
      entry_type  TEXT NOT NULL DEFAULT 'note',
      title       TEXT NOT NULL,
      description TEXT,
      happened_at TIMESTAMPTZ DEFAULT NOW(),
      is_shared   BOOLEAN DEFAULT true,
      created_by  TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {});

  await db.execute(sql`
    INSERT INTO case_timeline (id, case_id, entry_type, title, description, is_shared, created_by)
    VALUES (
      ${randomUUID()}, ${caseId}, 'note',
      'تم استلام الطلب والدفع بنجاح ✅',
      ${'تم استلام طلبك وسيتم التواصل معك في أقرب وقت ممكن. يمكنك متابعة تفاصيل قضيتك من خلال بوابتك الإلكترونية.'},
      true, 'system'
    )
  `).catch(() => {});

  /* 11 ─ Send welcome email with portal link */
  if (clientEmail) {
    try {
      const baseUrl = process.env.REPLIT_DOMAINS
        ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
        : "https://adala.sa";
      const portalUrl = `${baseUrl}/portal/${portalToken}`;
      const officeName = orderRow.office_name ?? "مكتب المحاماة";
      await sendAcquisitionEmail({ clientEmail, clientName, officeName, svcLabel, portalUrl });
    } catch (e) {
      console.error('[Webhook] Welcome email error:', e);
    }
  }

  console.log(`[Webhook] Client acquisition done — case=${caseId} portal=${portalToken.slice(0, 8)}...`);
}

async function sendAcquisitionEmail(opts: {
  clientEmail: string; clientName: string; officeName: string; svcLabel: string; portalUrl: string;
}) {
  const { clientEmail, clientName, officeName, svcLabel, portalUrl } = opts;

  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  if (!smtpHost || !smtpUser || !smtpPass) {
    console.log('[Webhook] SMTP not configured — skipping welcome email');
    return;
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: parseInt(process.env.SMTP_PORT ?? "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: smtpUser, pass: smtpPass },
  });

  const greeting = clientName ? `مرحباً ${clientName}،` : "مرحباً،";
  const html = `
  <div dir="rtl" style="font-family:'Cairo',Arial,sans-serif;line-height:1.8;color:#111;max-width:600px;margin:0 auto;padding:32px 24px;border:1px solid #e5e7eb;border-radius:12px">
    <div style="background:linear-gradient(135deg,#0f1c35,#1A2744);padding:24px 28px;border-radius:10px;margin-bottom:24px">
      <div style="color:#C9A84C;font-size:22px;font-weight:900">⚖️ ${officeName}</div>
      <div style="color:rgba(255,255,255,.6);font-size:13px;margin-top:4px">تأكيد الطلب والدفع</div>
    </div>
    <p style="font-size:15px">${greeting}</p>
    <p>شكراً على ثقتك بـ <strong>${officeName}</strong>. تم استلام طلبك بنجاح وسيتواصل معك فريق المكتب في أقرب وقت.</p>
    <div style="background:#f8f9fa;border-right:4px solid #C9A84C;padding:16px;border-radius:8px;margin:20px 0">
      <strong>📋 الخدمة المطلوبة:</strong> ${svcLabel}
    </div>
    <p>يمكنك متابعة حالة قضيتك وجميع التحديثات من خلال <strong>بوابتك الإلكترونية الخاصة</strong>:</p>
    <div style="text-align:center;margin:24px 0">
      <a href="${portalUrl}"
         style="display:inline-block;background:#C9A84C;color:#0d1b2a;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px">
        🔗 فتح بوابتك الإلكترونية
      </a>
    </div>
    <p style="font-size:12px;color:#9ca3af;text-align:center">
      إذا لم تطلب هذه الخدمة، يمكنك تجاهل هذا البريد.
    </p>
    <hr style="margin-top:28px;border-color:#e5e7eb"/>
    <p style="color:#9ca3af;font-size:11px;text-align:center">منصة عدالة AI — نظام التشغيل القانوني الذكي</p>
  </div>`;

  await transporter.sendMail({
    from: `"${officeName}" <${process.env.SMTP_FROM ?? smtpUser}>`,
    to: clientEmail,
    subject: `✅ تأكيد طلبك — ${svcLabel}`,
    text: `${greeting}\nتم استلام طلبك (${svcLabel}) بنجاح.\n\nبوابتك الإلكترونية: ${portalUrl}`,
    html,
  });
}

async function runStripeSync(payload: Buffer, signature: string) {
  try {
    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);
  } catch (err) {
    console.warn('[Webhook] StripeSync warning:', (err as Error).message);
  }
}
