export interface ProjectContext {
  id: string;
  name: string;
  description: string;
  promptPrefix: string;
  exampleQuestions: string[];
}

export interface DocumentMetadata {
  size?: number;
  lastModified?: string;
  context?: string;
  tags?: string[];
  [key: string]: any;
}