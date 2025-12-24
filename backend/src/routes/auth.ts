// Authentication routes - Google and Twitter OAuth + Email/Password
// Production routes for Azure deployment
import { Router, Request, Response } from 'express';
import passport from '../config/passport';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User, TierConfig } from '../models';
import { authenticateJWT } from '../middleware/auth';
import { usersTable } from '../config/tableStorage';
import { toResponse } from '../utils/responseFormatter';

const router = Router();

/**
 * Generate JWT token for user
 */
const generateToken = (userId: string): string => {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, {
    expiresIn: '7d', // Token expires in 7 days
  });
};

/**
 * Google OAuth - Initiate
 * Redirects to Google OAuth consent screen
 */
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
  })
);

/**
 * Google OAuth - Callback
 * Handles redirect from Google after user authorization
 */
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${process.env.FRONTEND_URL}/login?error=auth_failed` }),
  (req: Request, res: Response) => {
    const user = req.user as any;

    // Generate JWT token
    const token = generateToken(String(user.rowKey));

    // Redirect to frontend with token
    res.redirect(`https://${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
  }
);

/**
 * Twitter OAuth - Initiate
 * Redirects to Twitter OAuth consent screen
 */
router.get('/twitter', passport.authenticate('twitter'));

/**
 * Twitter OAuth - Callback
 * Handles redirect from Twitter after user authorization
 */
router.get(
  '/twitter/callback',
  passport.authenticate('twitter', { session: false, failureRedirect: `${process.env.FRONTEND_URL}/login?error=auth_failed` }),
  (req: Request, res: Response) => {
    const user = req.user as any;

    // Generate JWT token
    const token = generateToken(String(user.rowKey));

    // Redirect to frontend with token
  res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
  }
);

/**
 * Get current authenticated user
 * Returns user profile data
 */
router.get('/me', authenticateJWT as any, async (req: any, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
      return;
    }

    // Fetch tier configuration for user's tier
    const tierConfig = await TierConfig.findByTierName(req.user.tier);

    // Return user data without sensitive fields
    const userData = {
      ...toResponse(req.user),
      tokenUsage: {
        total: req.user.tokenUsageTotal,
        thisMonth: req.user.tokenUsageThisMonth,
      },
      messageCount: req.user.messageCount,
      proRepliesCount: {
        total: req.user.proRepliesTotal,
        daily: req.user.proRepliesDaily,
      },
      tierConfig: tierConfig ? toResponse(tierConfig) : null,
      newChatDraft: req.user.newChatDraft || '', // WHAT THIS DOES: Include draft text for new chat window
    };

    res.json({
      success: true,
      user: userData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user data',
    });
  }
});

/**
 * Logout
 * Invalidates session (token is removed client-side)
 */
router.post('/logout', authenticateJWT as any, (req: any, res: Response) => {
  res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

/**
 * Check referral code validity
 * Used when user signs up with referral link
 */
router.get('/referral/:code', async (req: Request, res: Response) => {
  try {
    const { code } = req.params;

    // Find user by referral code (username)
    const entities = usersTable.listEntities({
      queryOptions: { filter: `username eq '${code}'` }
    });

    let referrer: any = null;
    for await (const entity of entities) {
      referrer = entity;
      break;
    }

    if (!referrer) {
      res.json({
        success: false,
        valid: false,
        message: 'Invalid referral code',
      });
      return;
    }

    res.json({
      success: true,
      valid: true,
      referrer: {
        name: referrer.name,
        username: referrer.username,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to validate referral code',
    });
  }
});

/**
 * Email/Password Registration
 * Creates new user account with email and password
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name, referralCode } = req.body;

    // Validation
    if (!email || !password || !name) {
      res.status(400).json({
        success: false,
        error: 'Email, password, and name are required',
      });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters',
      });
      return;
    }

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      res.status(400).json({
        success: false,
        error: 'Email already registered',
      });
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate unique username from name
    const username = await User.generateUniqueUsername(name);

    // Check if referred by someone
    let referredBy: string | undefined = undefined;
    if (referralCode) {
      const entities = usersTable.listEntities({
        queryOptions: { filter: `username eq '${referralCode}'` }
      });

      for await (const entity of entities) {
        referredBy = entity.username as string;
        break;
      }
    }

    // Create user
    const newUser = await User.create({
      email,
      password: hashedPassword,
      name,
      username,
      oauthProvider: 'email',
      referralCode: username,
      referredBy,
    });

    // If referred, update referrer stats
    if (referredBy) {
      const entities = usersTable.listEntities({
        queryOptions: { filter: `username eq '${referredBy}'` }
      });

      for await (const entity of entities) {
        await User.update(entity.rowKey as string, {
          referralStatsTotal: ((entity.referralStatsTotal as number) || 0) + 1
        });
        break;
      }
    }

    // Generate JWT token
    const token = generateToken(String(newUser.rowKey));

    res.status(201).json({
      success: true,
      token,
      user: {
        ...toResponse(newUser),
        preferredModelId: newUser.preferredModelId, // User's preferred AI model
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create account',
    });
  }
});

/**
 * Email/Password Login
 * Authenticates user with email and password
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    console.log('🔐 Login attempt:', { email, hasPassword: !!password });

    // Validation
    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: 'Email and password are required',
      });
      return;
    }

    // Find user
    console.log('  Searching for user...');
    const user = await User.findByEmail(email);
    console.log('  User found:', user ? `YES (${user.name})` : 'NO');

    if (!user || !user.password) {
      console.log('  ❌ User not found or no password');
      res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
      return;
    }

    // Check password
    console.log('  Comparing passwords...');
    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log('  Password valid:', isPasswordValid);

    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
      return;
    }

    // Update last login
    await User.update(user.rowKey, { lastLoginAt: new Date() });

    // Generate JWT token
    const token = generateToken(String(user.rowKey));

    console.log('  ✅ Login successful');

    res.json({
      success: true,
      token,
      user: {
        ...toResponse(user),
        preferredModelId: user.preferredModelId, // User's preferred AI model
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to login',
    });
  }
});

export default router;

