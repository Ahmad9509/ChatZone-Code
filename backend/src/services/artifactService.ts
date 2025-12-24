// Artifact detection and parsing service
// Detects and extracts artifacts from AI streaming responses

import { Response } from 'express';
import { Artifact } from '../models';
import { SSEResponseBuilder } from './responseBuilder';

export interface ParsedArtifact {
  type: 'html' | 'code' | 'svg' | 'markdown' | 'react' | 'vue' | 'json' | 'csv' | 'mermaid';
  title: string;
  language?: string;
  content: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Detect if content contains artifact markers
 */
export function containsArtifact(content: string): boolean {
  return content.includes('<artifact') || content.includes('<antArtifact');
}

/**
 * Parse artifacts from AI response content
 * Supports multiple artifact formats:
 * - <artifact type="html" title="Landing Page">...</artifact>
 * - <antArtifact type="code" language="python" title="Script">...</antArtifact>
 */
export function parseArtifacts(content: string): ParsedArtifact[] {
  const artifacts: ParsedArtifact[] = [];
  
  // Match both <artifact> and <antArtifact> tags
  const artifactRegex = /<(ant)?[Aa]rtifact\s+([^>]+)>([\s\S]*?)<\/(ant)?[Aa]rtifact>/g;
  
  let match;
  while ((match = artifactRegex.exec(content)) !== null) {
    const [fullMatch, , attributes, artifactContent] = match;
    const startIndex = match.index;
    const endIndex = startIndex + fullMatch.length;
    
    // Parse attributes
    const typeMatch = attributes.match(/type=["']([^"']+)["']/);
    const titleMatch = attributes.match(/title=["']([^"']+)["']/);
    const languageMatch = attributes.match(/language=["']([^"']+)["']/);
    
    if (typeMatch && titleMatch) {
      const type = typeMatch[1] as ParsedArtifact['type'];
      const title = titleMatch[1];
      const language = languageMatch ? languageMatch[1] : undefined;
      
      artifacts.push({
        type,
        title,
        language,
        content: artifactContent.trim(),
        startIndex,
        endIndex
      });
    }
  }
  
  return artifacts;
}

/**
 * Remove artifact tags from content, leaving plain text
 */
export function stripArtifactTags(content: string): string {
  return content.replace(/<(ant)?[Aa]rtifact\s+[^>]+>[\s\S]*?<\/(ant)?[Aa]rtifact>/g, (match) => {
    // Extract title to show in stripped version
    const titleMatch = match.match(/title=["']([^"']+)["']/);
    if (titleMatch) {
      return `[Artifact: ${titleMatch[1]}]`;
    }
    return '[Artifact]';
  });
}

/**
 * Determine if content should trigger artifact based on heuristics
 * Used by AI to decide when to wrap output in artifact tags
 */
export function shouldBeArtifact(content: string, type?: string): boolean {
  const lines = content.split('\n').length;
  
  // HTML: Complete documents (has <!DOCTYPE or <html>)
  if (type === 'html' || content.includes('<!DOCTYPE') || content.includes('<html')) {
    return lines > 20 || content.length > 500;
  }
  
  // Code: Complete files with multiple functions/classes
  if (type === 'code' || content.includes('function ') || content.includes('class ') || content.includes('def ')) {
    return lines > 20;
  }
  
  // SVG: Any SVG content
  if (type === 'svg' || content.includes('<svg')) {
    return true;
  }
  
  // React/Vue components: Complete components
  if (type === 'react' || type === 'vue' || content.includes('export default') || content.includes('Vue.component')) {
    return lines > 15;
  }
  
  // JSON/CSV: Structured data with multiple entries
  if (type === 'json' || type === 'csv') {
    try {
      if (type === 'json') {
        const parsed = JSON.parse(content);
        return Array.isArray(parsed) ? parsed.length > 5 : Object.keys(parsed).length > 10;
      }
      return lines > 10;
    } catch {
      return false;
    }
  }
  
  // Markdown documents: Long-form content
  if (type === 'markdown' || content.includes('# ') || content.includes('## ')) {
    return lines > 30 || content.length > 1000;
  }
  
  // Mermaid diagrams
  if (type === 'mermaid' || content.includes('graph ') || content.includes('sequenceDiagram')) {
    return true;
  }
  
  return false;
}

/**
 * Infer artifact type from content
 */
export function inferArtifactType(content: string): ParsedArtifact['type'] | null {
  if (content.includes('<!DOCTYPE') || content.includes('<html')) return 'html';
  if (content.includes('<svg')) return 'svg';
  if (content.includes('export default function') || content.includes('import React')) return 'react';
  if (content.includes('Vue.component') || content.includes('<template>')) return 'vue';
  if (content.includes('graph ') || content.includes('sequenceDiagram') || content.includes('classDiagram')) return 'mermaid';
  
  // Try JSON parse
  try {
    JSON.parse(content);
    return 'json';
  } catch {}
  
  // Check for CSV
  const lines = content.split('\n');
  if (lines.length > 2 && lines[0].includes(',') && lines.every(l => l.split(',').length === lines[0].split(',').length)) {
    return 'csv';
  }
  
  // Check for markdown
  if (content.includes('# ') || content.includes('## ') || content.includes('### ')) {
    return 'markdown';
  }
  
  // Default to code
  return 'code';
}

/**
 * Real-time streaming artifact detection
 * Detects artifact opening tag in streaming content
 */
export interface ArtifactStartResult {
  found: boolean;
  tagComplete: boolean;
  type?: string;
  title?: string;
  language?: string;
  tagEndIndex?: number;
  contentStart?: number;
}

export function detectArtifactStart(content: string): ArtifactStartResult {
  // Look for opening tag pattern
  const tagPattern = /<(ant)?[Aa]rtifact\s+([^>]*)>/;
  const match = content.match(tagPattern);
  
  if (!match) {
    // Check if we have a partial opening tag at the end
    const partialPattern = /<(ant)?[Aa]rtifact(\s|$)/;
    if (partialPattern.test(content)) {
      return { found: true, tagComplete: false };
    }
    return { found: false, tagComplete: false };
  }
  
  const attributes = match[2];
  const tagEndIndex = match.index! + match[0].length;
  
  // Parse attributes
  const typeMatch = attributes.match(/type=["']([^"']+)["']/);
  const titleMatch = attributes.match(/title=["']([^"']+)["']/);
  const languageMatch = attributes.match(/language=["']([^"']+)["']/);
  
  if (!typeMatch || !titleMatch) {
    // Tag exists but missing required attributes
    return { found: false, tagComplete: false };
  }
  
  return {
    found: true,
    tagComplete: true,
    type: typeMatch[1],
    title: titleMatch[1],
    language: languageMatch ? languageMatch[1] : undefined,
    tagEndIndex,
    contentStart: tagEndIndex,
  };
}

/**
 * Parse opening tag attributes
 */
export interface ArtifactMeta {
  type: string;
  title: string;
  language?: string;
}

export function parseOpeningTag(tagString: string): ArtifactMeta | null {
  const typeMatch = tagString.match(/type=["']([^"']+)["']/);
  const titleMatch = tagString.match(/title=["']([^"']+)["']/);
  const languageMatch = tagString.match(/language=["']([^"']+)["']/);
  
  if (!typeMatch || !titleMatch) {
    return null;
  }
  
  return {
    type: typeMatch[1],
    title: titleMatch[1],
    language: languageMatch ? languageMatch[1] : undefined,
  };
}

/**
 * Detect artifact closing tag in streaming content
 */
export interface ArtifactEndResult {
  found: boolean;
  endIndex?: number;
  contentBeforeTag?: string;
  contentAfterTag?: string;
}

export function detectArtifactEnd(content: string): ArtifactEndResult {
  const closingPattern = /<\/(ant)?[Aa]rtifact>/;
  const match = content.match(closingPattern);
  
  if (!match) {
    return { found: false };
  }
  
  const endIndex = match.index!;
  const contentBeforeTag = content.substring(0, endIndex);
  const contentAfterTag = content.substring(endIndex + match[0].length);
  
  return {
    found: true,
    endIndex,
    contentBeforeTag,
    contentAfterTag,
  };
}

/**
 * Stream artifact content and save to database
 * SINGULAR SOURCE OF TRUTH for artifact streaming - used by both regular chat and Deep Research
 * Mimics exact flow from regular chat: artifact_start → artifact_content chunks → artifact_complete → save → artifact_saved
 * 
 * WHAT THIS DOES:
 * 1. Sends artifact_start event to frontend
 * 2. Streams artifact content in chunks (like regular chat does)
 * 3. Sends artifact_complete event
 * 4. Saves artifact to database
 * 5. Links artifact to message
 * 6. Sends artifact_saved event with saved artifact data
 * 
 * @param res - Express Response object for SSE streaming
 * @param artifactContent - Full artifact content to stream
 * @param artifactMeta - Artifact metadata (type, title, language)
 * @param userId - User ID for artifact creation
 * @param conversationId - Conversation ID for artifact creation
 * @param messageId - Message ID to link artifact to
 * @returns Promise<Artifact> - The saved artifact
 */
export async function streamArtifact(
  res: Response,
  artifactContent: string,
  artifactMeta: ArtifactMeta,
  userId: string,
  conversationId: string,
  messageId: string
): Promise<any> {
  // STEP 1: Send artifact_start event (same as regular chat)
  SSEResponseBuilder.artifactStart(res, {
    type: artifactMeta.type,
    title: artifactMeta.title,
    language: artifactMeta.language,
  });

  // STEP 2: Stream artifact content in chunks (same as regular chat)
  // Regular chat streams chunks as they arrive, we simulate this by chunking the content
  const chunkSize = 100; // Same chunk size as regular chat uses for tool-call artifacts
  for (let i = 0; i < artifactContent.length; i += chunkSize) {
    const chunk = artifactContent.slice(i, i + chunkSize);
    SSEResponseBuilder.artifactContent(res, chunk);
    // Small delay to simulate streaming effect (same as regular chat)
    await new Promise(resolve => setTimeout(resolve, 5));
  }

  // STEP 3: Send artifact_complete event (same as regular chat)
  SSEResponseBuilder.artifactComplete(res);

  // STEP 4: Save artifact to database (same as regular chat)
  const savedArtifact = await Artifact.create({
    userId: userId,
    conversationId: conversationId,
    messageId: messageId,
    type: artifactMeta.type as any,
    title: artifactMeta.title,
    language: artifactMeta.language,
    content: artifactContent.trim(),
  });

  // STEP 5: Send artifact_saved event with database ID (same as regular chat)
  SSEResponseBuilder.artifactSaved(res, {
    _id: savedArtifact.rowKey,
    type: savedArtifact.type,
    title: savedArtifact.title,
    language: savedArtifact.language,
    content: savedArtifact.content,
    version: savedArtifact.version,
    messageId: savedArtifact.messageId,
  });

  return savedArtifact;
}

/**
 * Save artifact to database and send artifact_saved event
 * Used when artifact was already streamed (e.g., during AI response streaming)
 * SINGULAR SOURCE OF TRUTH for artifact saving - used by regular chat after streaming
 * 
 * WHAT THIS DOES:
 * 1. Saves artifact to database
 * 2. Sends artifact_saved event with saved artifact data
 * 
 * @param res - Express Response object for SSE streaming
 * @param artifactContent - Full artifact content
 * @param artifactMeta - Artifact metadata (type, title, language)
 * @param userId - User ID for artifact creation
 * @param conversationId - Conversation ID for artifact creation
 * @param messageId - Message ID to link artifact to
 * @returns Promise<Artifact> - The saved artifact
 */
export async function saveArtifact(
  res: Response,
  artifactContent: string,
  artifactMeta: ArtifactMeta,
  userId: string,
  conversationId: string,
  messageId: string
): Promise<any> {
  // Save artifact to database
  const savedArtifact = await Artifact.create({
    userId: userId,
    conversationId: conversationId,
    messageId: messageId,
    type: artifactMeta.type as any,
    title: artifactMeta.title,
    language: artifactMeta.language,
    content: artifactContent.trim(),
  });

  // Send artifact_saved event with database ID (same as regular chat)
  SSEResponseBuilder.artifactSaved(res, {
    _id: savedArtifact.rowKey,
    type: savedArtifact.type,
    title: savedArtifact.title,
    language: savedArtifact.language,
    content: savedArtifact.content,
    version: savedArtifact.version,
    messageId: savedArtifact.messageId,
  });

  return savedArtifact;
}
