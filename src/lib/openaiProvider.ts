import { LLMProvider, LLMModel, LLMProviderType } from './llmProvider';

export class OpenAIProvider implements LLMProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async fetchModels(): Promise<LLMModel[]> {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
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
          provider: 'openai' as LLMProviderType
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

  async generateAnswer(prompt: string): Promise<string> {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
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
}