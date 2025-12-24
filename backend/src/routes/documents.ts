// Document upload and management routes
// Handles RAG document uploads and retrieval
// OPTIMIZATIONS IMPLEMENTED:
// 1. Instant upload response - processing happens in background
// 2. Larger chunk size (4000 chars) - fewer chunks to process
// 3. Reduced overlap (100 chars) - fewer duplicate chunks
// 4. Embedding caching - avoid regenerating same embeddings
// 5. Parallel database operations - MongoDB writes happen simultaneously
// 6. Unordered bulk inserts - faster database writes
// 7. Connection pooling - reuse database connections
// 8. Whitespace compression - cleaner text processing
// 9. Embedding compression (Float32) - 50% storage reduction
// 10. Progress tracking - real-time status updates (extracting→chunking→embedding→storing)
// 11. Optimized MongoDB indexes - faster queries on userId, projectId, documentId
// 12. Batch size limiting - max 20 chunks per API request (prevents timeouts)
// 13. Retry logic with exponential backoff - handles transient connection errors
// 14. Request timeout (60s) - prevents hanging requests
// 15. Jina AI endpoint configuration - correct API URL for embedding provider
import express from 'express';
import multer from 'multer';
import { authenticateJWT } from '../middleware/auth';
import { uploadFile, extractTextFromFile } from '../services/storageService';
import { generateEmbedding, generateEmbeddingsBatch, compressEmbedding } from '../services/embeddingService';
import { chunkText } from '../services/embeddingService';
import { Document, DocumentChunk } from '../models/Document';
import { searchDocuments } from '../services/ragService';
import { TierService } from '../services/tierService';

const router = express.Router();

// Configure multer for file uploads (in-memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Accept ALL file types
    // Text/Documents → RAG embeddings
    // Images → Vision model processing (if tier has multimodal)
    // Code files → RAG embeddings
    cb(null, true);
  },
});

// Upload document
// POST /api/documents/upload
// Body: multipart/form-data with file field
router.post('/upload', authenticateJWT as any, upload.single('file'), async (req: any, res) => {
  try {
    const user = req.user;
    const file = req.file;
    const { projectId } = req.body;

    if (!file) {
      return res.status(400).json({ message: 'No file provided' });
    }

    // Get storage limit from TierService (centralized tier limit management)
    const userLimit = await TierService.getStorageLimit(user.tier);

    // Check if user's tier supports document uploads
    if (userLimit === 0) {
      return res.status(403).json({ message: 'Document uploads not available in your tier' });
    }

    // Calculate current storage usage by summing file sizes of all user's documents
    const userDocs = await Document.find({ userId: user.rowKey });
    const currentUsage = userDocs.reduce((sum, doc) => sum + doc.fileSize, 0);

    // Enforce storage limit
    if (currentUsage + file.size > userLimit) {
      return res.status(403).json({
        message: 'Storage limit exceeded',
        currentUsage,
        limit: userLimit,
      });
    }

    // Upload file to Azure Blob Storage
    const blobUrl = await uploadFile(file.buffer, file.originalname, user.rowKey);

    // Create document record
    const document = new Document({
      userId: user.rowKey,
      projectId: projectId || undefined,
      fileName: file.originalname,
      fileSize: file.size,
      fileType: file.originalname.split('.').pop()?.toLowerCase() || 'unknown',
      blobUrl,
      status: 'processing',
    });

    await document.save();

    // Respond immediately so the frontend doesn't wait for heavy processing
    res.status(201).json({
      message: 'Document uploaded successfully',
      document: {
        id: (document._id as any).toString(),
        fileName: document.fileName,
        status: document.status,
      },
    });

    // Process document asynchronously (extract text, generate embeddings)
    setImmediate(() => {
      processDocument((document._id as any).toString(), file.buffer, file.originalname, user.rowKey, projectId)
        .catch((error) => {
          console.error('Document processing error:', error);
        });
    });
  } catch (error: any) {
    console.error('Document upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload document',
    });
  }
});

// Get user's documents
// GET /api/documents
router.get('/', authenticateJWT as any, async (req: any, res) => {
  try {
    const user = req.user;
    const { projectId, status } = req.query;

    const query: any = { userId: user.rowKey };
    if (projectId) query.projectId = projectId;
    if (status) query.status = status;

    const documents = await Document.find(query).sort({ uploadedAt: -1 });

    res.json({ documents });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load documents',
    });
  }
});

// Delete document
// DELETE /api/documents/:id
router.delete('/:id', authenticateJWT as any, async (req: any, res) => {
  try {
    const user = req.user;
    const document = await Document.findOne({ _id: req.params.id, userId: user.rowKey });

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Delete document chunks
    await DocumentChunk.deleteMany({ documentId: document._id });

    // Delete document record
    await document.deleteOne();

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete document',
    });
  }
});

// Search documents (for testing RAG)
// POST /api/documents/search
router.post('/search', authenticateJWT as any, async (req: any, res) => {
  try {
    const user = req.user;
    const { query, projectId, topK = 5 } = req.body;

    if (!query) {
      return res.status(400).json({ message: 'Query is required' });
    }

    const results = await searchDocuments(user.rowKey, query, topK, projectId);

    res.json({
      query,
      results: results.map((chunk) => ({
        documentName: chunk.documentName,
        content: chunk.content.slice(0, 500), // Return preview
        chunkIndex: chunk.chunkIndex,
      })),
    });
  } catch (error) {
    console.error('Document search error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search documents',
    });
  }
});

/**
 * Background document processing
 * Optimized: Parallel operations, efficient chunking, cached embeddings, progress tracking
 * Extracts text, chunks it, generates embeddings, stores in database
 */
async function processDocument(
  documentId: string,
  fileBuffer: Buffer,
  fileName: string,
  userId: string,
  projectId?: string
): Promise<void> {
  try {
    // Stage 1: Extract text from file
    await Document.findByIdAndUpdate(documentId, {
      processingProgress: 10,
      processingStage: 'extracting'
    });
    
    const text = await extractTextFromFile(fileBuffer, fileName);

    if (!text || text.length < 10) {
      throw new Error('No text extracted from document');
    }

    // Stage 2: Chunk text
    await Document.findByIdAndUpdate(documentId, {
      processingProgress: 30,
      processingStage: 'chunking'
    });
    
    const chunks = chunkText(text, 4000, 100);

    // Stage 3: Generate embeddings
    await Document.findByIdAndUpdate(documentId, {
      processingProgress: 50,
      processingStage: 'embedding'
    });
    
    const embeddings = await generateEmbeddingsBatch(chunks);

    // Compress embeddings to reduce storage size (Float64 → Float32)
    const compressedEmbeddings = embeddings.map(compressEmbedding);

    // Stage 4: Store in database
    await Document.findByIdAndUpdate(documentId, {
      processingProgress: 80,
      processingStage: 'storing'
    });

    // Prepare chunk documents for batch insertion
    const chunkDocs = chunks.map((content, index) => ({
      userId,
      projectId: projectId || undefined,
      documentId,
      documentName: fileName,
      chunkIndex: index,
      content,
      embedding: compressedEmbeddings[index],
      metadata: {
        fileType: fileName.split('.').pop()?.toLowerCase() || 'unknown',
        uploadedAt: new Date(),
      },
    }));

    // Parallel operations: Store chunks and update document status
    await Promise.all([
      DocumentChunk.insertMany(chunkDocs, { ordered: false }), // Unordered for faster insertion
      Document.findByIdAndUpdate(documentId, {
      status: 'ready',
      chunkCount: chunks.length,
      totalTokens: Math.ceil(text.length / 4), // Rough token estimate
      processedAt: new Date(),
        processingProgress: 100,
        processingStage: 'complete'
      })
    ]);

    console.log(`✅ Document processed: ${fileName} (${chunks.length} chunks)`);
  } catch (error: any) {
    console.error('Document processing failed:', error);
    
    // Update document with error status
    await Document.findByIdAndUpdate(documentId, {
      status: 'error',
      errorMessage: error.message,
      processingProgress: 0,
    });
  }
}

export default router;

