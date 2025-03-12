import { LLMProvider, LLMModel, LLMProviderType } from './llmProvider';
import { GoogleGenerativeAI } from '@google/generative-ai';

export class GeminiProvider implements LLMProvider {
  private apiKey: string;
  private activeModel: string;

  constructor(apiKey: string, activeModel: string = 'gemini-1.5-flash') {
    this.apiKey = apiKey;
    this.activeModel = activeModel;
  }

  async fetchModels(): Promise<LLMModel[]> {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch Gemini models: ${response.statusText}`);
      }

      const data = await response.json();

      // Filter models by supported methods
      const supportedModels = data.models.filter((model: any) => 
        model.supportedGenerationMethods && model.supportedGenerationMethods.includes('generateContent')
      );

      // Map the models to the LLMModel format
      const geminiModels = supportedModels.map((model: any) => ({
        id: model.name,
        name: model.displayName,
        provider: 'gemini' as LLMProviderType
      }));

      return geminiModels;
    } catch (error) {
      console.error('Error fetching Gemini models:', error);

      // Return default models if API call fails
      return [
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'gemini' },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'gemini' },
        { id: 'gemini-1.0-pro', name: 'Gemini 1.0 Pro', provider: 'gemini' }
      ];
    }
  }

  async generateAnswer(prompt: string): Promise<string> {
    try {
      // Initialize the Gemini API
      const genAI = new GoogleGenerativeAI(this.apiKey);
      
      // Use the selected model or default to gemini-1.5-flash
      const model = genAI.getGenerativeModel({ model: this.activeModel });
      
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