// Model Selection Service
// Handles automatic model selection with rotation logic for thinking models

import { ModelTable, IModel } from '../models/ModelTable';
import { IUser } from '../models/UserTable';
import { IConversation } from '../models/ConversationTable';

/**
 * Result of model selection
 */
export interface SelectedModel {
  modelRowKey: string;      // Model's rowKey in database
  providerApiModelId: string; // Model ID to send to AI provider API
  model: any;                 // Full model object for additional checks
}

/**
 * Get the appropriate model for a user's request
 * Handles 'auto' selection with rotation between thinking models
 * 
 * @param user - The authenticated user
 * @param requestedModel - Model ID requested by user ('auto' or specific model rowKey)
 * @param conversation - Optional conversation context for rotation
 * @returns Selected model details
 */
export async function getModelForUser(
  user: IUser,
  requestedModel: string | undefined,
  conversation?: IConversation
): Promise<SelectedModel> {
  
  // CASE 1: User explicitly requested a specific model (not 'auto')
  if (requestedModel && requestedModel !== 'auto') {
    const model = await ModelTable.findById(requestedModel);
    
    if (!model) {
      throw new Error(`Model ${requestedModel} not found`);
    }
    
    if (!model.isActive) {
      throw new Error(`Model ${requestedModel} is not active`);
    }
    
    return {
      modelRowKey: model.rowKey,
      providerApiModelId: model.modelId,
      model: model,
    };
  }
  
  // CASE 2: User requested 'auto' or no model specified
  // Get all active models for this user's tier
  const availableModels = await ModelTable.findByTier(user.tier);
  
  if (availableModels.length === 0) {
    throw new Error(`No active models available for tier ${user.tier}`);
  }
  
  // Filter for thinking models only
  const thinkingModels = availableModels.filter((m: IModel) => m.isThinking && m.isActive);
  
  if (thinkingModels.length === 0) {
    throw new Error(`No thinking models available for tier ${user.tier}`);
  }
  
  // Sort by cost (cheapest first) for fairness
  thinkingModels.sort((a: IModel, b: IModel) => {
    const costA = a.costPer1kTokensInput + a.costPer1kTokensOutput;
    const costB = b.costPer1kTokensInput + b.costPer1kTokensOutput;
    return costA - costB;
  });
  
  // Rotate based on conversation's message count
  const messageCount = conversation?.messageCount || 0;
  const selectedIndex = messageCount % thinkingModels.length;
  const selectedModel = thinkingModels[selectedIndex];
  
  console.log(`🔄 Auto-rotation: Selected ${selectedModel.displayName} (index ${selectedIndex}/${thinkingModels.length}) for message ${messageCount}`);
  
  return {
    modelRowKey: selectedModel.rowKey,
    providerApiModelId: selectedModel.modelId,
    model: selectedModel,
  };
}

