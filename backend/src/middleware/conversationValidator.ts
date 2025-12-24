// Conversation validation middleware
// This middleware checks if a conversation exists and belongs to the authenticated user
// It eliminates duplicated validation code across 5 different chat endpoints

import { Response } from 'express';
import { Conversation } from '../models';

/**
 * Validates conversation for regular JSON endpoints (GET, PATCH)
 * 
 * What this does:
 * 1. Gets the conversation ID from the URL (req.params.id)
 * 2. Checks if the conversation exists in the database
 * 3. Checks if it belongs to the authenticated user
 * 4. If valid: attaches conversation to req.conversation and continues
 * 5. If invalid: sends 404 JSON error and stops
 */
export const validateConversation = async (req: any, res: Response, next: Function) => {
  try {
    const user = req.user;
    const conversationId = req.params.id;

    // Check user is authenticated
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    // Fetch conversation from database
    const conversation = await Conversation.findById(user.rowKey, conversationId);

    // If conversation doesn't exist or doesn't belong to user, return 404
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found',
      });
    }

    // Attach conversation to request so route handler can use it
    req.conversation = conversation;
    next();
  } catch (error: any) {
    console.error('Conversation validation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to validate conversation',
    });
  }
};

/**
 * Validates conversation for SSE streaming endpoints (POST with SSE response)
 * 
 * CRITICAL: This must be called BEFORE setting SSE headers
 * 
 * What this does:
 * 1. Gets the conversation ID from the URL (req.params.id)
 * 2. Checks if the conversation exists in the database
 * 3. Checks if it belongs to the authenticated user
 * 4. If valid: attaches conversation to req.conversation and continues
 * 5. If invalid: sends SSE error event and stops (for streaming endpoints)
 * 
 * Difference from validateConversation:
 * - Uses res.write() for SSE format instead of res.json()
 * - Sends error as SSE event: data: {"type":"error","error":"..."}
 */
export const validateConversationForSSE = async (req: any, res: Response, next: Function) => {
  try {
    const user = req.user;
    const conversationId = req.params.id;

    // Check user is authenticated
    if (!user) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Unauthorized' })}\n\n`);
      res.end();
      return;
    }

    // Fetch conversation from database
    const conversation = await Conversation.findById(user.rowKey, conversationId);

    // If conversation doesn't exist or doesn't belong to user, send SSE error
    if (!conversation) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Conversation not found' })}\n\n`);
      res.end();
      return;
    }

    // Attach conversation to request so route handler can use it
    req.conversation = conversation;
    next();
  } catch (error: any) {
    console.error('Conversation validation error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', error: 'Failed to validate conversation' })}\n\n`);
    res.end();
  }
};

