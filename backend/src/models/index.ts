// Export Table Storage models with MongoDB-compatible interface
// This allows existing routes to work with minimal changes

import { UserTable, IUser as IUserTable } from './UserTable';
import { ProviderTable, IProvider as IProviderTable } from './ProviderTable';
import { ModelTable, IModel as IModelTable } from './ModelTable';
import { ApiKeyTable, IApiKey as IApiKeyTable } from './ApiKeyTable';
import { ConversationTable, IConversation as IConversationTable } from './ConversationTable';
import { MessageTable, IMessage as IMessageTable } from './MessageTable';
import { ProjectTable, IProject as IProjectTable } from './ProjectTable';
import { DocumentTable, IDocument as IDocumentTable } from './DocumentTable';
import { SystemPromptTable, ISystemPrompt as ISystemPromptTable } from './SystemPromptTable';
import { ArtifactTable, IArtifact as IArtifactTable } from './ArtifactTable';
import { TierConfigTable, ITierConfig as ITierConfigTable } from './TierConfigTable';
import { DesignTable, IDesign as IDesignTable } from './DesignTable';
import { PresentationTable, IPresentation as IPresentationTable } from './PresentationTable';
import { PresentationTemplateTable, IPresentationTemplate as IPresentationTemplateTable } from './PresentationTemplateTable';

// Re-export types
export type { IUserTable as IUser, IProviderTable as IProvider, IModelTable as IModel, IApiKeyTable as IApiKey };
export type { IConversationTable as IConversation, IMessageTable as IMessage };
export type { IProjectTable as IProject, IDocumentTable as IDocument };
export type { ISystemPromptTable as ISystemPrompt };
export type { IArtifactTable as IArtifact };
export type { ITierConfigTable as ITierConfig };
export type { IDesignTable as IDesign };
export type { IPresentationTable as IPresentation };
export type { IPresentationTemplateTable as IPresentationTemplate };

// Export classes as default objects to match MongoDB mongoose model pattern
export const User = UserTable;
export const Provider = ProviderTable;
export const Model = ModelTable;
export const ApiKey = ApiKeyTable;
export const Conversation = ConversationTable;
export const Message = MessageTable;
export const Project = ProjectTable;
export const Document = DocumentTable;
export const SystemPrompt = SystemPromptTable;
export const Artifact = ArtifactTable;
export const TierConfig = TierConfigTable;
export const Design = DesignTable;
export const Presentation = PresentationTable;
export const PresentationTemplate = PresentationTemplateTable;

// Default exports
export default {
  User,
  Provider,
  Model,
  ApiKey,
  Conversation,
  Message,
  Project,
  Document,
  SystemPrompt,
  Artifact,
  TierConfig,
  Design,
  Presentation,
  PresentationTemplate,
};

