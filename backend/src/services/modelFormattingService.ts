// Model formatting service
// Centralizes model enrichment logic (adding provider and API key info)
// This eliminates duplicated formatting code across admin and chat endpoints

import { IModel } from '../models/ModelTable';
import { Provider, ApiKey } from '../models';

/**
 * Formatting modes determine what data to include in the response
 * 
 * 'admin' mode: Full model data with provider object and API key object (for admin panel)
 * 'user' mode: Limited data with only provider name, no API key (for regular users)
 */
type FormattingMode = 'admin' | 'user';

/**
 * Formatted model response for admin endpoints
 * Includes full provider and API key objects
 */
interface AdminFormattedModel {
  [key: string]: any;
  _id: string;
  providerId: string;
  provider: any;
  apiKeyId: string;
  apiKey: any;
  costPer1kTokens: {
    input: number;
    output: number;
  };
}

/**
 * Formatted model response for user endpoints
 * Includes only provider name, no API key
 */
interface UserFormattedModel {
  _id: string;
  name: string;
  displayName: string;
  modelId: string;
  provider: string | undefined;
  providerId: string;
  supportsVision: boolean;
  costPer1kTokens: {
    input: number;
    output: number;
  };
  contextWindow: number;
}

export class ModelFormatter {
  /**
   * Format a single model with provider and API key information
   * 
   * What this does:
   * 1. Fetches the provider object from database using model.providerId
   * 2. Fetches the API key object from database using model.apiKeyId (admin mode only)
   * 3. Restructures the cost data into a nested object
   * 4. Returns the enriched model with all related data
   * 
   * @param model - The model object from database
   * @param mode - 'admin' for full data, 'user' for limited data
   * @returns Formatted model with provider and API key info
   */
  static async formatModel(
    model: IModel,
    mode: FormattingMode = 'admin'
  ): Promise<AdminFormattedModel | UserFormattedModel> {
    if (mode === 'admin') {
      // Admin mode: Include full provider and API key objects
      const provider = await Provider.findById(model.providerId);
      const apiKey = model.apiKeyId ? await ApiKey.findById(model.apiKeyId) : null;

      return {
        ...model,
        _id: model.rowKey,
        providerId: model.providerId, // Keep the ID string
        provider: provider, // Add provider object separately
        apiKeyId: model.apiKeyId, // Keep the API key ID string
        apiKey: apiKey, // Add API key object separately
        costPer1kTokens: {
          input: model.costPer1kTokensInput,
          output: model.costPer1kTokensOutput,
        },
      };
    } else {
      // User mode: Only include provider name, no API key
      const provider = await Provider.findById(model.providerId);

      return {
        _id: model.rowKey,
        name: model.name,
        displayName: model.displayName || model.name,
        modelId: model.modelId,
        provider: provider?.name,
        providerId: model.providerId,
        supportsVision: model.supportsVision,
        costPer1kTokens: {
          input: model.costPer1kTokensInput,
          output: model.costPer1kTokensOutput,
        },
        contextWindow: model.contextWindow,
      };
    }
  }

  /**
   * Format multiple models with provider and API key information
   * 
   * What this does:
   * 1. Takes an array of models
   * 2. Formats each one using formatModel()
   * 3. Uses Promise.all for parallel processing (fast)
   * 4. Returns array of enriched models
   * 
   * @param models - Array of model objects from database
   * @param mode - 'admin' for full data, 'user' for limited data
   * @returns Array of formatted models with provider and API key info
   */
  static async formatModels(
    models: IModel[],
    mode: FormattingMode = 'admin'
  ): Promise<(AdminFormattedModel | UserFormattedModel)[]> {
    return Promise.all(models.map((model) => this.formatModel(model, mode)));
  }
}

