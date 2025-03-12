export interface LLMModel {
  id: string;
  name: string;
  provider: LLMProviderType;
}

export interface LLMProvider {
  fetchModels(): Promise<LLMModel[]>;
  generateAnswer(prompt: string): Promise<string>;
}

export type LLMProviderType = 'openai' | 'gemini';