// Tier Configuration model using Azure Table Storage
// Stores per-tier settings like default models, limits, and features
import { tierConfigsTable } from '../config/tableStorage';

export interface ITierConfig {
  partitionKey: string; // 'TIERCONFIG'
  rowKey: string; // Tier name ('free', 'tier5', 'tier10', 'tier15')
  tierName: string; // Same as rowKey for easy reference
  displayName: string;
  priceUSD: number;
  priceDeveloping: number;
  tokenLimit: number;
  isUnlimitedTokens: boolean;
  defaultModel?: string;
  defaultVisionModel?: string;
  defaultProSearchModelId?: string; // For Pro Search: auto-switch to this thinking model
  maxProjects: number;
  ragStorageLimit: number;
  maxFileSize: number; // in MB
  memoryCapacity: number; // in MB
  features: {
    hasRAG: boolean;
    hasProjects: boolean;
    hasProReplies: boolean;
    hasVision: boolean;
  };
  deepResearch: {
    hasDeepResearch: boolean;        // Whether tier can use Deep Research feature
    deepResearchLimit: number;       // Monthly limit (0 = unlimited)
    deepResearchMaxSources: number;  // Max search results per query
  };
  designs: {
    hasDesigns: boolean;             // Whether tier can create designs
    designsLimit: number;            // Monthly limit (0 = unlimited)
    aiImageGenerationsLimit: number; // Monthly AI image generations limit
    canUseQwen: boolean;             // Can use Qwen AI model
    canUseImagen: boolean;           // Can use Google Imagen model
    canExportPNG: boolean;
    canExportJPG: boolean;
    canExportPDF: boolean;
  };
  presentations: {
    hasPresentations: boolean;       // Whether tier can create presentations
    presentationsLimit: number;      // Monthly limit (0 = unlimited)
    maxSlidesPerPresentation: number;
    canExportPPTX: boolean;
    canExportPDF: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

export class TierConfigTable {
  static async create(data: Partial<ITierConfig>): Promise<ITierConfig> {
    const tierConfig: ITierConfig = {
      partitionKey: 'TIERCONFIG',
      rowKey: data.tierName!,
      tierName: data.tierName!,
      displayName: data.displayName || data.tierName!,
      priceUSD: data.priceUSD || 0,
      priceDeveloping: data.priceDeveloping || 0,
      tokenLimit: data.tokenLimit || 0,
      isUnlimitedTokens: data.isUnlimitedTokens || false,
      defaultModel: data.defaultModel,
      defaultVisionModel: data.defaultVisionModel,
      defaultProSearchModelId: data.defaultProSearchModelId,
      maxProjects: data.maxProjects || 0,
      ragStorageLimit: data.ragStorageLimit || 0,
      maxFileSize: data.maxFileSize || 10,
      memoryCapacity: data.memoryCapacity || 50,
      features: data.features || {
        hasRAG: false,
        hasProjects: false,
        hasProReplies: false,
        hasVision: false,
      },
      deepResearch: data.deepResearch || {
        hasDeepResearch: false,
        deepResearchLimit: 0,
        deepResearchMaxSources: 20,
      },
      designs: data.designs || {
        hasDesigns: false,
        designsLimit: 0,
        aiImageGenerationsLimit: 0,
        canUseQwen: false,
        canUseImagen: false,
        canExportPNG: false,
        canExportJPG: false,
        canExportPDF: false,
      },
      presentations: data.presentations || {
        hasPresentations: false,
        presentationsLimit: 0,
        maxSlidesPerPresentation: 10,
        canExportPPTX: false,
        canExportPDF: false,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await tierConfigsTable.createEntity(tierConfig as any);
    return tierConfig;
  }

  static async findAll(): Promise<ITierConfig[]> {
    const entities = tierConfigsTable.listEntities({
      queryOptions: { filter: "PartitionKey eq 'TIERCONFIG'" }
    });
    
    const configs: ITierConfig[] = [];
    for await (const entity of entities) {
      configs.push(entity as unknown as ITierConfig);
    }
    return configs;
  }

  static async findByTierName(tierName: string): Promise<ITierConfig | null> {
    try {
      const entity = await tierConfigsTable.getEntity('TIERCONFIG', tierName);
      return entity as unknown as ITierConfig;
    } catch (error: any) {
      if (error.statusCode === 404) return null;
      throw error;
    }
  }

  static async update(tierName: string, updates: Partial<ITierConfig>): Promise<ITierConfig> {
    const existing = await this.findByTierName(tierName);
    
    if (!existing) {
      // Create if doesn't exist
      return this.create({ ...updates, tierName });
    }

    const updated = { 
      ...existing, 
      ...updates,
      updatedAt: new Date() 
    };
    
    await tierConfigsTable.updateEntity(updated as any, 'Merge');
    return updated;
  }

  static async delete(tierName: string): Promise<void> {
    await tierConfigsTable.deleteEntity('TIERCONFIG', tierName);
  }

  // Seed default tier configurations if they don't exist
  static async seedDefaults(): Promise<void> {
    try {
      const defaults: Partial<ITierConfig>[] = [
        {
          tierName: 'free',
          displayName: 'Free',
          priceUSD: 0,
          priceDeveloping: 0,
          tokenLimit: 1000000,
          isUnlimitedTokens: false,
          maxProjects: 3,
          ragStorageLimit: 100 * 1024 * 1024, // 100 MB
          maxFileSize: 10,
          memoryCapacity: 50,
          features: {
            hasRAG: false,
            hasProjects: false,
            hasProReplies: false,
            hasVision: false,
          },
          deepResearch: {
            hasDeepResearch: false,
            deepResearchLimit: 0,
            deepResearchMaxSources: 0,
          },
          designs: {
            hasDesigns: true,
            designsLimit: 5,
            aiImageGenerationsLimit: 10,
            canUseQwen: false,
            canUseImagen: false,
            canExportPNG: true,
            canExportJPG: true,
            canExportPDF: false,
          },
          presentations: {
            hasPresentations: false,
            presentationsLimit: 0,
            maxSlidesPerPresentation: 0,
            canExportPPTX: false,
            canExportPDF: false,
          },
        },
        {
          tierName: 'tier5',
          displayName: '$5 Tier ($3 developing)',
          priceUSD: 5,
          priceDeveloping: 3,
          tokenLimit: 10000000,
          isUnlimitedTokens: false,
          maxProjects: 10,
          ragStorageLimit: 500 * 1024 * 1024, // 500 MB
          maxFileSize: 30,
          memoryCapacity: 150,
          features: {
            hasRAG: true,
            hasProjects: true,
            hasProReplies: true,
            hasVision: true,
          },
          deepResearch: {
            hasDeepResearch: true,
            deepResearchLimit: 5,
            deepResearchMaxSources: 20,
          },
          designs: {
            hasDesigns: true,
            designsLimit: 10,
            aiImageGenerationsLimit: 50,
            canUseQwen: true,
            canUseImagen: false,
            canExportPNG: true,
            canExportJPG: true,
            canExportPDF: false,
          },
          presentations: {
            hasPresentations: true,
            presentationsLimit: 5,
            maxSlidesPerPresentation: 15,
            canExportPPTX: true,
            canExportPDF: false,
          },
        },
        {
          tierName: 'tier10',
          displayName: '$10 Tier',
          priceUSD: 10,
          priceDeveloping: 10,
          tokenLimit: 50000000,
          isUnlimitedTokens: false,
          maxProjects: 50,
          ragStorageLimit: 2 * 1024 * 1024 * 1024, // 2 GB
          maxFileSize: 50,
          memoryCapacity: 250,
          features: {
            hasRAG: true,
            hasProjects: true,
            hasProReplies: true,
            hasVision: true,
          },
          deepResearch: {
            hasDeepResearch: true,
            deepResearchLimit: 15,
            deepResearchMaxSources: 50,
          },
          designs: {
            hasDesigns: true,
            designsLimit: 30,
            aiImageGenerationsLimit: 200,
            canUseQwen: true,
            canUseImagen: true,
            canExportPNG: true,
            canExportJPG: true,
            canExportPDF: true,
          },
          presentations: {
            hasPresentations: true,
            presentationsLimit: 15,
            maxSlidesPerPresentation: 30,
            canExportPPTX: true,
            canExportPDF: true,
          },
        },
        {
          tierName: 'tier15',
          displayName: '$15 Tier',
          priceUSD: 15,
          priceDeveloping: 15,
          tokenLimit: 0,
          isUnlimitedTokens: true,
          maxProjects: 999,
          ragStorageLimit: 10 * 1024 * 1024 * 1024, // 10 GB
          maxFileSize: 100,
          memoryCapacity: 500,
          features: {
            hasRAG: true,
            hasProjects: true,
            hasProReplies: true,
            hasVision: true,
          },
          deepResearch: {
            hasDeepResearch: true,
            deepResearchLimit: 0,
            deepResearchMaxSources: 100,
          },
          designs: {
            hasDesigns: true,
            designsLimit: 0,
            aiImageGenerationsLimit: 0,
            canUseQwen: true,
            canUseImagen: true,
            canExportPNG: true,
            canExportJPG: true,
            canExportPDF: true,
          },
          presentations: {
            hasPresentations: true,
            presentationsLimit: 0,
            maxSlidesPerPresentation: 50,
            canExportPPTX: true,
            canExportPDF: true,
          },
        },
      ];

      for (const defaultConfig of defaults) {
        const existing = await this.findByTierName(defaultConfig.tierName!);
        if (!existing) {
          await this.create(defaultConfig);
          console.log(`✅ Seeded tier config: ${defaultConfig.tierName}`);
        } else {
          // Update existing config if designs feature is missing or disabled
          // This ensures all tiers have the correct designs configuration
          const needsUpdate = defaultConfig.designs && (
            !existing.designs || 
            existing.designs.hasDesigns !== defaultConfig.designs.hasDesigns ||
            existing.designs.designsLimit !== defaultConfig.designs.designsLimit
          );
          
          if (needsUpdate && defaultConfig.designs) {
            await this.update(defaultConfig.tierName!, {
              designs: {
                ...existing.designs,
                ...defaultConfig.designs
              }
            });
            console.log(`✅ Updated tier config: ${defaultConfig.tierName} (updated designs: hasDesigns=${defaultConfig.designs.hasDesigns}, limit=${defaultConfig.designs.designsLimit})`);
          }
        }
      }
    } catch (error) {
      console.warn('Error seeding tier configs:', error);
    }
  }
}

