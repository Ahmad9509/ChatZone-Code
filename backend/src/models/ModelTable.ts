// Model model using Azure Table Storage
import { modelsTable } from '../config/tableStorage';
import { ProviderTable } from './ProviderTable';

export interface IModel {
  partitionKey: string; // 'MODEL'
  rowKey: string; // Model ID (UUID)
  providerId: string; // For display/grouping
  apiKeyId: string; // Which API key to use for this model
  modelId: string;
  name: string; // Alias for displayName
  displayName: string;
  costPer1kTokensInput: number;
  costPer1kTokensOutput: number;
  contextWindow: number;
  supportsVision: boolean;
  isThinking: boolean; // For Pro Search: models with reasoning capabilities
  minTier: 'free' | 'tier5' | 'tier10' | 'tier15';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TIER_HIERARCHY = {
  'free': 0,
  'tier5': 1,
  'tier10': 2,
  'tier15': 3,
};

export class ModelTable {
  static async create(data: {
    providerId: string;
    apiKeyId: string;
    modelId: string;
    displayName: string;
    costPer1kTokens: { input: number; output: number };
    contextWindow: number;
    supportsVision?: boolean;
    isThinking?: boolean;
    minTier?: string;
    isActive?: boolean;
  }): Promise<IModel> {
    const id = crypto.randomUUID();
    const model: IModel = {
      partitionKey: 'MODEL',
      rowKey: id,
      providerId: data.providerId,
      apiKeyId: data.apiKeyId,
      modelId: data.modelId,
      name: data.displayName, // Alias
      displayName: data.displayName,
      costPer1kTokensInput: data.costPer1kTokens.input,
      costPer1kTokensOutput: data.costPer1kTokens.output,
      contextWindow: data.contextWindow,
      supportsVision: data.supportsVision || false,
      isThinking: data.isThinking || false,
      minTier: (data.minTier as any) || 'free',
      isActive: data.isActive !== undefined ? data.isActive : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await modelsTable.createEntity(model as any);
    return model;
  }

  static async findAll(): Promise<IModel[]> {
    const entities = modelsTable.listEntities({
      queryOptions: { filter: "PartitionKey eq 'MODEL'" }
    });
    
    const models: IModel[] = [];
    for await (const entity of entities) {
      models.push(entity as unknown as IModel);
    }
    return models.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  static async findById(id: string): Promise<IModel | null> {
    try {
      const entity = await modelsTable.getEntity('MODEL', id);
      return entity as unknown as IModel;
    } catch (error: any) {
      if (error.statusCode === 404) return null;
      throw error;
    }
  }

  static async findByModelId(modelId: string): Promise<IModel | null> {
    const entities = modelsTable.listEntities({
      queryOptions: { filter: `PartitionKey eq 'MODEL' and modelId eq '${modelId}' and isActive eq true` }
    });
    
    for await (const entity of entities) {
      return entity as unknown as IModel;
    }
    return null;
  }

  static async getModelsByTier(userTier: string): Promise<IModel[]> {
    const userTierLevel = TIER_HIERARCHY[userTier as keyof typeof TIER_HIERARCHY] || 0;
    const allModels = await this.findAll();
    
    const filtered: IModel[] = [];
    for (const model of allModels) {
      if (!model.isActive) continue;
      
      const modelTierLevel = TIER_HIERARCHY[model.minTier as keyof typeof TIER_HIERARCHY] || 0;
      if (modelTierLevel <= userTierLevel) {
        // Check if provider is active
        const provider = await ProviderTable.findById(model.providerId);
        if (provider?.isActive) {
          filtered.push(model);
        }
      }
    }
    
    return filtered;
  }

  static async update(id: string, updates: Partial<IModel>): Promise<IModel> {
    const model = await this.findById(id);
    if (!model) throw new Error('Model not found');

    const updated = { 
      ...model, 
      ...updates, 
      updatedAt: new Date() 
    };
    await modelsTable.updateEntity(updated as any, 'Merge');
    return updated;
  }

  static async delete(id: string): Promise<void> {
    await modelsTable.deleteEntity('MODEL', id);
  }

  static async deleteByProviderId(providerId: string): Promise<void> {
    const entities = modelsTable.listEntities({
      queryOptions: { filter: `PartitionKey eq 'MODEL' and providerId eq '${providerId}'` }
    });
    
    for await (const entity of entities) {
      await modelsTable.deleteEntity('MODEL', (entity as any).rowKey);
    }
  }

  // Alias for getModelsByTier
  static async findByTier(userTier: string): Promise<IModel[]> {
    return this.getModelsByTier(userTier);
  }
}

