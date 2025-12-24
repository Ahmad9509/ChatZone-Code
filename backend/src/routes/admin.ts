// Admin panel routes
// Admin authentication and management endpoints
import express from 'express';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { URL } from 'url';
import { User, Model, Provider, ApiKey, Conversation, SystemPrompt, TierConfig } from '../models';
import { TierService } from '../services/tierService';
import { ModelFormatter } from '../services/modelFormattingService';
import { toResponse, toResponseArray } from '../utils/responseFormatter';
import { broadcastTierConfigUpdate, broadcastModelUpdate } from '../services/userUpdatesService';

const router = express.Router();

// Admin authentication middleware
// Verifies admin JWT token (checks for role: 'admin' in JWT payload)
// This middleware is exported so it can be reused in other files if needed
export const authenticateAdmin = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'No admin token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    if (decoded.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized as admin' });
    }
    
    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid admin token' });
  }
};

// Admin login
// POST /api/admin/login
// Body: { username, password }
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Check against environment variables
    const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme123';

    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate admin JWT
    const token = jwt.sign(
      { username, role: 'admin' },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Admin login successful',
      token,
      admin: { username, role: 'admin' },
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during admin login',
    });
  }
});

// Get admin profile
// GET /api/admin/me
router.get('/me', authenticateAdmin, (req: any, res) => {
  res.json({
    admin: {
      username: req.admin.username,
      role: req.admin.role,
    },
  });
});

// Analytics overview
// GET /api/admin/analytics/overview
router.get('/analytics/overview', authenticateAdmin, async (req: any, res) => {
  try {
    // Get all users from Table Storage
    const allUsers: any[] = [];
    const usersTable = require('../config/tableStorage').usersTable;
    for await (const entity of usersTable.listEntities()) {
      allUsers.push(entity);
    }
    
    const totalUsers = allUsers.length;
    const activeSubscriptions = allUsers.filter((u: any) => u.tier !== 'free').length;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const newUsersToday = allUsers.filter((u: any) => new Date(u.createdAt) >= today).length;
    
    // Calculate MRR (Monthly Recurring Revenue) using TierService for pricing
    // Sum up the subscription prices for all paid users
    let mrr = 0;
    for (const user of allUsers) {
      if (user.tier !== 'free') {
        const price = await TierService.getTierPrice(user.tier);
        mrr += price;
      }
    }

    // Get all conversations to count messages
    const allConversations: any[] = [];
    const conversationsTable = require('../config/tableStorage').conversationsTable;
    for await (const entity of conversationsTable.listEntities()) {
      if (new Date(entity.updatedAt) >= today) {
        allConversations.push(entity);
      }
    }
    const messagesToday = allConversations.reduce((sum: number, conv: any) => sum + (conv.messageCount || 0), 0);

    // Count total messages from message table
    const messagesTable = require('../config/tableStorage').messagesTable;
    let totalMessages = 0;
    for await (const _ of messagesTable.listEntities()) {
      totalMessages++;
    }

    res.json({
      totalUsers,
      activeSubscriptions,
      newUsersToday,
      conversionRate: totalUsers > 0 ? ((activeSubscriptions / totalUsers) * 100).toFixed(1) : 0,
      mrr,
      revenueGrowth: 0, // TODO: Calculate based on historical data
      messagesToday,
      totalMessages,
      recentActivity: [], // TODO: Implement activity log
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load analytics',
    });
  }
});

// List all users
// GET /api/admin/users
router.get('/users', authenticateAdmin, async (req: any, res) => {
  try {
    const { page = 1, limit = 50, tier, search } = req.query;
    
    // Get all users from Table Storage
    const usersTable = require('../config/tableStorage').usersTable;
    const allUsers: any[] = [];
    
    for await (const entity of usersTable.listEntities()) {
      // Apply filters
      if (tier && entity.tier !== tier) continue;
      if (search) {
        const searchLower = search.toString().toLowerCase();
        const matches = 
          entity.email?.toLowerCase().includes(searchLower) ||
          entity.name?.toLowerCase().includes(searchLower) ||
          entity.username?.toLowerCase().includes(searchLower);
        if (!matches) continue;
      }
      
      allUsers.push({
        ...entity,
        _id: entity.rowKey,
        tokenUsage: {
          total: entity.tokenUsageTotal,
          thisMonth: entity.tokenUsageThisMonth,
        },
        proRepliesCount: {
          total: entity.proRepliesTotal,
          daily: entity.proRepliesDaily,
        },
      });
    }
    
    // Sort by createdAt desc
    allUsers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    const total = allUsers.length;
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedUsers = allUsers.slice(startIndex, startIndex + limitNum);

    res.json({
      users: paginatedUsers,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load users',
    });
  }
});

// Get single user
// GET /api/admin/users/:id
router.get('/users/:id', authenticateAdmin, async (req: any, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get user's conversations count from conversations table
    const conversationsTable = require('../config/tableStorage').conversationsTable;
    let conversationCount = 0;
    for await (const entity of conversationsTable.listEntities({
      queryOptions: { filter: `PartitionKey eq '${req.params.id}'` }
    })) {
      conversationCount++;
    }

    res.json({
      user: {
        ...toResponse(user),
        tokenUsage: {
          total: user.tokenUsageTotal,
          thisMonth: user.tokenUsageThisMonth,
        },
        proRepliesCount: {
          total: user.proRepliesTotal,
          daily: user.proRepliesDaily,
        },
      },
      conversationCount,
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load user',
    });
  }
});

// Update user
// PUT /api/admin/users/:id
router.put('/users/:id', authenticateAdmin, async (req: any, res) => {
  try {
    const { tier, proRepliesCount } = req.body;
    
    const updates: any = {};
    if (tier) updates.tier = tier;
    if (proRepliesCount !== undefined) updates.proRepliesTotal = proRepliesCount;

    const user = await User.update(req.params.id, updates);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User updated successfully', user });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user',
    });
  }
});

// ========== PROVIDERS ROUTES ==========

// List all providers
// GET /api/admin/providers
router.get('/providers', authenticateAdmin, async (req: any, res) => {
  try {
    const providers = await Provider.findAll();
    const normalized = toResponseArray(providers);

    res.json({ providers: normalized });
  } catch (error) {
    console.error('List providers error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load providers',
    });
  }
});

// Create provider
// POST /api/admin/providers
router.post('/providers', authenticateAdmin, async (req: any, res) => {
  try {
    const { name, baseUrl, isActive } = req.body;
    
    // Validate required fields (apiKey is now optional - will be added separately)
    if (!name || !baseUrl) {
      return res.status(400).json({ 
        message: 'Name and baseUrl are required' 
      });
    }
    
    const provider = await Provider.create({ name, baseUrl, isActive });

    res.status(201).json({
      message: 'Provider created successfully',
      provider: toResponse(provider),
    });
  } catch (error: any) {
    console.error('Create provider error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create provider',
    });
  }
});

// Update provider
// PUT /api/admin/providers/:id
router.put('/providers/:id', authenticateAdmin, async (req: any, res) => {
  try {
    const provider = await Provider.update(req.params.id, req.body);

    if (!provider) {
      return res.status(404).json({ message: 'Provider not found' });
    }

    res.json({
      message: 'Provider updated successfully',
      provider: toResponse(provider),
    });
  } catch (error) {
    console.error('Update provider error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update provider',
    });
  }
});

// Delete provider
// DELETE /api/admin/providers/:id
router.delete('/providers/:id', authenticateAdmin, async (req: any, res) => {
  try {
    const provider = await Provider.findById(req.params.id);

    if (!provider) {
      return res.status(404).json({ message: 'Provider not found' });
    }

    // Delete all models using this provider
    await Model.deleteByProviderId(req.params.id);
    
    // Delete all API keys for this provider
    await ApiKey.deleteByProviderId(req.params.id);
    
    // Delete the provider
    await Provider.delete(req.params.id);

    res.json({ message: 'Provider, API keys, and associated models deleted successfully' });
  } catch (error) {
    console.error('Delete provider error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete provider',
    });
  }
});

// ========== API KEY ROUTES ==========

// List all API keys for a provider
// GET /api/admin/providers/:providerId/api-keys
router.get('/providers/:providerId/api-keys', authenticateAdmin, async (req: any, res) => {
  try {
    const apiKeys = await ApiKey.findByProviderId(req.params.providerId);
    const normalized = toResponseArray(apiKeys);
    
    res.json({ apiKeys: normalized });
  } catch (error) {
    console.error('List API keys error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load API keys',
    });
  }
});

// List all API keys (for dropdown in model creation)
// GET /api/admin/api-keys
router.get('/api-keys', authenticateAdmin, async (req: any, res) => {
  try {
    const apiKeys = await ApiKey.findAll();
    const normalized = await Promise.all(apiKeys.map(async (key: any) => {
      const provider = await Provider.findById(key.providerId);
      return {
        ...toResponse(key),
        providerName: provider?.name || 'Unknown',
        providerBaseUrl: provider?.baseUrl || '',
      };
    }));
    
    res.json({ apiKeys: normalized });
  } catch (error) {
    console.error('List all API keys error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load API keys',
    });
  }
});

// Create API key for a provider
// POST /api/admin/providers/:providerId/api-keys
router.post('/providers/:providerId/api-keys', authenticateAdmin, async (req: any, res) => {
  try {
    const { name, apiKey } = req.body;
    
    // Validate required fields
    if (!name || !apiKey || apiKey.trim() === '') {
      return res.status(400).json({ 
        message: 'Name and apiKey are required and cannot be empty' 
      });
    }
    
    const newApiKey = await ApiKey.create({
      providerId: req.params.providerId,
      name,
      apiKey,
    });

    res.status(201).json({
      message: 'API key created successfully',
      apiKey: toResponse(newApiKey),
    });
  } catch (error: any) {
    console.error('Create API key error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create API key',
    });
  }
});

// Update API key
// PUT /api/admin/api-keys/:id
router.put('/api-keys/:id', authenticateAdmin, async (req: any, res) => {
  try {
    const { name, apiKey, isActive } = req.body;
    
    // Validate apiKey if provided
    if (apiKey !== undefined && apiKey.trim() === '') {
      return res.status(400).json({ 
        message: 'API key cannot be empty' 
      });
    }
    
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (apiKey !== undefined) updates.apiKey = apiKey;
    if (isActive !== undefined) updates.isActive = isActive;
    
    const updatedKey = await ApiKey.update(req.params.id, updates);

    res.json({
      message: 'API key updated successfully',
      apiKey: toResponse(updatedKey),
    });
  } catch (error) {
    console.error('Update API key error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update API key',
    });
  }
});

// Delete API key
// DELETE /api/admin/api-keys/:id
router.delete('/api-keys/:id', authenticateAdmin, async (req: any, res) => {
  try {
    const apiKey = await ApiKey.findById(req.params.id);

    if (!apiKey) {
      return res.status(404).json({ message: 'API key not found' });
    }

    await ApiKey.delete(req.params.id);

    res.json({ message: 'API key deleted successfully' });
  } catch (error) {
    console.error('Delete API key error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete API key',
    });
  }
});

// Fetch available models from a provider
// POST /api/admin/providers/fetch-models
router.post('/providers/fetch-models', authenticateAdmin, async (req: any, res) => {
  try {
    const { baseUrl, apiKey } = req.body;

    if (!baseUrl || !apiKey) {
      return res.status(400).json({ success: false, message: 'Provider baseUrl and apiKey are required' });
    }

    const normalizedBase = baseUrl.replace(/\/$/, '');
    const host = new URL(normalizedBase).hostname;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (host.includes('openrouter.ai')) {
      const referer = process.env.OPENROUTER_REFERRER || 'https://chatzone.ai';
      const title = process.env.OPENROUTER_APP_TITLE || 'ChatZone Admin';
      headers['HTTP-Referer'] = referer;
      headers['X-Title'] = title;
    }

    const candidatePaths = ['/models', '/v1/models', '/model/list'];
    let fetchedModels: any[] | null = null;
    let lastError: any = null;

    for (const path of candidatePaths) {
      try {
        const url = `${normalizedBase}${path}`;
        const response = await axios.get(url, { headers, timeout: 10000 });
        const data = response.data;
        const maybeModels = data?.data || data?.models || data?.result || data?.results || [];

        if (Array.isArray(maybeModels) && maybeModels.length > 0) {
          fetchedModels = maybeModels;
          break;
        }
      } catch (err) {
        lastError = err;
        continue;
      }
    }

    if (!fetchedModels) {
      const message = lastError?.response?.data?.error || lastError?.response?.data?.message || lastError?.message || 'Failed to fetch models from provider';
      return res.status(lastError?.response?.status || 500).json({ success: false, message });
    }

    const models = fetchedModels.map((model: any) => ({
      id: model.id || model.name || model.slug || model.model,
      name: model.name || model.id || model.slug || model.model,
      created: model.created || model.addedAt || null,
    })).filter((m: any) => m.id);

    res.json({ success: true, models });
  } catch (error: any) {
    console.error('Fetch models error:', error);
    const message = error?.response?.data?.message || error?.response?.data?.error || error.message || 'Failed to fetch models from provider';
    res.status(error?.response?.status || 500).json({ success: false, message });
  }
});

// ========== MODELS ROUTES ==========

// List all models with provider info
// GET /api/admin/models
// Returns all models with enriched provider and API key information (admin mode)
router.get('/models', authenticateAdmin, async (req: any, res) => {
  try {
    const models = await Model.findAll();
    
    // Use ModelFormatter to enrich models with provider and API key info
    const modelsWithProvider = await ModelFormatter.formatModels(models, 'admin');
    
    res.json({ models: modelsWithProvider });
  } catch (error) {
    console.error('List models error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load models',
    });
  }
});

// Create model
// POST /api/admin/models
// Returns newly created model with enriched provider and API key information (admin mode)
router.post('/models', authenticateAdmin, async (req: any, res) => {
  try {
    const { providerId, apiKeyId, modelId, displayName, costPer1kTokens, contextWindow, supportsVision, minTier, isActive } = req.body;
    
    // Validate required fields
    if (!providerId || !apiKeyId || !modelId || !displayName) {
      return res.status(400).json({ 
        message: 'providerId, apiKeyId, modelId, and displayName are required' 
      });
    }
    
    const model = await Model.create(req.body);
    
    // Use ModelFormatter to enrich the new model with provider and API key info
    const formattedModel = await ModelFormatter.formatModel(model, 'admin');
    
    // WHAT THIS DOES: Broadcast model update to all connected users
    // Users connected to /api/user/updates will receive models_updated event
    // Frontend will refetch models list to show new model
    broadcastModelUpdate();
    
    res.status(201).json({
      message: 'Model created successfully',
      model: formattedModel,
    });
  } catch (error: any) {
    console.error('Create model error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create model',
    });
  }
});

// Update model
// PUT /api/admin/models/:id
// Returns updated model with enriched provider and API key information (admin mode)
router.put('/models/:id', authenticateAdmin, async (req: any, res) => {
  try {
    const model = await Model.update(req.params.id, req.body);

    if (!model) {
      return res.status(404).json({ message: 'Model not found' });
    }

    // Use ModelFormatter to enrich the updated model with provider and API key info
    const formattedModel = await ModelFormatter.formatModel(model, 'admin');
    
    // WHAT THIS DOES: Broadcast model update to all connected users
    // Users connected to /api/user/updates will receive models_updated event
    // Frontend will refetch models list to show updated model
    broadcastModelUpdate();
    
    res.json({
      message: 'Model updated successfully',
      model: formattedModel,
    });
  } catch (error) {
    console.error('Update model error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update model',
    });
  }
});

// Delete model
// DELETE /api/admin/models/:id
router.delete('/models/:id', authenticateAdmin, async (req: any, res) => {
  try {
    const model = await Model.findById(req.params.id);

    if (!model) {
      return res.status(404).json({ message: 'Model not found' });
    }

    await Model.delete(req.params.id);

    // WHAT THIS DOES: Broadcast model update to all connected users
    // Users connected to /api/user/updates will receive models_updated event
    // Frontend will refetch models list to remove deleted model
    broadcastModelUpdate();

    res.json({ message: 'Model deleted successfully' });
  } catch (error) {
    console.error('Delete model error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete model',
    });
  }
});

// Get tier configurations
// GET /api/admin/tiers
router.get('/tiers', authenticateAdmin, async (req: any, res) => {
  try {
    // Fetch from TierConfig table storage
    const tiers = await TierConfig.findAll();
    
    // If no tiers exist, seed defaults
    if (tiers.length === 0) {
      await TierConfig.seedDefaults();
      const seededTiers = await TierConfig.findAll();
      return res.json({ tiers: toResponseArray(seededTiers) });
    }
    
    res.json({ tiers: toResponseArray(tiers) });
  } catch (error) {
    console.error('Get tiers error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load tier configurations',
    });
  }
});

// Update tier configuration
// PUT /api/admin/tiers/:tierName
router.put('/tiers/:tierName', authenticateAdmin, async (req: any, res) => {
  try {
    const { tierName } = req.params;
    const updates = req.body;

    // WHAT THIS DOES: Update tier config in Table Storage
    const tier = await TierConfig.update(tierName, updates);
    
    // WHAT THIS DOES: Clear TierService cache for this tier
    // Ensures next request gets fresh data from database
    TierService.clearCache();
    
    // WHAT THIS DOES: Broadcast tier config update to all users of this tier
    // Users connected to /api/user/updates will receive tier_config_updated event
    // Frontend will refetch user data to get updated tierConfig
    broadcastTierConfigUpdate(tierName);
    
    res.json({
      message: 'Tier configuration updated successfully',
      tier: toResponse(tier),
    });
  } catch (error) {
    console.error('Update tier error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update tier configuration',
    });
  }
});

// ========== SYSTEM PROMPTS ROUTES ==========

// List all system prompts
// GET /api/admin/system-prompts
router.get('/system-prompts', authenticateAdmin, async (req: any, res) => {
  try {
    const systemPrompts = await SystemPrompt.findAll();
    const normalized = toResponseArray(systemPrompts);

    res.json({ systemPrompts: normalized });
  } catch (error) {
    console.error('List system prompts error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load system prompts',
    });
  }
});

// Create system prompt
// POST /api/admin/system-prompts
router.post('/system-prompts', authenticateAdmin, async (req: any, res) => {
  try {
    const systemPrompt = await SystemPrompt.create(req.body);

    res.status(201).json({
      message: 'System prompt created successfully',
      systemPrompt: toResponse(systemPrompt),
    });
  } catch (error: any) {
    console.error('Create system prompt error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create system prompt',
    });
  }
});

// Update system prompt
// PUT /api/admin/system-prompts/:id
router.put('/system-prompts/:id', authenticateAdmin, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ message: 'Content is required' });
    }

    const systemPrompt = await SystemPrompt.update(id as 'master' | 'proSearch', content);

    res.json({
      message: 'System prompt updated successfully',
      systemPrompt: toResponse(systemPrompt),
    });
  } catch (error: any) {
    console.error('Update system prompt error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update system prompt',
    });
  }
});

// Delete system prompt
// DELETE /api/admin/system-prompts/:id
router.delete('/system-prompts/:id', authenticateAdmin, async (req: any, res) => {
  try {
    const { id } = req.params;
    const systemPrompt = await SystemPrompt.findByType(id as 'master' | 'proSearch');

    if (!systemPrompt) {
      return res.status(404).json({ message: 'System prompt not found' });
    }

    await SystemPrompt.delete(id as 'master' | 'proSearch');

    res.json({ message: 'System prompt deleted successfully' });
  } catch (error) {
    console.error('Delete system prompt error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete system prompt',
    });
  }
});

export default router;

