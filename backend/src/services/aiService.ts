// AI Service - OpenAI-compatible API integration
// Handles model routing, token counting, and streaming
import axios from 'axios';
import { Model, Provider, ApiKey } from '../models';

/**
 * Token estimation (rough approximation)
 * 1 token ≈ 4 characters for English text
 */
export const estimateTokens = (text: string): number => {
  return Math.ceil(text.length / 4);
};

/**
 * Call AI model with streaming support and tool calling
 */
export const streamChatCompletion = async (
  modelId: string,
  messages: Array<{ role: string; content: string }>,
  onChunk: (chunk: string) => void,
  onComplete: (fullResponse: string, tokens: number) => void,
  tools?: Array<any>,
  onToolCall?: (toolCalls: Array<any>) => Promise<Array<any>>
): Promise<void> => {
  try {
    // Look up model and provider from Table Storage
    const modelConfig = await Model.findByModelId(modelId);
    if (!modelConfig || !modelConfig.isActive) {
      throw new Error(`Model ${modelId} not found or inactive`);
    }

    const provider = await Provider.findById(modelConfig.providerId);
    if (!provider || !provider.isActive) {
      throw new Error(`Provider for model ${modelId} not found or inactive`);
    }

    // Look up API key from Table Storage
    const apiKeyConfig = await ApiKey.findById(modelConfig.apiKeyId);
    if (!apiKeyConfig || !apiKeyConfig.isActive) {
      throw new Error(`API key for model ${modelId} not found or inactive`);
    }

    // Make streaming request to AI API
    const requestBody: any = {
      model: modelConfig.modelId,
      messages,
      stream: true,
      temperature: 1,
      max_tokens: 4096,
    };

    // Add tools if provided
    if (tools && tools.length > 0) {
      requestBody.tools = tools;
      requestBody.tool_choice = 'auto';
    }

    // WHAT THIS DOES: Build headers for AI API request
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKeyConfig.apiKey}`,
      'Content-Type': 'application/json',
    };

    // WHAT THIS DOES: Add OpenRouter-specific headers if using OpenRouter
    // OpenRouter requires these headers for proper API usage tracking
    if (provider.baseUrl.includes('openrouter.ai')) {
      headers['HTTP-Referer'] = process.env.OPENROUTER_REFERRER || 'https://chatzone.ai';
      headers['X-Title'] = process.env.OPENROUTER_APP_TITLE || 'ChatZone';
    }

    const response = await axios.post(
      `${provider.baseUrl}/chat/completions`,
      requestBody,
      {
        headers,
        responseType: 'stream',
        timeout: 120000, // WHAT THIS DOES: 2 minute timeout - if model doesn't respond in 2 minutes, throw error
      }
    );

    let fullResponse = '';
    let toolCallsAccumulated: any[] = [];
    let isToolCall = false;

    response.data.on('data', (chunk: Buffer) => {
      const lines = chunk.toString().split('\n').filter((line) => line.trim() !== '');

      for (const line of lines) {
        if (line.includes('[DONE]')) {
          continue;
        }

        if (line.startsWith('data: ')) {
          try {
            const json = JSON.parse(line.substring(6));
            const delta = json.choices?.[0]?.delta;
            const content = delta?.content;
            const toolCalls = delta?.tool_calls;

            // Handle text content
            if (content) {
              fullResponse += content;
              onChunk(content);
            }

            // Handle tool calls
            if (toolCalls) {
              isToolCall = true;
              for (const toolCall of toolCalls) {
                // Accumulate tool call data
                const index = toolCall.index;
                if (!toolCallsAccumulated[index]) {
                  toolCallsAccumulated[index] = {
                    id: toolCall.id || `call_${index}`,
                    type: toolCall.type || 'function',
                    function: {
                      name: toolCall.function?.name || '',
                      arguments: toolCall.function?.arguments || '',
                    },
                  };
                } else {
                  // Append to existing tool call
                  if (toolCall.function?.name) {
                    toolCallsAccumulated[index].function.name += toolCall.function.name;
                  }
                  if (toolCall.function?.arguments) {
                    toolCallsAccumulated[index].function.arguments += toolCall.function.arguments;
                  }
                }
              }
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    });

    response.data.on('end', async () => {
      // If tool calls were made, execute them
      if (isToolCall && toolCallsAccumulated.length > 0 && onToolCall) {
        try {
          const toolResults = await onToolCall(toolCallsAccumulated);
          // Tool results will be handled by the calling function
          // Complete with tool call indicator
          onComplete('__TOOL_CALL__', 0);
        } catch (error) {
          console.error('Tool call execution error:', error);
          onComplete(fullResponse, estimateTokens(fullResponse));
        }
      } else {
        const tokens = estimateTokens(fullResponse);
        onComplete(fullResponse, tokens);
      }
    });

    // WHAT THIS DOES: Handle stream errors (timeout, connection failure, etc.)
    // Without this, stream errors would fail silently and user sees nothing
    response.data.on('error', (streamError: Error) => {
      console.error('Stream error:', streamError);
      // Complete with whatever response we got before error
      onComplete(fullResponse || 'Stream error occurred', estimateTokens(fullResponse));
    });
  } catch (error) {
    throw new Error(`AI service error: ${error}`);
  }
};

/**
 * Non-streaming chat completion
 * Used for system operations like chat naming
 */
export const getChatCompletion = async (
  modelId: string,
  messages: Array<{ role: string; content: string }>
): Promise<{ content: string; tokens: number }> => {
  try {
    const modelConfig = await Model.findByModelId(modelId);
    if (!modelConfig || !modelConfig.isActive) {
      throw new Error(`Model ${modelId} not found or inactive`);
    }

    const provider = await Provider.findById(modelConfig.providerId);
    if (!provider || !provider.isActive) {
      throw new Error(`Provider for model ${modelId} not found or inactive`);
    }

    const apiKeyConfig = modelConfig.apiKeyId ? await ApiKey.findById(modelConfig.apiKeyId) : null;
    if (!apiKeyConfig || !apiKeyConfig.isActive) {
      throw new Error(`API key for model ${modelId} not found or inactive`);
    }

    const response = await axios.post(
      `${provider.baseUrl}/chat/completions`,
      {
        model: modelConfig.modelId,
        messages,
        temperature: 1,
        max_tokens: 4096,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKeyConfig.apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const content = response.data.choices[0].message.content;
    const tokens = estimateTokens(content);

    return { content, tokens };
  } catch (error) {
    throw new Error(`AI service error: ${error}`);
  }
};

/**
 * Generate chat title from first message
 * Creates a 3-5 word title
 */
export const generateChatTitle = async (firstMessage: string): Promise<string> => {
  try {
    const { content } = await getChatCompletion('gpt-3.5-turbo', [
      {
        role: 'system',
        content: 'Generate a 3-5 word title for this conversation. Only respond with the title, nothing else.',
      },
      {
        role: 'user',
        content: firstMessage,
      },
    ]);

    return content.trim();
  } catch (error) {
    // Fallback to truncated first message
    return firstMessage.substring(0, 50) + (firstMessage.length > 50 ? '...' : '');
  }
};

/**
 * Check if a model supports vision/image input
 */
export const modelSupportsVision = (modelId: string): boolean => {
  const visionKeywords = ['vision', '4v', 'claude-3', 'gemini-pro-vision', 'llava'];
  return visionKeywords.some(keyword => modelId.toLowerCase().includes(keyword));
};

/**
 * Get default vision model for a tier (placeholder for admin config)
 * In production, this would fetch from admin panel configuration
 */
export const getDefaultVisionModelForTier = (tier: string): string => {
  // Placeholder mapping - should come from admin configuration
  const visionModelMap: Record<string, string> = {
    free: 'gpt-4-vision',
    tier5: 'gpt-4-vision',
    tier10: 'gpt-4-vision',
    tier15: 'gpt-4-vision',
  };

  return visionModelMap[tier] || 'gpt-4-vision';
};

/**
 * Determine if vision model fallback is needed
 * Returns: { needsFallback: boolean, visionModel: string, originalModel: string }
 */
export const checkVisionFallback = (
  selectedModelId: string,
  tier: string,
  hasImages: boolean
): { needsFallback: boolean; visionModel?: string; originalModel: string } => {
  if (!hasImages) {
    return { needsFallback: false, originalModel: selectedModelId };
  }

  const supportsVision = modelSupportsVision(selectedModelId);
  
  if (supportsVision) {
    return { needsFallback: false, originalModel: selectedModelId };
  }

  const visionModel = getDefaultVisionModelForTier(tier);
  return {
    needsFallback: true,
    visionModel,
    originalModel: selectedModelId,
  };
};

