/**
 * Thinking Tag Detection Service
 * 
 * This service detects <think>...</think> tags emitted by reasoning models.
 * It handles various edge cases:
 * - Normal case: <think>reasoning content</think>
 * - Missing closing tag: <think>reasoning content (stream ends)
 * - Orphan closing tag: reasoning content</think> (no opening tag)
 * 
 * Purpose: Keep thinking tag detection completely separate from artifact detection.
 */

/**
 * Result type for thinking opening tag detection
 */
export interface ThinkingStartResult {
  found: boolean;           // Whether <think> tag was found
  tagComplete: boolean;     // Whether the full opening tag is present
  tagStartIndex?: number;   // Index where <think> starts in the buffer
  contentStart?: number;    // Index where content after <think> starts
}

/**
 * Result type for thinking closing tag detection
 */
export interface ThinkingEndResult {
  found: boolean;                // Whether </think> tag was found
  contentBeforeTag?: string;     // Reasoning content before </think>
  contentAfterTag?: string;      // Text after </think> (could be regular content or artifacts)
}

/**
 * Result type for orphan closing tag detection
 * Used when </think> appears but we haven't detected <think> yet
 */
export interface OrphanClosingResult {
  found: boolean;              // Whether orphan </think> was found
  tagIndex?: number;           // Index where </think> starts
  contentBefore?: string;      // Content before the orphan tag (assumed to be reasoning)
  contentAfter?: string;       // Content after the orphan tag
}

/**
 * Detects the opening <think> tag in accumulated response buffer
 * 
 * @param content - The accumulated response buffer from the AI model
 * @returns ThinkingStartResult with detection details
 */
export function detectThinkingStart(content: string): ThinkingStartResult {
  // Look for opening <think> tag (case-insensitive)
  const regex = /<think>/i;
  const match = content.match(regex);
  
  if (match && match.index !== undefined) {
    return {
      found: true,
      tagComplete: true,
      tagStartIndex: match.index,
      contentStart: match.index + match[0].length,
    };
  }
  
  // No opening tag found
  return { found: false, tagComplete: false };
}

/**
 * Detects the closing </think> tag in reasoning buffer
 * 
 * @param content - The accumulated reasoning content buffer
 * @returns ThinkingEndResult with content split before/after the tag
 */
export function detectThinkingEnd(content: string): ThinkingEndResult {
  // Look for closing </think> tag (case-insensitive)
  const regex = /<\/think>/i;
  const match = content.match(regex);
  
  if (match && match.index !== undefined) {
    return {
      found: true,
      contentBeforeTag: content.substring(0, match.index),
      contentAfterTag: content.substring(match.index + match[0].length),
    };
  }
  
  // No closing tag found yet
  return { found: false };
}

/**
 * Detects orphan closing tag scenario
 * This happens when </think> appears but no <think> was detected
 * 
 * @param content - The accumulated response buffer
 * @returns OrphanClosingResult with content before/after the orphan tag
 */
export function detectOrphanClosing(content: string): OrphanClosingResult {
  // Look for closing </think> tag
  const regex = /<\/think>/i;
  const match = content.match(regex);
  
  if (match && match.index !== undefined) {
    return {
      found: true,
      tagIndex: match.index,
      contentBefore: content.substring(0, match.index),
      contentAfter: content.substring(match.index + match[0].length),
    };
  }
  
  // No orphan closing tag found
  return { found: false };
}

