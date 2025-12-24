// Document model for RAG system
// Stores user-uploaded documents and their metadata
import mongoose, { Schema, Document as MongooseDocument } from 'mongoose';

// Interface for a document chunk with embeddings
export interface IDocumentChunk extends MongooseDocument {
  userId: string; // UUID from Azure Table Storage
  projectId?: string; // UUID from Azure Table Storage (optional)
  documentId: mongoose.Types.ObjectId;
  documentName: string;
  chunkIndex: number;
  content: string; // The actual text chunk
  embedding: number[]; // Vector embedding (1536 dimensions for text-embedding-3-small)
  metadata: {
    pageNumber?: number;
    section?: string;
    fileType: string;
    uploadedAt: Date;
  };
  createdAt: Date;
}

// Schema for document chunks
const DocumentChunkSchema = new Schema({
  userId: { type: String, required: true, index: true }, // UUID from Azure Table Storage
  projectId: { type: String, index: true }, // UUID from Azure Table Storage (optional)
  documentId: { type: Schema.Types.ObjectId, required: true, index: true },
  documentName: { type: String, required: true },
  chunkIndex: { type: Number, required: true },
  content: { type: String, required: true },
  embedding: { type: [Number], required: true }, // Vector for similarity search
  metadata: {
    pageNumber: Number,
    section: String,
    fileType: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  createdAt: { type: Date, default: Date.now },
});

// Compound index for efficient querying
DocumentChunkSchema.index({ userId: 1, projectId: 1 });
DocumentChunkSchema.index({ documentId: 1, chunkIndex: 1 });

// Interface for document metadata
export interface IDocument extends MongooseDocument {
  userId: string; // UUID from Azure Table Storage
  projectId?: string; // UUID from Azure Table Storage (optional)
  fileName: string;
  fileSize: number; // In bytes
  fileType: string; // pdf, docx, txt, csv, etc.
  blobUrl: string; // Azure Blob Storage URL
  status: 'processing' | 'ready' | 'error';
  chunkCount: number;
  totalTokens: number;
  errorMessage?: string;
  uploadedAt: Date;
  processedAt?: Date;
  // Progress tracking
  processingProgress?: number; // 0-100 percentage
  processingStage?: string; // 'extracting' | 'chunking' | 'embedding' | 'storing'
}

// Schema for document metadata
const DocumentSchema = new Schema({
  userId: { type: String, required: true, index: true }, // UUID from Azure Table Storage
  projectId: { type: String, index: true }, // UUID from Azure Table Storage (optional)
  fileName: { type: String, required: true },
  fileSize: { type: Number, required: true },
  fileType: { type: String, required: true },
  blobUrl: { type: String, required: true },
  status: {
    type: String,
    enum: ['processing', 'ready', 'error'],
    default: 'processing',
  },
  chunkCount: { type: Number, default: 0 },
  totalTokens: { type: Number, default: 0 },
  errorMessage: String,
  uploadedAt: { type: Date, default: Date.now },
  processedAt: Date,
  // Progress tracking fields
  processingProgress: { type: Number, default: 0, min: 0, max: 100 },
  processingStage: { 
    type: String, 
    enum: ['extracting', 'chunking', 'embedding', 'storing', 'complete'],
    default: 'extracting'
  },
});

// Indexes for efficient queries
DocumentSchema.index({ userId: 1, status: 1 });
DocumentSchema.index({ projectId: 1, status: 1 });

export const DocumentChunk = mongoose.model<IDocumentChunk>('DocumentChunk', DocumentChunkSchema);
export const Document = mongoose.model<IDocument>('Document', DocumentSchema);

export default Document;

