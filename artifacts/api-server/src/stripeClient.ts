import Stripe from 'stripe';
import { StripeSync } from 'stripe-replit-sync';

/** Stripe is optional — only active when explicitly enabled and fully configured */
export function isStripeConfigured(): boolean {
  return (
    process.env.STRIPE_ENABLED === 'true' &&
    !!process.env.STRIPE_SECRET_KEY?.trim() &&
    !!process.env.STRIPE_WEBHOOK_SECRET?.trim()
  );
}

async function getStripeCredentials(): Promise<{ secretKey: string; webhookSecret: string }> {
  if (!isStripeConfigured()) {
    throw new Error(
      'Stripe معطّل — فعّل STRIPE_ENABLED=true وعيّن STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET'
    );
  }

  const secretKey = process.env.STRIPE_SECRET_KEY!.trim();
  if (secretKey.startsWith('pk_')) {
    throw new Error(
      'STRIPE_SECRET_KEY يبدأ بـ pk_ وهو مفتاح نشر عام — يجب إدخال المفتاح السري الذي يبدأ بـ sk_test_ أو sk_live_'
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!.trim();
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
