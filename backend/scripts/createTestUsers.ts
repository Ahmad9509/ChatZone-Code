// Script to create test users for each tier
// Run with: npx ts-node scripts/createTestUsers.ts

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// User Schema (simplified for script)
const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: String,
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  tier: { type: String, enum: ['free', 'tier5', 'tier10', 'tier15'], default: 'free' },
  oauthProvider: { type: String, enum: ['google', 'twitter', 'email'], default: 'email' },
  oauthId: { type: String, default: null },
  profilePicture: String,
  referralCode: String,
  tokenUsage: {
    total: { type: Number, default: 0 },
    thisMonth: { type: Number, default: 0 },
  },
  messageCount: { type: Number, default: 0 },
  proRepliesCount: {
    total: { type: Number, default: 0 },
    daily: { type: Number, default: 0 },
  },
  subscriptionStatus: { type: String, default: 'inactive' },
  stripeCustomerId: String,
  stripeSubscriptionId: String,
  referralStats: {
    totalReferrals: { type: Number, default: 0 },
    activeReferrals: { type: Number, default: 0 },
  },
  affiliateEarnings: {
    total: { type: Number, default: 0 },
    pending: { type: Number, default: 0 },
  },
  lastLoginAt: Date,
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model('User', UserSchema);

const testUsers = [
  {
    email: 'free@test.com',
    password: 'Test123!',
    name: 'Free Tier User',
    username: 'freetier',
    tier: 'free',
  },
  {
    email: 'tier5@test.com',
    password: 'Test123!',
    name: 'Tier 5 User',
    username: 'tier5user',
    tier: 'tier5',
    subscriptionStatus: 'active',
  },
  {
    email: 'tier10@test.com',
    password: 'Test123!',
    name: 'Tier 10 User',
    username: 'tier10user',
    tier: 'tier10',
    subscriptionStatus: 'active',
  },
  {
    email: 'tier15@test.com',
    password: 'Test123!',
    name: 'Tier 15 User',
    username: 'tier15user',
    tier: 'tier15',
    subscriptionStatus: 'active',
  },
];

async function createTestUsers() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_CONNECTION_STRING || process.env.MONGODB_URI || process.env.COSMOS_DB_CONNECTION_STRING;
    if (!mongoUri) {
      console.error('Available env vars:', Object.keys(process.env).filter(k => k.includes('MONGO') || k.includes('DATA') || k.includes('COSMOS')));
      throw new Error('MongoDB URI not found in environment variables');
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Create test users
    for (const userData of testUsers) {
      try {
        // Check if user already exists
        const existingUser = await User.findOne({ email: userData.email });
        if (existingUser) {
          console.log(`⚠️  User ${userData.email} already exists, skipping...`);
          continue;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(userData.password, 10);

        // Create user
        const user = await User.create({
          ...userData,
          password: hashedPassword,
          referralCode: userData.username,
          oauthProvider: 'email',
          oauthId: null,
        });

        console.log(`✅ Created user: ${userData.email} (${userData.tier})`);
      } catch (error: any) {
        console.error(`❌ Failed to create ${userData.email}:`, error.message);
      }
    }

    console.log('\n✅ All test users created successfully!');
    console.log('\n📧 Test User Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    testUsers.forEach((user) => {
      console.log(`\n${user.tier.toUpperCase()} TIER:`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Password: ${user.password}`);
    });
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createTestUsers();

