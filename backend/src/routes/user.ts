// User preferences routes
// Handles user-specific settings like preferred model

import { Router, Response } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { UserTable } from '../models/UserTable';
import { ModelTable, IModel } from '../models/ModelTable';
import { registerUserConnection } from '../services/userUpdatesService';
import jwt from 'jsonwebtoken';
import { User } from '../models';

const router = Router();

/**
 * PATCH /user/preferences
 * Update user preferences (e.g., preferred model)
 */
router.patch('/preferences', authenticateJWT as any, async (req: any, res: Response) => {
  try {
    const user = req.user;
    const { preferredModelId } = req.body;

    // Validate that preferredModelId is provided
    if (!preferredModelId) {
      res.status(400).json({
        success: false,
        error: 'preferredModelId is required',
      });
      return;
    }

    // Validate that the model exists and user has access to it
    const model = await ModelTable.findById(preferredModelId);
    
    if (!model) {
      res.status(404).json({
        success: false,
        error: 'Model not found',
      });
      return;
    }

    if (!model.isActive) {
      res.status(400).json({
        success: false,
        error: 'Model is not active',
      });
      return;
    }

    // Check if user's tier has access to this model
    const availableModels = await ModelTable.findByTier(user.tier);
    const hasAccess = availableModels.some((m: IModel) => m.rowKey === preferredModelId);
    
    if (!hasAccess) {
      res.status(403).json({
        success: false,
        error: 'Model not available for your tier',
      });
      return;
    }

    // Update user's preferred model
    await UserTable.update(user.rowKey, {
      preferredModelId,
    });

    res.json({
      success: true,
      message: 'Preference updated successfully',
      preferredModelId,
    });
  } catch (error: any) {
    console.error('Update user preferences error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update preferences',
    });
  }
});

/**
 * GET /user/updates
 * SSE endpoint for real-time tier config and model updates
 * Users connect to this endpoint to receive updates when admin makes changes
 * Connection persists until user disconnects or logs out
 * NOTE: Uses query parameter for token since EventSource doesn't support custom headers
 */
router.get('/updates', async (req: any, res: Response) => {
  // WHAT THIS DOES: Set up SSE headers FIRST before any error handling
  // This ensures EventSource can properly handle errors in SSE format
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  
  try {
    // WHAT THIS DOES: Get token from query parameter (EventSource limitation)
    // EventSource API doesn't support custom headers, so we use query parameter
    const token = req.query.token || req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      // WHAT THIS DOES: Send error in SSE format instead of JSON
      // EventSource expects SSE format, so we must send errors this way
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Authentication required' })}\n\n`);
      return;
    }

    // WHAT THIS DOES: Verify JWT token and get user
    let decoded: { userId: string };
    let user: any;
    
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
      user = await User.findById(decoded.userId);
    } catch (jwtError: any) {
      // WHAT THIS DOES: Send JWT error in SSE format
      const errorMessage = jwtError instanceof jwt.TokenExpiredError 
        ? 'Token expired' 
        : jwtError instanceof jwt.JsonWebTokenError
        ? 'Invalid token'
        : 'Authentication failed';
      res.write(`data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`);
      return;
    }
    
    if (!user) {
      // WHAT THIS DOES: Send user not found error in SSE format
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'User not found' })}\n\n`);
      return;
    }
    
    // WHAT THIS DOES: Register this user's connection for real-time updates
    // When admin updates tier config or models, this connection will receive events
    registerUserConnection(user.rowKey, user.tier, res);
    
    // WHAT THIS DOES: Keep connection alive with periodic heartbeat
    // Prevents connection timeout and allows detecting disconnected clients
    const heartbeatInterval = setInterval(() => {
      try {
        res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: Date.now() })}\n\n`);
      } catch (error) {
        // Connection closed, stop heartbeat
        clearInterval(heartbeatInterval);
      }
    }, 30000); // Send heartbeat every 30 seconds
    
    // WHAT THIS DOES: Clean up when client disconnects
    // Clears heartbeat interval and connection is removed by registerUserConnection cleanup
    req.on('close', () => {
      clearInterval(heartbeatInterval);
    });
  } catch (error: any) {
    // WHAT THIS DOES: Send unexpected errors in SSE format
    console.error('User updates SSE error:', error);
    try {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Failed to establish updates connection' })}\n\n`);
    } catch (writeError) {
      // Connection already closed, ignore
    }
  }
});

export default router;

