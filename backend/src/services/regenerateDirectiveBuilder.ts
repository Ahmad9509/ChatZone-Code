// Regenerate directive builder
// Centralizes system prompt additions for regenerate directives
// Used by: /regenerate endpoint to handle "try again", "add details", "more concise", "search web"

/**
 * WHAT THIS SERVICE DOES:
 * - Builds custom system prompt additions for regenerate directives
 * - Includes the rejected response for context
 * - Adds directive-specific instructions
 * - Centralizes all regenerate instruction text in one place
 */

/**
 * Supported regenerate directives
 * These are the buttons shown in the UI when user rejects a response
 */
export type RegenerateDirective = 
  | 'try_again'       // "Try again" - just regenerate with no specific instruction
  | 'add_details'     // "Add details" - make response more comprehensive
  | 'more_concise'    // "Make concise" - shorten the response
  | 'search_web'      // "Search the web" - force Pro Search mode
  | string;           // Allow custom directives

/**
 * Build system prompt additions for a regenerate directive
 * 
 * WHAT THIS DOES:
 * 1. Takes the rejected assistant response
 * 2. Takes the directive type (try_again, add_details, etc.)
 * 3. Builds a system prompt addition that:
 *    - Shows the AI its previous rejected response
 *    - Explains why it was rejected
 *    - Gives specific instructions based on directive
 * 
 * WHY THIS EXISTS:
 * When a user clicks "regenerate" with a directive, we need to tell the AI:
 * - What response was rejected (for context)
 * - What specific change the user wants
 * This ensures the regenerated response is actually different and follows the directive
 * 
 * EXAMPLE OUTPUT (for 'add_details'):
 * ```
 * [Previous Response (Rejected by User)]:
 * [the original response text]
 * 
 * The user rejected your previous answer. Please revise it with more detail and depth.
 * ```
 * 
 * @param rejectedResponse - The assistant's response that was rejected
 * @param directive - The regenerate directive chosen by user
 * @returns System prompt addition string to append to base system prompt
 */
export function buildRegenerateSystemPrompt(
  rejectedResponse: string,
  directive: RegenerateDirective
): string {
  // Start with context about the rejected response
  let systemPromptAddition = `\n\n[Previous Response (Rejected by User)]:\n${rejectedResponse}`;
  
  // Add directive-specific instructions
  switch (directive) {
    case 'try_again':
      // Simple regeneration - no specific change requested
      systemPromptAddition += '\n\nThe user rejected your previous answer. Please provide a different response.';
      break;
      
    case 'add_details':
      // User wants more comprehensive answer
      systemPromptAddition += '\n\nThe user rejected your previous answer. Please revise it with more detail and depth.';
      break;
      
    case 'more_concise':
      // User wants shorter answer
      systemPromptAddition += '\n\nThe user rejected your previous answer. Please rewrite it to be more concise.';
      break;
      
    case 'search_web':
      // User wants web search included (Pro Search mode)
      // Note: This directive also triggers isProSearch flag in the endpoint
      systemPromptAddition += '\n\nThe user rejected your previous answer. You MUST perform a mandatory web search before responding and incorporate the findings.';
      systemPromptAddition += '\n\nYou MUST use the search_web tool to find current information before responding.';
      break;
      
    default:
      // Fallback for unknown directives
      systemPromptAddition += '\n\nThe user rejected your previous answer. Please provide a different response.';
  }
  
  return systemPromptAddition;
}

/**
 * Check if a directive requires Pro Search mode
 * 
 * WHAT THIS DOES:
 * - Returns true if the directive requires web search
 * - Used to determine if isProSearch flag should be set
 * 
 * @param directive - The regenerate directive
 * @returns True if directive requires Pro Search
 */
export function isProSearchDirective(directive: RegenerateDirective): boolean {
  return directive === 'search_web';
}

