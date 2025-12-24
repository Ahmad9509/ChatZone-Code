// TypeScript interfaces for chat functionality

export interface Message {
  messageId: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  parentMessageId?: string;
  artifactId?: string;
  sources?: string | Source[];
  createdAt: Date | string;
  updatedAt?: Date | string;
}

export interface Source {
  title: string;
  url: string;
  snippet: string;
}

export interface Conversation {
  _id: string;
  userId: string;
  title: string;
  messages: Message[];
  messageCount: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  lastMessageAt: Date | string;
}

export interface ConversationTree {
  assistantBranches: Record<string, string[]>; // userMessageId -> assistant messageIds
  userBranches: Record<string, string[]>; // parent assistantId (or root) -> user messageIds
  branchCounts: Record<string, number>; // parentId -> number of branches
  visibleMessageIds: Set<string>; // messageIds that should be displayed
}

export interface ModelSwitchNotification {
  visible: boolean;
  message: string;
}

export interface User {
  _id: string;
  email: string;
  name: string;
  username?: string;
  tier: 'free' | 'pro' | 'premium';
  preferredModelId?: string;
}

export interface Model {
  _id: string;
  rowKey: string;
  name: string;
  modelId: string;
  provider: string;
  isActive: boolean;
  isThinking?: boolean;
  tierAccess: string[];
}

export interface Project {
  _id: string;
  name: string;
  description?: string;
  userId: string;
  conversations: string[];
  createdAt: Date | string;
}

