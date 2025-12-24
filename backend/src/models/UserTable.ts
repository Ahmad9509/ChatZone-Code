// User model using Azure Table Storage
// Replaces MongoDB User model
import { usersTable } from '../config/tableStorage';
import bcrypt from 'bcryptjs';

const TEST_USER_EMAILS = new Set([
  'free.local@test.com',
  'tier5.local@test.com',
  'tier10.local@test.com',
  'tier15.local@test.com',
]);

const isTestUserEmail = (email: string): boolean => email.endsWith('.local@test.com');

export interface IUser {
  partitionKey: string; // Email
  rowKey: string; // User ID (UUID)
  email: string;
  password?: string;
  name: string;
  username: string;
  tier: 'free' | 'tier5' | 'tier10' | 'tier15';
  oauthProvider?: 'google' | 'twitter' | 'email';
  oauthId?: string;
  profilePicture?: string;
  referralCode: string;
  tokenUsageTotal: number;
  tokenUsageThisMonth: number;
  messageCount: number;
  proRepliesTotal: number;
  proRepliesDaily: number;
  deepResearchUsageThisMonth: number; // Track Deep Research usage for monthly limits
  deepResearchUsageTotal: number;     // Total Deep Research usage (all time)
  designsCreatedThisMonth: number;    // Track Designs created for monthly limits
  designsCreatedTotal: number;        // Total Designs created (all time)
  presentationsCreatedThisMonth: number; // Track Presentations created for monthly limits
  presentationsCreatedTotal: number;     // Total Presentations created (all time)
  aiImagesGeneratedThisMonth: number;    // Track AI image generations for monthly limits
  aiImagesGeneratedTotal: number;        // Total AI images generated (all time)
  subscriptionStatus: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripeConnectAccountId?: string;
  referralStatsTotal: number;
  referralStatsActive: number;
  affiliateEarningsTotal: number;
  affiliateEarningsPending: number;
  referredBy?: string;
  lastLoginAt?: Date;
  preferredModelId?: string; // User's default model preference - syncs across all devices
  newChatDraft?: string; // WHAT THIS DOES: Stores draft text for new chat window (when no conversation exists yet) - persists across devices
  createdAt: Date;
}

export class UserTable {
  static async create(userData: Partial<IUser>): Promise<IUser> {
    const existingUser = await this.findByEmail(userData.email!);

    if (existingUser) {
      if (TEST_USER_EMAILS.has(userData.email!)) {
        const updated = {
          ...existingUser,
          ...userData,
          password: userData.password || existingUser.password,
          tier: (userData.tier as any) || existingUser.tier,
          subscriptionStatus: userData.subscriptionStatus || existingUser.subscriptionStatus,
          name: userData.name || existingUser.name,
          username: existingUser.username,
        } as IUser;

        await usersTable.updateEntity(updated as any, 'Merge');
        return updated;
      }

      throw new Error(`User with email ${userData.email} already exists`);
    }

    const userId = crypto.randomUUID();
    const user: IUser = {
      partitionKey: userData.email!,
      rowKey: userId,
      email: userData.email!,
      name: userData.name!,
      username: userData.username!,
      tier: userData.tier || 'free',
      referralCode: userData.referralCode || userData.username!,
      tokenUsageTotal: 0,
      tokenUsageThisMonth: 0,
      messageCount: 0,
      proRepliesTotal: 0,
      proRepliesDaily: 0,
      deepResearchUsageThisMonth: 0,
      deepResearchUsageTotal: 0,
      designsCreatedThisMonth: 0,
      designsCreatedTotal: 0,
      presentationsCreatedThisMonth: 0,
      presentationsCreatedTotal: 0,
      aiImagesGeneratedThisMonth: 0,
      aiImagesGeneratedTotal: 0,
      subscriptionStatus: 'inactive',
      referralStatsTotal: 0,
      referralStatsActive: 0,
      affiliateEarningsTotal: 0,
      affiliateEarningsPending: 0,
      createdAt: new Date(),
      ...userData,
    };

    await usersTable.createEntity(user as any);
    return user;
  }

  static async findByEmail(email: string): Promise<IUser | null> {
    // Query by partitionKey since email is the partition key
    const entities = usersTable.listEntities({
      queryOptions: { filter: `PartitionKey eq '${email}'` }
    });
    
    for await (const entity of entities) {
      return entity as unknown as IUser;
    }
    return null;
  }

  static async findById(userId: string): Promise<IUser | null> {
    // Need to query by rowKey
    const entities = usersTable.listEntities({
      queryOptions: { filter: `RowKey eq '${userId}'` }
    });
    
    for await (const entity of entities) {
      return entity as unknown as IUser;
    }
    return null;
  }

  static async findByOAuth(provider: string, oauthId: string): Promise<IUser | null> {
    const entities = usersTable.listEntities({
      queryOptions: { filter: `oauthProvider eq '${provider}' and oauthId eq '${oauthId}'` }
    });
    
    for await (const entity of entities) {
      return entity as unknown as IUser;
    }
    return null;
  }

  static async update(userId: string, updates: Partial<IUser>): Promise<IUser> {
    const user = await this.findById(userId);
    if (!user) throw new Error('User not found');

    const updated = { ...user, ...updates };
    await usersTable.updateEntity(updated as any, 'Merge');
    return updated;
  }

  static async findByStripeCustomerId(customerId: string): Promise<IUser | null> {
    const entities = usersTable.listEntities({
      queryOptions: { filter: `stripeCustomerId eq '${customerId}'` }
    });
    
    for await (const entity of entities) {
      return entity as unknown as IUser;
    }
    return null;
  }

  static async findByStripeSubscriptionId(subscriptionId: string): Promise<IUser | null> {
    const entities = usersTable.listEntities({
      queryOptions: { filter: `stripeSubscriptionId eq '${subscriptionId}'` }
    });
    
    for await (const entity of entities) {
      return entity as unknown as IUser;
    }
    return null;
  }

  static async generateUniqueUsername(baseName: string): Promise<string> {
    let username = baseName.toLowerCase().replace(/[^a-z0-9]/g, '');
    let counter = 0;

    while (true) {
      const testUsername = counter === 0 ? username : `${username}${counter}`;
      const entities = usersTable.listEntities({
        queryOptions: { filter: `username eq '${testUsername}'` }
      });

      let exists = false;
      for await (const _ of entities) {
        exists = true;
        break;
      }

      if (!exists) return testUsername;
      counter++;
    }
  }
}
