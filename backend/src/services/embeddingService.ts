// Embedding service for RAG implementation
// Generates vector embeddings using Jina AI embeddings-v3
// Optimized with caching for faster repeated embeddings
// Includes retry logic, batch size limiting, and timeout handling
import axios from 'axios';
import crypto from 'crypto';

// In-memory cache for embeddings (hash of text -> embedding)
// Prevents regenerating embeddings for duplicate content
const embeddingCache = new Map<string, number[]>();

// Configuration constants
const MAX_BATCH_SIZE = 20; // Maximum texts per API request
const REQUEST_TIMEOUT = 60000; // 60 seconds timeout
const MAX_RETRIES = 3; // Maximum retry attempts
const INITIAL_RETRY_DELAY = 1000; // 1 second initial delay

/**
 * Sleep helper for retry delays
 */
const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Generate hash of text for cache lookup
 */
const hashText = (text: string): string => {
  return crypto.createHash('sha256').update(text).digest('hex');
};

/**
 * Generate embeddings for text with caching and retry logic
 * Optimized: Checks cache first to avoid redundant API calls
 * Includes exponential backoff for transient errors
 */
export const generateEmbedding = async (text: string): Promise<number[]> => {
  // Check cache first
  const textHash = hashText(text);
  if (embeddingCache.has(textHash)) {
    return embeddingCache.get(textHash)!;
  }

  // Use Jina AI endpoint (configurable via env)
  const EMBEDDING_API_URL = process.env.EMBEDDING_API_URL || 'https://api.jina.ai/v1';
    const EMBEDDING_API_KEY = process.env.EMBEDDING_API_KEY || process.env.OPENAI_API_KEY;

    if (!EMBEDDING_API_KEY) {
      throw new Error('No embedding API key configured');
    }

  let lastError: any;
  
  // Retry loop with exponential backoff
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
    const response = await axios.post(
      `${EMBEDDING_API_URL}/embeddings`,
      {
          model: 'jina-embeddings-v3',
        input: text,
      },
      {
        headers: {
          'Authorization': `Bearer ${EMBEDDING_API_KEY}`,
          'Content-Type': 'application/json',
        },
          timeout: REQUEST_TIMEOUT,
      }
    );

      const embedding = response.data.data[0].embedding;
      
      // Cache the result
      embeddingCache.set(textHash, embedding);
      
      return embedding;
  } catch (error: any) {
      lastError = error;
      
      // Check if error is retryable
      const isRetryable = 
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ECONNREFUSED' ||
        error.response?.status === 429 ||
        error.response?.status >= 500;

      if (isRetryable && attempt < MAX_RETRIES - 1) {
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
        console.log(`⚠️  Embedding API error (attempt ${attempt + 1}/${MAX_RETRIES}): ${error.message}. Retrying in ${delay}ms...`);
        await sleep(delay);
        continue;
      }
      
      // Non-retryable error or max retries reached
      break;
    }
  }

  console.error('Embedding generation error:', lastError.response?.data || lastError.message);
  throw new Error('Failed to generate embedding after retries');
};

/**
 * Generate embeddings for multiple texts in batch with caching, retry logic, and batch size limiting
 * Optimized: 
 * - Checks cache for each text, only generates embeddings for uncached texts
 * - Splits large batches into smaller chunks (max 20 per request)
 * - Includes exponential backoff for transient errors
 * - 60 second timeout per request
 */
export const generateEmbeddingsBatch = async (texts: string[]): Promise<number[][]> => {
  const EMBEDDING_API_URL = process.env.EMBEDDING_API_URL || 'https://api.jina.ai/v1';
    const EMBEDDING_API_KEY = process.env.EMBEDDING_API_KEY || process.env.OPENAI_API_KEY;

    if (!EMBEDDING_API_KEY) {
      throw new Error('No embedding API key configured');
    }

  // Split texts into cached and uncached
  const results: number[][] = new Array(texts.length);
  const uncachedIndices: number[] = [];
  const uncachedTexts: string[] = [];

  texts.forEach((text, index) => {
    const textHash = hashText(text);
    if (embeddingCache.has(textHash)) {
      results[index] = embeddingCache.get(textHash)!;
    } else {
      uncachedIndices.push(index);
      uncachedTexts.push(text);
    }
  });

  // If all texts were cached, return immediately
  if (uncachedTexts.length === 0) {
    console.log(`✅ All ${texts.length} embeddings retrieved from cache`);
    return results;
  }

  console.log(`📊 Generating ${uncachedTexts.length} embeddings (${texts.length - uncachedTexts.length} cached)`);

  // Split uncached texts into batches of MAX_BATCH_SIZE
  const batches: string[][] = [];
  for (let i = 0; i < uncachedTexts.length; i += MAX_BATCH_SIZE) {
    batches.push(uncachedTexts.slice(i, i + MAX_BATCH_SIZE));
  }

  console.log(`📦 Processing ${batches.length} batch(es) of max ${MAX_BATCH_SIZE} texts each`);

  // Process each batch with retry logic
  const allNewEmbeddings: number[][] = [];
  
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    let lastError: any;
    let batchEmbeddings: number[][] | null = null;

    // Retry loop for this batch
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
    const response = await axios.post(
      `${EMBEDDING_API_URL}/embeddings`,
      {
            model: 'jina-embeddings-v3',
            input: batch,
      },
      {
        headers: {
          'Authorization': `Bearer ${EMBEDDING_API_KEY}`,
          'Content-Type': 'application/json',
        },
            timeout: REQUEST_TIMEOUT,
      }
    );

        batchEmbeddings = response.data.data.map((item: any) => item.embedding);
        console.log(`✅ Batch ${batchIndex + 1}/${batches.length} completed (${batch.length} embeddings)`);
        break; // Success, exit retry loop
  } catch (error: any) {
        lastError = error;
        
        // Check if error is retryable
        const isRetryable = 
          error.code === 'ECONNRESET' ||
          error.code === 'ETIMEDOUT' ||
          error.code === 'ECONNREFUSED' ||
          error.response?.status === 429 ||
          error.response?.status >= 500;

        if (isRetryable && attempt < MAX_RETRIES - 1) {
          const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
          console.log(`⚠️  Batch ${batchIndex + 1}/${batches.length} error (attempt ${attempt + 1}/${MAX_RETRIES}): ${error.message}. Retrying in ${delay}ms...`);
          await sleep(delay);
          continue;
        }
        
        // Non-retryable error or max retries reached
        break;
      }
    }

    // If batch failed after all retries, throw error
    if (!batchEmbeddings) {
      console.error('Batch embedding generation error:', lastError.response?.data || lastError.message);
      throw new Error(`Failed to generate embeddings for batch ${batchIndex + 1}/${batches.length} after ${MAX_RETRIES} retries`);
  }

    allNewEmbeddings.push(...batchEmbeddings);
  }

  // Cache new embeddings and place them in results array
  uncachedIndices.forEach((originalIndex, newIndex) => {
    const embedding = allNewEmbeddings[newIndex];
    const textHash = hashText(uncachedTexts[newIndex]);
    embeddingCache.set(textHash, embedding);
    results[originalIndex] = embedding;
  });

  return results;
};

/**
 * Calculate cosine similarity between two vectors
 * Used for finding most relevant document chunks
 */
export const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must be of equal length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
};

/**
 * Compress embedding vector for storage
 * Converts Float64 to Float32 to reduce storage size by 50%
 */
export const compressEmbedding = (embedding: number[]): number[] => {
  // Convert to Float32Array to reduce precision and size
  const float32Array = new Float32Array(embedding);
  return Array.from(float32Array);
};

/**
 * Decompress embedding vector for similarity calculations
 * Converts Float32 back to standard number array
 */
export const decompressEmbedding = (compressedEmbedding: number[]): number[] => {
  return compressedEmbedding; // Already in usable format
};

/**
 * Chunk text into smaller pieces for embedding
 * Optimized: Each chunk is ~1000 tokens (~4000 characters)
 * Reduced overlap from 200 to 100 characters for fewer chunks
 */
export const chunkText = (text: string, chunkSize: number = 4000, overlap: number = 100): string[] => {
  // Preprocess: Remove excessive whitespace
  const cleanedText = text.replace(/\s+/g, ' ').trim();
  
  const chunks: string[] = [];
  let start = 0;

  while (start < cleanedText.length) {
    const end = Math.min(start + chunkSize, cleanedText.length);
    const chunk = cleanedText.slice(start, end);
    
    // Skip empty or very small chunks
    if (chunk.length > 50) {
    chunks.push(chunk);
    }
    
    // Move forward with reduced overlap
    start += chunkSize - overlap;
  }

  return chunks;
};

