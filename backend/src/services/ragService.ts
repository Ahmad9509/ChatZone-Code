// RAG (Retrieval Augmented Generation) service
// Handles document storage, vector search, and context retrieval
import { DocumentChunk, IDocumentChunk } from '../models/Document';
import { generateEmbedding, cosineSimilarity } from './embeddingService';
import { isDatabaseConnected } from '../config/database';
import mongoose from 'mongoose';

/**
 * Search for relevant document chunks based on query
 * Returns top K most similar chunks using cosine similarity
 */
export const searchDocuments = async (
  userId: string,
  query: string,
  topK: number = 5,
  projectId?: string
): Promise<IDocumentChunk[]> => {
  // Guard clause: skip if MongoDB not connected
  if (!isDatabaseConnected()) {
    console.warn('⚠️  MongoDB not connected - skipping document search');
    return [];
  }

  try {
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);

    // Build search query
    const searchQuery: any = { userId };
    if (projectId) {
      searchQuery.projectId = projectId;
    }

    // Fetch all chunks for the user (or project)
    // In production, you'd use Azure Cosmos DB's vector search capabilities
    // For now, we'll do in-memory similarity calculation
    const chunks = await DocumentChunk.find(searchQuery).limit(1000);

    if (chunks.length === 0) {
      return [];
    }

    // Calculate similarity scores
    const chunksWithScores = chunks.map((chunk) => ({
      chunk,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }));

    // Sort by similarity score (descending) and return top K
    chunksWithScores.sort((a, b) => b.score - a.score);

    return chunksWithScores.slice(0, topK).map((item) => item.chunk);
  } catch (error) {
    console.error('Document search error:', error);
    throw new Error('Failed to search documents');
  }
};

/**
 * Store conversation message chunks with embeddings for in-chat RAG
 * Used when conversation exceeds rolling window
 */
export const storeConversationChunk = async (
  userId: string,
  conversationId: string,
  messages: any[],
  projectId?: string
): Promise<void> => {
  // Guard clause: skip if MongoDB not connected
  if (!isDatabaseConnected()) {
    console.warn('⚠️  MongoDB not connected - skipping conversation chunk storage');
    return;
  }

  try {
    // Combine messages into a text chunk
    const textContent = messages
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join('\n\n');

    // Generate embedding
    const embedding = await generateEmbedding(textContent);

    // Store as document chunk
    const chunk = new DocumentChunk({
      userId,
      projectId,
      documentId: conversationId, // Use conversation ID as document ID
      documentName: 'Conversation Memory',
      chunkIndex: Date.now(), // Use timestamp as index
      content: textContent,
      embedding,
      metadata: {
        fileType: 'conversation',
        uploadedAt: new Date(),
      },
    });

    await chunk.save();
  } catch (error) {
    console.error('Store conversation chunk error:', error);
    throw new Error('Failed to store conversation chunk');
  }
};

/**
 * Retrieve relevant context from conversation history
 * Used for in-chat RAG when conversation is long
 */
export const retrieveConversationContext = async (
  userId: string,
  conversationId: string,
  currentMessage: string,
  topK: number = 3
): Promise<string[]> => {
  // Guard clause: skip if MongoDB not connected
  if (!isDatabaseConnected()) {
    return [];
  }

  try {
    // Generate embedding for current message
    const queryEmbedding = await generateEmbedding(currentMessage);

    // Find conversation chunks
    const chunks = await DocumentChunk.find({
      userId,
      documentId: conversationId,
      'metadata.fileType': 'conversation',
    });

    if (chunks.length === 0) {
      return [];
    }

    // Calculate similarity scores
    const chunksWithScores = chunks.map((chunk) => ({
      content: chunk.content,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }));

    // Sort and return top K
    chunksWithScores.sort((a, b) => b.score - a.score);

    return chunksWithScores.slice(0, topK).map((item) => item.content);
  } catch (error) {
    console.error('Retrieve conversation context error:', error);
    return [];
  }
};

/**
 * Build RAG-enhanced context for AI model
 * Combines retrieved chunks with current conversation
 */
export const buildRAGContext = (
  retrievedChunks: IDocumentChunk[],
  systemPrompt: string
): string => {
  if (retrievedChunks.length === 0) {
    return systemPrompt;
  }

  // Format retrieved chunks as context
  const contextText = retrievedChunks
    .map((chunk, idx) => {
      const source = chunk.documentName;
      const content = chunk.content.slice(0, 500); // Limit chunk size
      return `[Source ${idx + 1}: ${source}]\n${content}`;
    })
    .join('\n\n');

  // Prepend context to system prompt
  return `${systemPrompt}\n\n## Relevant Knowledge Base:\n${contextText}\n\n## Instructions:\nUse the above knowledge base to answer the user's questions when relevant. Cite sources using [Source N] when referencing information.`;
};

/**
 * Build context combining attached files and RAG results
 * Files take precedence over RAG results
 */
export const buildContextWithFiles = (
  attachedFiles: Array<{ name: string; content?: string; type: string }>,
  retrievedChunks: IDocumentChunk[],
  systemPrompt: string
): string => {
  let contextParts: string[] = [systemPrompt];

  // Add attached file content first (takes priority)
  if (attachedFiles && attachedFiles.length > 0) {
    const fileTexts = attachedFiles
      .filter((f): f is { name: string; content: string; type: string } => f.type === 'text' && typeof f.content === 'string')
      .map((f, idx) => `[Attached File ${idx + 1}: ${f.name}]\n${f.content.slice(0, 1000)}`)
      .join('\n\n');

    if (fileTexts) {
      contextParts.push(`## Attached Documents:\n${fileTexts}`);
    }
  }

  // Separate conversation chunks from document chunks
  const conversationChunks = retrievedChunks.filter(chunk => chunk.metadata?.fileType === 'conversation');
  const documentChunks = retrievedChunks.filter(chunk => chunk.metadata?.fileType !== 'conversation');

  // Add project conversation history
  if (conversationChunks.length > 0) {
    const conversationTexts = conversationChunks
      .map((chunk, idx) => {
        const content = chunk.content.slice(0, 600);
        return `[Project Conversation ${idx + 1}]\n${content}`;
      })
      .join('\n\n');

    contextParts.push(`## Related Project Conversations:\n${conversationTexts}\n\nNote: These are excerpts from other conversations in this project. Use them for context if relevant to the current question.`);
  }

  // Add project documents
  if (documentChunks.length > 0) {
    const documentTexts = documentChunks
      .map((chunk, idx) => {
        const source = chunk.documentName;
        const content = chunk.content.slice(0, 500);
        return `[Project Document ${idx + 1}: ${source}]\n${content}`;
      })
      .join('\n\n');

    contextParts.push(`## Project Documents:\n${documentTexts}`);
  }

  // Add usage instructions
  if ((attachedFiles && attachedFiles.length > 0) || retrievedChunks.length > 0) {
    contextParts.push(
      '## Instructions:\nYou have access to project documents and related conversations. Use them when relevant to answer questions. Clearly distinguish between referencing documents versus past conversations. Cite sources when referencing specific information.'
    );
  }

  return contextParts.join('\n\n');
};

