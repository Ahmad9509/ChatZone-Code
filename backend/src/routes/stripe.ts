// Stripe routes - subscriptions, webhooks, and affiliate payouts
// Production-ready Stripe integration for Azure
import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../middleware/auth';
import * as stripeService from '../services/stripeService';
import { User } from '../models';
import { getCountryFromIP } from '../services/geolocationService';

const router = Router();

/**
 * Get pricing based on user's IP address
 * Returns region and pricing for all tiers
 */
router.get('/pricing', async (req: Request, res: Response) => {
  try {
    // Extract IP address (works for web and mobile)
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() 
      || req.headers['x-real-ip'] as string
      || req.ip 
      || req.connection?.remoteAddress 
      || 'unknown';

    console.log(`💰 Pricing request from IP: ${ipAddress}`);

    // Get country and region
    const countryCode = getCountryFromIP(ipAddress);
    const region = stripeService.getPricingRegion(countryCode);

    // Return pricing for all tiers based on region
    const pricing = {
      region,
      countryCode,
      tiers: {
        tier5: {
          name: 'Basic',
          price: region === 'developing' ? 3 : 5,
          currency: 'USD',
          interval: 'month',
          tierKey: 'tier5'
        },
        tier10: {
          name: 'Pro',
          price: 10,
          currency: 'USD',
          interval: 'month',
          tierKey: 'tier10'
        },
        tier15: {
          name: 'Ultra',
          price: 15,
          currency: 'USD',
          interval: 'month',
          tierKey: 'tier15'
        }
      }
    };

    res.json({
      success: true,
      ...pricing
    });
  } catch (error: any) {
    console.error('Pricing endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to determine pricing',
      // Fallback to western pricing on error
      region: 'western',
      tiers: {
        tier5: { name: 'Basic', price: 5, currency: 'USD', interval: 'month', tierKey: 'tier5' },
        tier10: { name: 'Pro', price: 10, currency: 'USD', interval: 'month', tierKey: 'tier10' },
        tier15: { name: 'Ultra', price: 15, currency: 'USD', interval: 'month', tierKey: 'tier15' }
      }
    });
  }
});

/**
 * Create checkout session for subscription
 */
router.post('/create-checkout', authenticateJWT as any, async (req: any, res: Response) => {
  try {
    const user = req.user;
    const { tier } = req.body;

    // Validate tier
    const validTiers = ['tier5', 'tier10', 'tier15'];
    if (!validTiers.includes(tier)) {
      res.status(400).json({
        success: false,
        error: 'Invalid tier. Must be tier5, tier10, or tier15',
      });
      return;
    }

    // Get user's IP address
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    // Get referral code if user was referred
    const referralCode = user.referredBy;

    // Create checkout session
    const session = await stripeService.createCheckoutSession(
      user._id.toString(),
      user.email,
      tier,
      ipAddress as string,
      referralCode
    );

    res.json({
      success: true,
      sessionId: session.sessionId,
      url: session.url,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Stripe webhook endpoint
 * Handles subscription lifecycle events
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      res.status(400).json({ error: 'No signature' });
      return;
    }

    // Construct event from webhook payload
    const event = stripeService.constructWebhookEvent(req.body, signature);

    // Handle different event types
    switch (event.type) {
      case 'customer.subscription.created':
        await stripeService.handleSubscriptionCreated(event.data.object as any);
        break;

      case 'customer.subscription.updated':
        await stripeService.handleSubscriptionUpdated(event.data.object as any);
        break;

      case 'customer.subscription.deleted':
        await stripeService.handleSubscriptionDeleted(event.data.object as any);
        break;

      case 'invoice.payment_failed':
        await stripeService.handlePaymentFailed(event.data.object as any);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Cancel subscription
 */
router.post('/cancel-subscription', authenticateJWT as any, async (req: any, res: Response) => {
  try {
    const user = req.user;

    if (!user.stripeSubscriptionId) {
      res.status(400).json({
        success: false,
        error: 'No active subscription',
      });
      return;
    }

    await stripeService.cancelSubscription(user.stripeSubscriptionId);

    // Update user
    user.tier = 'free';
    user.subscriptionStatus = 'canceled';
    await user.save();

    res.json({
      success: true,
      message: 'Subscription canceled',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Update subscription tier
 */
router.post('/update-tier', authenticateJWT as any, async (req: any, res: Response) => {
  try {
    const user = req.user;
    const { newTier } = req.body;

    if (!user.stripeSubscriptionId) {
      res.status(400).json({
        success: false,
        error: 'No active subscription',
      });
      return;
    }

    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    await stripeService.updateSubscriptionTier(
      user.stripeSubscriptionId,
      newTier,
      ipAddress as string
    );

    // Update user
    user.tier = newTier;
    await user.save();

    res.json({
      success: true,
      message: 'Subscription updated',
      newTier,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Setup affiliate payout account (Stripe Connect)
 */
router.post('/affiliate/setup', authenticateJWT as any, async (req: any, res: Response) => {
  try {
    const user = req.user;
    const { country } = req.body;

    if (!country) {
      res.status(400).json({
        success: false,
        error: 'Country code required',
      });
      return;
    }

    const result = await stripeService.createConnectAccount(
      user._id.toString(),
      user.email,
      country
    );

    // Save Connect account ID
    user.stripeConnectAccountId = result.accountId;
    await user.save();

    res.json({
      success: true,
      onboardingUrl: result.onboardingUrl,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get subscription status
 */
router.get('/subscription-status', authenticateJWT as any, async (req: any, res: Response) => {
  try {
    const user = req.user;

    res.json({
      success: true,
      tier: user.tier,
      subscriptionStatus: user.subscriptionStatus,
      stripeCustomerId: user.stripeCustomerId,
      hasActiveSubscription: user.tier !== 'free',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get affiliate earnings
 */
router.get('/affiliate/earnings', authenticateJWT as any, async (req: any, res: Response) => {
  try {
    const user = req.user;

    // Get referrals from Table Storage
    const usersTable = require('../config/tableStorage').usersTable;
    const referrals: any[] = [];
    for await (const entity of usersTable.listEntities()) {
      if (entity.referredBy === user.username) {
        referrals.push(entity);
      }
    }

    // Calculate earnings (would come from a separate Referral model in production)
    const totalEarnings = user.affiliateEarnings?.total || 0;
    const pendingPayout = user.affiliateEarnings?.pending || 0;

    res.json({
      success: true,
      totalReferrals: user.referralStats?.totalReferrals || 0,
      activeReferrals: referrals.filter((r) => r.tier !== 'free').length,
      totalEarnings,
      pendingPayout,
      paidOut: totalEarnings - pendingPayout,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;

