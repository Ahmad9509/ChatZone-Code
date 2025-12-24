// Passport OAuth configuration for Google and Twitter
// Production-ready authentication for Azure deployment
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as TwitterStrategy } from 'passport-twitter';
import { User, IUser } from '../models';

/**
 * Configure Google OAuth Strategy
 * Callback URL points to Azure backend API
 * Only initialize if credentials are provided
 */
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${process.env.BACKEND_API_URL}/api/auth/google/callback`,
        scope: ['profile', 'email'],
      },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user already exists
        let user = await User.findByOAuth('google', profile.id);

        if (user) {
          // Update last login
          await User.update(user.rowKey, { lastLoginAt: new Date() });
          return done(null, user);
        }

        // Create new user
        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(new Error('No email found in Google profile'));
        }

        // Generate unique username from name
        const baseName = profile.displayName || email.split('@')[0];
        const username = await User.generateUniqueUsername(baseName);

        user = await User.create({
          email,
          name: profile.displayName || 'User',
          username,
          profilePicture: profile.photos?.[0]?.value,
          oauthProvider: 'google',
          oauthId: profile.id,
          referralCode: username,
          tier: 'free',
        });

        return done(null, user);
      } catch (error) {
        return done(error as Error);
      }
    }
    )
  );
  console.log('✅ Google OAuth configured');
} else {
  console.log('⚠️  Google OAuth not configured - GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET missing');
}

/**
 * Configure Twitter OAuth Strategy
 * Callback URL points to Azure backend API
 * Only initialize if credentials are provided
 */
if (process.env.TWITTER_CONSUMER_KEY && process.env.TWITTER_CONSUMER_SECRET) {
  passport.use(
    new TwitterStrategy(
      {
        consumerKey: process.env.TWITTER_CONSUMER_KEY,
        consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
        callbackURL: `${process.env.BACKEND_API_URL}/api/auth/twitter/callback`,
        includeEmail: true,
      },
    async (token: string, tokenSecret: string, profile: any, done: any) => {
      try {
        // Check if user already exists
        let user = await User.findByOAuth('twitter', profile.id);

        if (user) {
          // Update last login
          await User.update(user.rowKey, { lastLoginAt: new Date() });
          return done(null, user);
        }

        // Create new user
        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(new Error('No email found in Twitter profile. Please ensure email is public.'));
        }

        // Generate unique username from Twitter username
        const baseName = profile.username || email.split('@')[0];
        const username = await User.generateUniqueUsername(baseName);

        user = await User.create({
          email,
          name: profile.displayName || 'User',
          username,
          profilePicture: profile.photos?.[0]?.value,
          oauthProvider: 'twitter',
          oauthId: profile.id,
          referralCode: username,
          tier: 'free',
        });

        return done(null, user);
      } catch (error) {
        return done(error as Error);
      }
    }
    )
  );
  console.log('✅ Twitter OAuth configured');
} else {
  console.log('⚠️  Twitter OAuth not configured - TWITTER_CONSUMER_KEY or TWITTER_CONSUMER_SECRET missing');
}

/**
 * Serialize user for session
 */
passport.serializeUser((user: any, done) => {
  done(null, user.rowKey);
});

/**
 * Deserialize user from session
 */
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});

export default passport;

