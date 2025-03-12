import { Database, ChunkRecord } from './db';
import { VectorSearchService } from './vectorSearchService';
import { LLMProvider, LLMModel, LLMProviderType } from './llmProvider';
import { OpenAIProvider } from './openaiProvider';
import { GeminiProvider } from './geminiProvider';

export class ChatService {
  private db: Database;
  private vectorSearchService: VectorSearchService;
  private llmProvider: LLMProvider | null = null;
  private activeProvider: LLMProviderType = 'openai';
  private contextPrompt: string = '';
  private availableModels: LLMModel[] = [];

  constructor(db: Database) {
    this.db = db;
    this.vectorSearchService = new VectorSearchService(db);
    this.setProviderFromLocalStorage();
  }

  private setProviderFromLocalStorage() {
    const provider = localStorage.getItem('active_llm_provider') as LLMProviderType || 'openai';
    const apiKey = localStorage.getItem(`${provider}_api_key`);
    const activeModel = localStorage.getItem('active_llm_model') || null;

    if (provider === 'openai' && apiKey) {
      this.llmProvider = new OpenAIProvider(apiKey);
    } else if (provider === 'gemini' && apiKey) {
      this.llmProvider = new GeminiProvider(apiKey, activeModel || 'gemini-1.5-flash');
    }

    this.activeProvider = provider;
  }

  setOpenAIApiKey(key: string) {
    localStorage.setItem('openai_api_key', key);
    if (this.activeProvider === 'openai') {
      this.llmProvider = new OpenAIProvider(key);
    }
  }

  setGeminiApiKey(key: string) {
    localStorage.setItem('gemini_api_key', key);
    if (this.activeProvider === 'gemini') {
      this.llmProvider = new GeminiProvider(key);
    }
  }

  setActiveProvider(provider: LLMProviderType) {
    this.activeProvider = provider;
    localStorage.setItem('active_llm_provider', provider);
    this.setProviderFromLocalStorage();
  }

  setActiveModel(modelId: string | null) {
    if (modelId) {
      localStorage.setItem('active_llm_model', modelId);
    } else {
      localStorage.removeItem('active_llm_model');
    }
  }

  setContextPrompt(prompt: string) {
    this.contextPrompt = prompt;
  }

  getActiveProvider(): LLMProviderType {
    return this.activeProvider;
  }

  getActiveModel(): string | null {
    return localStorage.getItem('active_llm_model');
  }

  getAvailableModels(): LLMModel[] {
    return this.availableModels;
  }

  hasApiKey(provider: LLMProviderType): boolean {
    const apiKey = localStorage.getItem(`${provider}_api_key`);
    return !!apiKey;
  }

  async fetchAvailableModels(): Promise<LLMModel[]> {
    if (!this.llmProvider) {
      throw new Error('LLM provider is not set. Please set it in the settings.');
    }

    this.availableModels = await this.llmProvider.fetchModels();

    // If we have models and no active model is set, set the first one as default
    if (this.availableModels.length > 0 && !localStorage.getItem('active_llm_model')) {
      this.setActiveModel(this.availableModels[0].id);
    }

    return this.availableModels;
  }

  async processQuery(query: string, contextId?: string): Promise<{
    answer: string;
    sources: Array<{
      documentId: string;
      documentName: string;
      content: string;
      metadata: any;
    }>;
  }> {
    if (!this.llmProvider) {
      throw new Error('LLM provider is not set. Please set it in the settings.');
    }

    try {
      // 1. Get relevant chunks using vector similarity search
      const relevantChunks = await this.vectorSearchService.searchSimilarChunks(query);

      if (relevantChunks.length === 0) {
        return {
          answer: "I couldn't find any relevant information in the uploaded documents. Please try a different query or upload more documents.",
          sources: []
        };
      }

      // 2. Get document details for each chunk
      const sources = await Promise.all(
        relevantChunks.map(async (chunk) => {
          const document = await this.db.getDocument(chunk.documentId);
          return {
            documentId: chunk.documentId,
            documentName: document?.name || 'Unknown document',
            content: chunk.content,
            metadata: chunk.metadata
          };
        })
      );

      // 3. Generate answer using the selected LLM provider
      const answer = await this.generateAnswer(query, relevantChunks);

      return {
        answer,
        sources
      };
    } catch (error) {
      console.error('Error processing query:', error);
      throw error;
    }
  }

  private async generateAnswer(query: string, relevantChunks: ChunkRecord[]): Promise<string> {
    if (!this.llmProvider) {
      throw new Error('LLM provider is not set. Please set it in the settings.');
    }

    // Prepare context from relevant chunks
    const context = relevantChunks.map(chunk => {
      const pageInfo = chunk.metadata.pageNumber
        ? `[Page ${chunk.metadata.pageNumber}]`
        : '';
      return `${pageInfo} ${chunk.content}`;
    }).join('\n\n');

    // Prepare the prompt for the LLM
    const prompt = `
${this.contextPrompt || 'You are an expert document analysis assistant. Your task is to answer questions about the provided documents.'}

CONTEXT INFORMATION:
${context}

USER QUESTION:
${query}

Please provide a clear, concise answer based only on the information in the context. If the information is not in the context, say "I couldn't find this information in the provided documents." 

For any values, dates, or specific details you mention, indicate which document and page they came from. If you're quoting directly from a document, use quotation marks and cite the source.
`;

    return this.llmProvider.generateAnswer(prompt);
  }
}