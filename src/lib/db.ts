import Dexie from 'dexie';

export class Database extends Dexie {
  documents: Dexie.Table<DocumentRecord, string>;
  chunks: Dexie.Table<ChunkRecord, string>;
  embeddings: Dexie.Table<EmbeddingRecord, string>;

  constructor() {
    super('PensionBackfileDB');
    
    this.version(1).stores({
      documents: 'id, name, type, uploadDate',
      chunks: 'id, documentId, content, metadata',
      embeddings: 'id, chunkId, vector, *tokens'
    });
    
    this.documents = this.table('documents');
    this.chunks = this.table('chunks');
    this.embeddings = this.table('embeddings');
  }

  async addDocument(document: {
    id: string;
    name: string;
    content: string;
    type: string;
    rawContent?: string;
    metadata?: Record<string, any>;
  }) {
    return this.documents.put({
      id: document.id,
      name: document.name,
      content: document.content,
      type: document.type,
      rawContent: document.rawContent,
      metadata: document.metadata || {},
      uploadDate: new Date().toISOString()
    });
  }

  async getDocuments() {
    return this.documents.toArray();
  }

  async getDocument(id: string) {
    return this.documents.get(id);
  }

  async addChunks(chunks: ChunkRecord[]) {
    return this.chunks.bulkPut(chunks);
  }

  async getChunks(documentId: string) {
    return this.chunks.where({ documentId }).toArray();
  }

  async addEmbeddings(embeddings: EmbeddingRecord[]) {
    return this.embeddings.bulkPut(embeddings);
  }

  async searchSimilarChunks(queryVector: number[], limit = 5) {
    // This is a simplified version - in a real app, you'd implement 
    // vector similarity search (cosine similarity, dot product, etc.)
    // For now, we'll just return the first few chunks as a placeholder
    const allEmbeddings = await this.embeddings.toArray();
    
    // Sort by a simple similarity measure (this is just a placeholder)
    // In a real app, you'd use proper vector similarity calculations
    const results = allEmbeddings
      .map(embedding => {
        // Simplified similarity calculation (not accurate for production)
        const similarity = 0.5; // Placeholder
        return { embedding, similarity };
      })
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
    
    // Get the corresponding chunks
    const chunks = await Promise.all(
      results.map(result => this.chunks.get(result.embedding.chunkId))
    );
    
    return chunks.filter(Boolean) as ChunkRecord[];
  }

  async removeDocument(documentId: string) {
    // Remove the document
    await this.documents.delete(documentId);

    // Remove associated chunks
    await this.chunks.where({ documentId }).delete();

    // Remove associated embeddings
    const chunkIds = await this.chunks.where({ documentId }).primaryKeys();
    await this.embeddings.where('chunkId').anyOf(chunkIds).delete();
  }
}

export interface DocumentRecord {
  id: string;
  name: string;
  content: string;
  type: string;
  rawContent?: string;
  metadata?: Record<string, any>;
  uploadDate: string;
}

export interface ChunkRecord {
  id: string;
  documentId: string;
  content: string;
  metadata: {
    pageNumber?: number;
    position?: { start: number; end: number };
    [key: string]: any;
  };
}

export interface EmbeddingRecord {
  id: string;
  chunkId: string;
  vector: number[];
  tokens: string[];
}