import bcrypt from 'bcryptjs';
import { User } from '../models';

const TEST_USERS = [
  {
    email: 'free.local@test.com',
    name: 'Free Tier Tester',
    tier: 'free' as const,
    password: 'Test123!',
  },
  {
    email: 'tier5.local@test.com',
    name: 'Tier 5 Tester',
    tier: 'tier5' as const,
    password: 'Test123!',
  },
  {
    email: 'tier10.local@test.com',
    name: 'Tier 10 Tester',
    tier: 'tier10' as const,
    password: 'Test123!',
  },
  {
    email: 'tier15.local@test.com',
    name: 'Tier 15 Tester',
    tier: 'tier15' as const,
    password: 'Test123!',
  },
];

export async function seedTestUsers() {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  if (process.env.ENABLE_TEST_USERS?.toLowerCase() !== 'true') {
    return;
  }

  console.log('👥 Checking test users...');

  for (const testUser of TEST_USERS) {
    try {
      const existing = await User.findByEmail(testUser.email);
      const hashedPassword = await bcrypt.hash(testUser.password, 10);

      if (existing) {
        await User.update(existing.rowKey, {
          name: testUser.name,
          password: hashedPassword,
          tier: testUser.tier,
          subscriptionStatus: testUser.tier === 'free' ? 'inactive' : 'active',
        });

        console.log(`♻️  Refreshed test user ${testUser.email} (${testUser.tier})`);
        continue;
      }

      const username = await User.generateUniqueUsername(testUser.name);

      await User.create({
        email: testUser.email,
        name: testUser.name,
        username,
        password: hashedPassword,
        tier: testUser.tier,
        oauthProvider: 'email',
        subscriptionStatus: testUser.tier === 'free' ? 'inactive' : 'active',
      });

      console.log(`✅ Seeded test user ${testUser.email} (${testUser.tier})`);
    } catch (error) {
      const errorMessage = (error as Error).message;
      // Only log if it's NOT a duplicate email error
      if (!errorMessage.includes('already exists')) {
        console.error(`❌ Failed to seed ${testUser.email}:`, errorMessage);
      }
    }
  }
}
