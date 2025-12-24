// Stripe Service - Dynamic pricing, subscriptions, and affiliate payouts
// Production-ready integration for Azure deployment
import Stripe from 'stripe';
import { getCountryFromIP } from './geolocationService';

// Only initialize Stripe if API key is provided
let stripe: Stripe | null = null;

if (process.env.STRIPE_SECRET_KEY) {
  try {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-09-30.clover',
    });
    console.log('✅ Stripe configured');
  } catch (error) {
    console.warn('⚠️  Failed to initialize Stripe:', (error as Error).message);
  }
} else {
  console.log('⚠️  Stripe not configured - STRIPE_SECRET_KEY missing (payment features disabled)');
}

// Helper to check if Stripe is available
const requireStripe = (): Stripe => {
  if (!stripe) {
    throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY in environment variables.');
  }
  return stripe;
};

/**
 * Pricing tiers by region
 * Tier5: $3 for developing, $5 for western
 * Tier10 and Tier15: same price globally
 */
const TIER_PRICING = {
  developing: {
    'tier5': { amount: 300, currency: 'usd' }, // $3 for developing countries
    'tier10': { amount: 1000, currency: 'usd' }, // $10 globally
    'tier15': { amount: 1500, currency: 'usd' }, // $15 globally
  },
  western: {
    'tier5': { amount: 500, currency: 'usd' }, // $5 for western countries
    'tier10': { amount: 1000, currency: 'usd' }, // $10 globally
    'tier15': { amount: 1500, currency: 'usd' }, // $15 globally
  },
};

/**
 * Countries classified as western/developed markets (pay full price)
 * All others are developing markets (pay reduced price for tier5)
 */
const WESTERN_COUNTRIES = [
  'US', 'CA', 'GB', 'AU', 'NZ', 'DE', 'FR', 'IT', 'ES', 'NL',
  'BE', 'CH', 'AT', 'SE', 'NO', 'DK', 'FI', 'IE', 'LU', 'IS',
  'JP', 'KR', 'SG', 'HK', 'AE', 'IL',
];

/**
 * Determine pricing region based on country
 */
export const getPricingRegion = (countryCode: string): 'developing' | 'western' => {
  return WESTERN_COUNTRIES.includes(countryCode) ? 'western' : 'developing';
};

/**
 * Get or create Stripe product for a tier
 * Products are created dynamically per tier
 */
const getOrCreateProduct = async (tier: string): Promise<string> => {
  const stripeClient = requireStripe();
  const productName = `ChatZone.ai ${tier} Tier`;

  // Check if product already exists
  const products = await stripeClient.products.search({
    query: `name:"${productName}"`,
  });

  if (products.data.length > 0) {
    return products.data[0].id;
  }

  // Create new product
  const product = await stripeClient.products.create({
    name: productName,
    description: `ChatZone.ai subscription - ${tier} tier`,
  });

  return product.id;
};

/**
 * Get or create price for a product
 */
const getOrCreatePrice = async (
  productId: string,
  amount: number,
  currency: string
): Promise<string> => {
  const stripeClient = requireStripe();
  
  // Check if price exists
  const prices = await stripeClient.prices.list({
    product: productId,
    active: true,
  });

  const existingPrice = prices.data.find(
    (p) => p.unit_amount === amount && p.currency === currency
  );

  if (existingPrice) {
    return existingPrice.id;
  }

  // Create new price
  const price = await stripeClient.prices.create({
    product: productId,
    unit_amount: amount,
    currency,
    recurring: {
      interval: 'month',
    },
  });

  return price.id;
};

/**
 * Create Stripe checkout session for subscription
 */
export const createCheckoutSession = async (
  userId: string,
  email: string,
  tier: string,
  ipAddress: string,
  referralCode?: string
): Promise<{ sessionId: string; url: string }> => {
  // Detect region from IP
  const countryCode = getCountryFromIP(ipAddress);
  const region = getPricingRegion(countryCode);

  // Get pricing for this tier and region
  const pricing = TIER_PRICING[region][tier as keyof typeof TIER_PRICING.developing];

  if (!pricing) {
    throw new Error(`Invalid tier: ${tier}`);
  }

  // Get or create product and price
  const productId = await getOrCreateProduct(tier);
  const priceId = await getOrCreatePrice(productId, pricing.amount, pricing.currency);

  const stripeClient = requireStripe();
  
  // Create checkout session
  const session = await stripeClient.checkout.sessions.create({
    customer_email: email,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode: 'subscription',
    success_url: `https://${process.env.FRONTEND_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `https://${process.env.FRONTEND_URL}/subscription/cancel`,
    metadata: {
      userId,
      tier,
      region,
      referralCode: referralCode || '',
    },
  });

  return {
    sessionId: session.id,
    url: session.url!,
  };
};

/**
 * Handle subscription created webhook
 */
export const handleSubscriptionCreated = async (subscription: Stripe.Subscription) => {
  const metadata = subscription.metadata;
  const userId = metadata.userId;
  const tier = metadata.tier as 'free' | 'tier5' | 'tier10' | 'tier15';

  // Update user's subscription in database (Table Storage)
  const { User } = await import('../models');
  
  await User.update(userId, {
    tier,
    stripeCustomerId: subscription.customer as string,
    stripeSubscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
  } as any);

  console.log(`✅ Subscription created for user ${userId}, tier: ${tier}`);
};

/**
 * Handle subscription updated webhook
 */
export const handleSubscriptionUpdated = async (subscription: Stripe.Subscription) => {
  const { User } = await import('../models');

  // Find user by subscription ID
  const user = await User.findByStripeSubscriptionId(subscription.id);
  
  if (user) {
    await User.update(user.rowKey, {
      subscriptionStatus: subscription.status,
    } as any);
  }

  console.log(`🔄 Subscription updated: ${subscription.id}, status: ${subscription.status}`);
};

/**
 * Handle subscription deleted/canceled webhook
 */
export const handleSubscriptionDeleted = async (subscription: Stripe.Subscription) => {
  const { User } = await import('../models');

  // Find user by subscription ID
  const user = await User.findByStripeSubscriptionId(subscription.id);
  
  if (user) {
    await User.update(user.rowKey, {
      tier: 'free',
      subscriptionStatus: 'canceled',
    } as any);
  }

  console.log(`❌ Subscription canceled: ${subscription.id}`);
};

/**
 * Handle payment failed webhook
 */
export const handlePaymentFailed = async (invoice: Stripe.Invoice) => {
  const { User } = await import('../models');

  const user = await User.findByStripeCustomerId(invoice.customer as string);

  if (user) {
    // Send email notification (implement with Azure Communication Services)
    console.log(`⚠️ Payment failed for user ${user.rowKey}`);
  }
};

/**
 * Setup Stripe Connect account for affiliate payouts
 */
export const createConnectAccount = async (
  userId: string,
  email: string,
  country: string
): Promise<{ accountId: string; onboardingUrl: string }> => {
  const stripeClient = requireStripe();
  
  // Create Stripe Connect Express account
  const account = await stripeClient.accounts.create({
    type: 'express',
    country,
    email,
    capabilities: {
      transfers: { requested: true },
    },
    metadata: {
      userId,
    },
  });

  // Create account link for onboarding
  const accountLink = await stripeClient.accountLinks.create({
    account: account.id,
    refresh_url: `https://${process.env.FRONTEND_URL}/affiliate/refresh`,
    return_url: `https://${process.env.FRONTEND_URL}/affiliate/success`,
    type: 'account_onboarding',
  });

  return {
    accountId: account.id,
    onboardingUrl: accountLink.url,
  };
};

/**
 * Calculate affiliate commission (20% for 2 months)
 */
export const calculateAffiliateCommission = (amount: number): number => {
  return Math.floor(amount * 0.2); // 20%
};

/**
 * Transfer affiliate payout
 */
export const transferAffiliatePayout = async (
  connectAccountId: string,
  amount: number,
  description: string
): Promise<string> => {
  const stripeClient = requireStripe();
  
  const transfer = await stripeClient.transfers.create({
    amount, // in cents
    currency: 'usd',
    destination: connectAccountId,
    description,
  });

  return transfer.id;
};

/**
 * Cancel subscription
 */
export const cancelSubscription = async (subscriptionId: string): Promise<void> => {
  const stripeClient = requireStripe();
  await stripeClient.subscriptions.cancel(subscriptionId);
};

/**
 * Update subscription tier
 */
export const updateSubscriptionTier = async (
  subscriptionId: string,
  newTier: string,
  ipAddress: string
): Promise<void> => {
  const stripeClient = requireStripe();
  const subscription = await stripeClient.subscriptions.retrieve(subscriptionId);

  // Detect region from IP
  const countryCode = getCountryFromIP(ipAddress);
  const region = getPricingRegion(countryCode);

  // Get new pricing
  const pricing = TIER_PRICING[region][newTier as keyof typeof TIER_PRICING.developing];

  if (!pricing) {
    throw new Error(`Invalid tier: ${newTier}`);
  }

  // Get or create product and price for new tier
  const productId = await getOrCreateProduct(newTier);
  const priceId = await getOrCreatePrice(productId, pricing.amount, pricing.currency);

  // Update subscription
  await stripeClient.subscriptions.update(subscriptionId, {
    items: [
      {
        id: subscription.items.data[0].id,
        price: priceId,
      },
    ],
    metadata: {
      ...subscription.metadata,
      tier: newTier,
    },
  });
};

/**
 * Construct webhook event from raw body
 */
export const constructWebhookEvent = (
  payload: string | Buffer,
  signature: string
): Stripe.Event => {
  const stripeClient = requireStripe();
  
  return stripeClient.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  );
};

