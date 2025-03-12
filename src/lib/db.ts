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
    await this.documents.put({
      id: document.id,
      name: document.name,
      content: document.content,
      type: document.type,
      rawContent: document.rawContent,
      metadata: document.metadata || {},
      uploadDate: new Date().toISOString()
    });
    await this.removeOrphanedChunksAndEmbeddings();
  }

  async getDocuments() {
    return this.documents.toArray();
  }

  async getDocument(id: string) {
    return this.documents.get(id);
  }

  async addChunks(chunks: ChunkRecord[]) {
    await this.chunks.bulkPut(chunks);
    await this.removeOrphanedChunksAndEmbeddings();
  }

  async getChunks(documentId: string) {
    return this.chunks.where({ documentId }).toArray();
  }

  async addEmbeddings(embeddings: EmbeddingRecord[]) {
    await this.embeddings.bulkPut(embeddings);
    await this.removeOrphanedChunksAndEmbeddings();
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
    await this.removeOrphanedChunksAndEmbeddings();
  }

  async removeOrphanedChunksAndEmbeddings() {
    // Get all document IDs
    const documentIds = await this.documents.toCollection().primaryKeys();

    // Remove orphaned chunks
    const orphanedChunks = await this.chunks
      .filter(chunk => !documentIds.includes(chunk.documentId))
      .toArray();
    const orphanedChunkIds = orphanedChunks.map(chunk => chunk.id);
    await this.chunks.bulkDelete(orphanedChunkIds);

    // Reload all chunks to get the current state
    const allChunkIds = await this.chunks.toCollection().primaryKeys();

    // Remove orphaned embeddings
    const orphanedEmbeddings = await this.embeddings
      .filter(embedding => !allChunkIds.includes(embedding.chunkId))
      .toArray();
    const orphanedEmbeddingIds = orphanedEmbeddings.map(embedding => embedding.id);
    await this.embeddings.bulkDelete(orphanedEmbeddingIds);
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