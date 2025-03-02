import { Database, ChunkRecord } from './db';
import { GoogleGenerativeAI } from '@google/generative-ai';

export type LLMProvider = 'openai' | 'gemini';

export interface LLMModel {
  id: string;
  name: string;
  provider: LLMProvider;
}

export class ChatService {
  private db: Database;
  private openaiApiKey: string | null = null;
  private geminiApiKey: string | null = null;
  private activeProvider: LLMProvider = 'openai';
  private activeModel: string | null = null;
  private contextPrompt: string = '';
  private availableModels: LLMModel[] = [];

  constructor(db: Database) {
    this.db = db;
    // Try to get API keys from localStorage if available
    this.openaiApiKey = localStorage.getItem('openai_api_key');
    this.geminiApiKey = localStorage.getItem('gemini_api_key');
    this.activeProvider = localStorage.getItem('active_llm_provider') as LLMProvider || 'openai';
    this.activeModel = localStorage.getItem('active_llm_model') || null;
  }

  setOpenAIApiKey(key: string) {
    this.openaiApiKey = key;
    localStorage.setItem('openai_api_key', key);
  }

  setGeminiApiKey(key: string) {
    this.geminiApiKey = key;
    localStorage.setItem('gemini_api_key', key);
  }

  setActiveProvider(provider: LLMProvider) {
    this.activeProvider = provider;
    localStorage.setItem('active_llm_provider', provider);
    // Reset active model when changing provider
    this.setActiveModel(null);
  }

  setActiveModel(modelId: string | null) {
    this.activeModel = modelId;
    if (modelId) {
      localStorage.setItem('active_llm_model', modelId);
    } else {
      localStorage.removeItem('active_llm_model');
    }
  }

  setContextPrompt(prompt: string) {
    this.contextPrompt = prompt;
  }

  getActiveProvider(): LLMProvider {
    return this.activeProvider;
  }

  getActiveModel(): string | null {
    return this.activeModel;
  }

  getAvailableModels(): LLMModel[] {
    return this.availableModels;
  }

  hasApiKey(provider: LLMProvider): boolean {
    if (provider === 'openai') {
      return !!this.openaiApiKey;
    } else if (provider === 'gemini') {
      return !!this.geminiApiKey;
    }
    return false;
  }

  async fetchAvailableModels(): Promise<LLMModel[]> {
    this.availableModels = [];
    
    try {
      if (this.activeProvider === 'openai' && this.openaiApiKey) {
        const models = await this.fetchOpenAIModels();
        this.availableModels = models;
      } else if (this.activeProvider === 'gemini' && this.geminiApiKey) {
        const models = this.getGeminiModels();
        this.availableModels = models;
      }
      
      // If we have models and no active model is set, set the first one as default
      if (this.availableModels.length > 0 && !this.activeModel) {
        this.setActiveModel(this.availableModels[0].id);
      }
      
      return this.availableModels;
    } catch (error) {
      console.error('Error fetching models:', error);
      return [];
    }
  }

  private async fetchOpenAIModels(): Promise<LLMModel[]> {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch OpenAI models: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Filter for chat models only and sort by newest first
      const chatModels = data.data
        .filter((model: any) => 
          model.id.includes('gpt') && 
          !model.id.includes('instruct') && 
          !model.id.includes('-vision-') &&
          !model.id.includes('ft-')
        )
        .sort((a: any, b: any) => new Date(b.created).getTime() - new Date(a.created).getTime())
        .map((model: any) => ({
          id: model.id,
          name: this.formatModelName(model.id),
          provider: 'openai' as LLMProvider
        }));
      
      // Ensure GPT-4o is at the top if available
      const gpt4oIndex = chatModels.findIndex((model: LLMModel) => model.id === 'gpt-4o');
      if (gpt4oIndex !== -1) {
        const gpt4o = chatModels.splice(gpt4oIndex, 1)[0];
        chatModels.unshift(gpt4o);
      }
      
      return chatModels;
    } catch (error) {
      console.error('Error fetching OpenAI models:', error);
      
      // Return default models if API call fails
      return [
        { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai' },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai' }
      ];
    }
  }

  private getGeminiModels(): LLMModel[] {
    // Gemini doesn't have a models endpoint, so we hardcode the available models
    return [
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'gemini' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'gemini' },
      { id: 'gemini-1.0-pro', name: 'Gemini 1.0 Pro', provider: 'gemini' }
    ];
  }

  private formatModelName(modelId: string): string {
    // Convert model IDs to more readable names
    const nameMap: Record<string, string> = {
      'gpt-4o': 'GPT-4o',
      'gpt-4-turbo': 'GPT-4 Turbo',
      'gpt-4': 'GPT-4',
      'gpt-3.5-turbo': 'GPT-3.5 Turbo'
    };
    
    return nameMap[modelId] || modelId;
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
    // Check if the active provider has an API key
    if (this.activeProvider === 'openai' && !this.openaiApiKey) {
      throw new Error('OpenAI API key is not set. Please set it in the settings.');
    } else if (this.activeProvider === 'gemini' && !this.geminiApiKey) {
      throw new Error('Google Gemini API key is not set. Please set it in the settings.');
    }

    // Check if we have an active model
    if (!this.activeModel) {
      // Try to fetch models and set a default
      await this.fetchAvailableModels();
      if (!this.activeModel && this.availableModels.length > 0) {
        this.setActiveModel(this.availableModels[0].id);
      }
      
      if (!this.activeModel) {
        throw new Error(`No model selected for ${this.activeProvider}. Please select a model in settings.`);
      }
    }

    try {
      // 1. Get relevant chunks using vector similarity search
      const relevantChunks = await this.searchRelevantChunks(query, contextId);
      
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

  private async searchRelevantChunks(query: string, contextId?: string): Promise<ChunkRecord[]> {
    // In a real application, you would:
    // 1. Generate embeddings for the query
    // 2. Perform vector similarity search against stored embeddings
    // 3. Return the most relevant chunks
    
    // For this demo, we'll use a simplified approach
    // that searches for keyword matches in the chunks
    
    // Get all chunks from the database
    const allDocuments = await this.db.getDocuments();
    
    if (allDocuments.length === 0) {
      return [];
    }
    
    // Filter documents by context if provided
    const filteredDocuments = contextId
      ? allDocuments.filter(doc => doc.metadata?.context === contextId)
      : allDocuments;
    
    if (filteredDocuments.length === 0) {
      return [];
    }
    
    // Get chunks from filtered documents
    const allChunksPromises = filteredDocuments.map(doc => this.db.getChunks(doc.id));
    const allChunksArrays = await Promise.all(allChunksPromises);
    const allChunks = allChunksArrays.flat();
    
    if (allChunks.length === 0) {
      return [];
    }
    
    // Simple keyword matching (in a real app, use vector similarity)
    const keywords = query.toLowerCase().split(/\s+/);
    
    // Score each chunk based on keyword matches
    const scoredChunks = allChunks.map(chunk => {
      const content = chunk.content.toLowerCase();
      let score = 0;
      
      keywords.forEach(keyword => {
        if (content.includes(keyword)) {
          score += 1;
          
          // Bonus points for context-specific terms
          if (contextId === 'pensions' && 
              ['pension', 'transfer', 'value', 'scheme', 'benefit', 'retirement', 'annuity', 'contribution', 'fund'].includes(keyword)) {
            score += 2;
          } else if (contextId === 'university' && 
                    ['assessment', 'grade', 'essay', 'criteria', 'academic', 'research', 'study', 'analysis', 'conclusion'].includes(keyword)) {
            score += 2;
          } else if (contextId === 'legal' && 
                    ['contract', 'agreement', 'clause', 'party', 'legal', 'law', 'obligation', 'rights', 'liability'].includes(keyword)) {
            score += 2;
          } else if (contextId === 'medical' && 
                    ['patient', 'diagnosis', 'treatment', 'doctor', 'hospital', 'medication', 'symptom', 'condition', 'health'].includes(keyword)) {
            score += 2;
          }
        }
      });
      
      return { chunk, score };
    });
    
    // Sort by score and take the top 5
    const topChunks = scoredChunks
      .sort((a, b) => b.score - a.score)
      .filter(item => item.score > 0)
      .slice(0, 5)
      .map(item => item.chunk);
    
    return topChunks;
  }

  private async generateAnswer(query: string, relevantChunks: ChunkRecord[]): Promise<string> {
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

    // Use the selected LLM provider and model
    if (this.activeProvider === 'openai') {
      return this.generateOpenAIAnswer(prompt);
    } else if (this.activeProvider === 'gemini') {
      return this.generateGeminiAnswer(prompt);
    } else {
      throw new Error('Invalid LLM provider selected');
    }
  }

  private async generateOpenAIAnswer(prompt: string): Promise<string> {
    if (!this.openaiApiKey) {
      throw new Error('OpenAI API key is not set');
    }

    try {
      // Call OpenAI API
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.openaiApiKey}`
        },
        body: JSON.stringify({
          model: this.activeModel || 'gpt-4o',
          messages: [
            { role: 'system', content: 'You are a document analysis expert assistant.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('Error calling OpenAI API:', error);
      
      // Fallback response if API call fails
      return `I encountered an error while processing your query with OpenAI. Please check your API key and try again. Error details: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private async generateGeminiAnswer(prompt: string): Promise<string> {
    if (!this.geminiApiKey) {
      throw new Error('Google Gemini API key is not set');
    }

    try {
      // Initialize the Gemini API
      const genAI = new GoogleGenerativeAI(this.geminiApiKey);
      
      // Use the selected model or default to gemini-1.5-flash
      const modelName = this.activeModel || "gemini-1.5-flash";
      const model = genAI.getGenerativeModel({ model: modelName });
      
      const result = await model.generateContent(prompt);
      const response = result.response;
      return response.text();
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      
      // Fallback response if API call fails
      return `I encountered an error while processing your query with Google Gemini. Please check your API key and try again. Error details: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}