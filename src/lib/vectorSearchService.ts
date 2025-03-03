import * as use from '@tensorflow-models/universal-sentence-encoder';
import * as tf from '@tensorflow/tfjs';
import { Database, ChunkRecord, EmbeddingRecord } from './db';

export class VectorSearchService {
  private db: Database;
  private model: use.UniversalSentenceEncoder | null = null;

  constructor(db: Database) {
    this.db = db;
  }

  private async ensureModelInitialized() {
    if (!this.model) {
      await tf.setBackend('webgl');
      await tf.ready();
      this.model = await use.load();
    }
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    await this.ensureModelInitialized();
    const embeddings = await this.model!.embed(texts);
    return embeddings.arraySync();
  }

  async searchSimilarChunks(query: string, limit = 5): Promise<ChunkRecord[]> {
    await this.ensureModelInitialized();

    // Generate embedding for the query
    const queryEmbedding = await this.generateEmbeddings([query]);
    const queryVector = queryEmbedding[0];

    // Get all embeddings from the database
    const allEmbeddings = await this.db.embeddings.toArray();

    // Calculate cosine similarity between query vector and all stored vectors
    const similarities = allEmbeddings.map(embedding => {
      const similarity = this.cosineSimilarity(queryVector, embedding.vector);
      return { embedding, similarity };
    });

    // Sort by similarity and take the top N
    const topEmbeddings = similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(item => item.embedding);

    // Get the corresponding chunks
    const chunkIds = topEmbeddings.map(embedding => embedding.chunkId);
    const chunks = await this.db.chunks.where('id').anyOf(chunkIds).toArray();

    return chunks;
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    const dotProduct = vecA.reduce((sum, a, idx) => sum + a * vecB[idx], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }
}