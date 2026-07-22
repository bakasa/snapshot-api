import Stripe from 'stripe';
import { db, getDb } from './db.js';

const stripeKey = process.env.STRIPE_SECRET_KEY;
let _stripe: Stripe | null = null;

function getStripe(): Stripe | null {
  if (!stripeKey) return null;
  if (_stripe) return _stripe;
  _stripe = new Stripe(stripeKey, { apiVersion: '2025-09-23' as any });
  return _stripe;
}

interface Plan {
  price: number;
  limit: number;
  stripePriceId: string;
}

export const PLANS: Record<string, Plan> = {
  free: { price: 0, limit: 100, stripePriceId: '' },
  pro: { price: 1500, limit: 1000, stripePriceId: process.env.STRIPE_PRICE_PRO || '' },
  business: { price: 4900, limit: 10000, stripePriceId: process.env.STRIPE_PRICE_BUSINESS || '' },
};

export type PlanName = keyof typeof PLANS;

export function isBillingConfigured(): boolean {
  return !!stripeKey;
}

export async function createCheckoutSession(plan: PlanName, apiKeyId: number, email?: string): Promise<string | null> {
  const stripe = getStripe();
  if (!stripe) return null;

  const planCfg = PLANS[plan];
  if (!planCfg.stripePriceId) return null;

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: planCfg.stripePriceId, quantity: 1 }],
    customer_email: email,
    success_url: `${process.env.APP_URL || 'https://snapshot-api-production-1374.up.railway.app'}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.APP_URL || 'https://snapshot-api-production-1374.up.railway.app'}/`,
    metadata: { api_key_id: String(apiKeyId), plan },
  });

  return session.url;
}

export async function handleWebhook(body: string, signature: string): Promise<{ ok: boolean }> {
  const stripe = getStripe();
  if (!stripe) return { ok: false };

  const event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET || '');
  const session = event.data.object as any;

  if (event.type === 'checkout.session.completed') {
    const meta = session.metadata || {};
    const apiKeyId = meta.api_key_id;
    if (apiKeyId) {
      const d = db();
      const key = d.getApiKeyById(parseInt(apiKeyId));
      if (key) {
        const planCfg = PLANS[meta.plan] || PLANS.pro;
        getDb().prepare('UPDATE api_keys SET plan = ?, monthly_limit = ? WHERE id = ?').run(meta.plan, planCfg.limit, parseInt(apiKeyId));
      }
    }
  }

  return { ok: true };
}
