import Stripe from 'stripe';
import { StripeSync } from 'stripe-replit-sync';

async function getStripeCredentials(): Promise<{ secretKey: string; webhookSecret: string }> {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new Error(
      'STRIPE_SECRET_KEY غير مضبوط — عيّن المفتاح السري (sk_test_* أو sk_live_*) في متغيرات البيئة'
    );
  }
  if (secretKey.startsWith('pk_')) {
    throw new Error(
      'STRIPE_SECRET_KEY يبدأ بـ pk_ وهو مفتاح نشر عام — يجب إدخال المفتاح السري الذي يبدأ بـ sk_test_ أو sk_live_'
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    throw new Error(
      'STRIPE_WEBHOOK_SECRET غير مضبوط — مطلوب لتأكيد webhooks Stripe (whsec_*)'
    );
  }

  return { secretKey, webhookSecret };
}

export async function getUncachableStripeClient(): Promise<Stripe> {
  const { secretKey } = await getStripeCredentials();
  return new Stripe(secretKey);
}

export async function getStripeSync(): Promise<StripeSync> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL environment variable is required');
  const { secretKey, webhookSecret } = await getStripeCredentials();
  return new StripeSync({
    poolConfig: { connectionString: databaseUrl },
    stripeSecretKey: secretKey,
    stripeWebhookSecret: webhookSecret,
  });
}
