// User Updates Service - Real-time tier config and model updates via SSE
// Handles SSE connections for users and broadcasts updates when admin makes changes
import { Response } from 'express';

// WHAT THIS DOES: Store active SSE connections for users
// Key: userId, Value: Response object for SSE streaming
// Allows broadcasting tier config and model updates to specific users
const userConnections = new Map<string, Response>();

// WHAT THIS DOES: Store user tier mappings for efficient broadcasting
// Key: tierName, Value: Set of userIds with that tier
// Used to broadcast tier config updates to all users of a specific tier
const tierUserMap = new Map<string, Set<string>>();

/**
 * Register an SSE connection for a user
 * Called when user connects to /api/user/updates endpoint
 * Stores the connection so we can send updates when admin makes changes
 */
export function registerUserConnection(userId: string, tier: string, res: Response): void {
  // WHAT THIS DOES: Store the SSE connection for this user
  userConnections.set(userId, res);
  
  // WHAT THIS DOES: Track which tier this user belongs to for efficient broadcasting
  if (!tierUserMap.has(tier)) {
    tierUserMap.set(tier, new Set());
  }
  tierUserMap.get(tier)!.add(userId);
  
  // WHAT THIS DOES: Clean up when client disconnects
  // Removes connection from both maps to prevent memory leaks
  res.on('close', () => {
    userConnections.delete(userId);
    const tierUsers = tierUserMap.get(tier);
    if (tierUsers) {
      tierUsers.delete(userId);
      if (tierUsers.size === 0) {
        tierUserMap.delete(tier);
      }
    }
  });
  
  // WHAT THIS DOES: Send initial connection confirmation
  // Lets frontend know the connection is established
  try {
    res.write(`data: ${JSON.stringify({ type: 'connected', message: 'Real-time updates enabled' })}\n\n`);
  } catch (error) {
    console.error(`Failed to send initial connection message to user ${userId}:`, error);
  }
}

/**
 * Broadcast tier config update to all users of a specific tier
 * Called when admin updates tier configuration
 * Sends event to frontend to refetch user data (which includes tierConfig)
 */
export function broadcastTierConfigUpdate(tierName: string): void {
  const userIds = tierUserMap.get(tierName);
  if (!userIds || userIds.size === 0) return;
  
  // WHAT THIS DOES: Send tier_config_updated event to all users of this tier
  // Frontend will receive this and refetch user data to get updated tierConfig
  const event = {
    type: 'tier_config_updated',
    tierName,
    message: 'Your tier configuration has been updated. Refreshing...',
  };
  
  const data = `data: ${JSON.stringify(event)}\n\n`;
  
  userIds.forEach((userId) => {
    const res = userConnections.get(userId);
    if (res) {
      try {
        res.write(data);
      } catch (error) {
        console.error(`Failed to send tier config update to user ${userId}:`, error);
        // Remove broken connection
        userConnections.delete(userId);
        userIds.delete(userId);
      }
    }
  });
}

/**
 * Broadcast model update to all connected users
 * Called when admin creates, updates, or deletes a model
 * Sends event to frontend to refetch models list
 */
export function broadcastModelUpdate(): void {
  if (userConnections.size === 0) return;
  
  // WHAT THIS DOES: Send models_updated event to all connected users
  // Frontend will receive this and refetch models list
  const event = {
    type: 'models_updated',
    message: 'Available models have been updated. Refreshing...',
  };
  
  const data = `data: ${JSON.stringify(event)}\n\n`;
  
  userConnections.forEach((res, userId) => {
    try {
      res.write(data);
    } catch (error) {
      console.error(`Failed to send model update to user ${userId}:`, error);
      // Remove broken connection
      userConnections.delete(userId);
    }
  });
}

/**
 * Get count of active connections (for monitoring/debugging)
 */
export function getActiveConnectionCount(): number {
  return userConnections.size;
}

