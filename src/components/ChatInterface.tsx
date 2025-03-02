import React, { useState, useRef, useEffect } from 'react';
import { Database } from '../lib/db';
import { ChatService, LLMProvider, LLMModel } from '../lib/chatService';
import { Send, Settings, FileText, AlertCircle, Check, RefreshCw, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ProjectContext } from '../lib/types';

interface ChatInterfaceProps {
  db: Database;
  onDocumentSelect: (document: {
    id: string;
    name: string;
    content: string;
    type: string;
    highlights?: { text: string; page?: number; position?: { x: number; y: number; width: number; height: number } }[];
  }) => void;
  activeContext: ProjectContext;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: Array<{
    documentId: string;
    documentName: string;
    content: string;
    metadata: any;
  }>;
}

export function ChatInterface({ db, onDocumentSelect, activeContext }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [openaiApiKey, setOpenaiApiKey] = useState(localStorage.getItem('openai_api_key') || '');
  const [geminiApiKey, setGeminiApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [activeProvider, setActiveProvider] = useState<LLMProvider>(
    (localStorage.getItem('active_llm_provider') as LLMProvider) || 'openai'
  );
  const [availableModels, setAvailableModels] = useState<LLMModel[]>([]);
  const [activeModel, setActiveModel] = useState<string | null>(
    localStorage.getItem('active_llm_model') || null
  );
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [showSettings, setShowSettings] = useState(
    !localStorage.getItem('openai_api_key') && !localStorage.getItem('gemini_api_key')
  );
  const [error, setError] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatService = new ChatService(db);

  useEffect(() => {
    // Scroll to bottom of messages
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Update chat service with the active context
  useEffect(() => {
    chatService.setContextPrompt(activeContext.promptPrefix);
  }, [activeContext]);

  // Fetch available models when provider or API key changes
  useEffect(() => {
    const fetchModels = async () => {
      if ((activeProvider === 'openai' && openaiApiKey) || 
          (activeProvider === 'gemini' && geminiApiKey)) {
        
        setIsLoadingModels(true);
        setError(null);
        
        try {
          // Update the chat service with the current provider and API key
          if (activeProvider === 'openai') {
            chatService.setOpenAIApiKey(openaiApiKey);
          } else {
            chatService.setGeminiApiKey(geminiApiKey);
          }
          
          chatService.setActiveProvider(activeProvider);
          
          // Fetch available models
          const models = await chatService.fetchAvailableModels();
          setAvailableModels(models);
          
          // Set active model from chat service (it might have changed)
          setActiveModel(chatService.getActiveModel());
        } catch (err) {
          console.error('Error fetching models:', err);
          setError(err instanceof Error ? err.message : 'Failed to fetch available models');
        } finally {
          setIsLoadingModels(false);
        }
      } else {
        setAvailableModels([]);
      }
    };
    
    fetchModels();
  }, [activeProvider, openaiApiKey, geminiApiKey]);

  const handleSendMessage = async () => {
    if (!input.trim()) return;
    
    // Check if the active provider has an API key
    if (activeProvider === 'openai' && !openaiApiKey) {
      setError('Please set your OpenAI API key in settings first.');
      setShowSettings(true);
      return;
    } else if (activeProvider === 'gemini' && !geminiApiKey) {
      setError('Please set your Google Gemini API key in settings first.');
      setShowSettings(true);
      return;
    }
    
    // Check if a model is selected
    if (!activeModel) {
      setError(`Please select a model for ${activeProvider === 'openai' ? 'OpenAI' : 'Google Gemini'}.`);
      setShowSettings(true);
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await chatService.processQuery(input, activeContext.id);
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.answer,
        timestamp: new Date(),
        sources: response.sources
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Error processing query:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while processing your query.');
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'An error occurred while processing your query.'}`,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const saveSettings = () => {
    let hasValidKey = false;
    let hasValidModel = false;
    
    if (activeProvider === 'openai' && openaiApiKey.trim()) {
      chatService.setOpenAIApiKey(openaiApiKey);
      hasValidKey = true;
    } else if (activeProvider === 'gemini' && geminiApiKey.trim()) {
      chatService.setGeminiApiKey(geminiApiKey);
      hasValidKey = true;
    }
    
    if (activeModel) {
      chatService.setActiveModel(activeModel);
      hasValidModel = true;
    }
    
    if (hasValidKey && hasValidModel) {
      chatService.setActiveProvider(activeProvider);
      setShowSettings(false);
      setError(null);
    } else if (!hasValidKey) {
      setError(`Please enter a valid API key for ${activeProvider === 'openai' ? 'OpenAI' : 'Google Gemini'}.`);
    } else {
      setError(`Please select a model for ${activeProvider === 'openai' ? 'OpenAI' : 'Google Gemini'}.`);
    }
  };

  const handleRefreshModels = async () => {
    setIsLoadingModels(true);
    setError(null);
    
    try {
      const models = await chatService.fetchAvailableModels();
      setAvailableModels(models);
      
      // Set active model from chat service (it might have changed)
      setActiveModel(chatService.getActiveModel());
    } catch (err) {
      console.error('Error refreshing models:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh available models');
    } finally {
      setIsLoadingModels(false);
    }
  };

  const viewDocument = (documentId: string, content: string, documentName: string, metadata: any) => {
    // Create highlights from the content
    const highlights = [{
      text: content,
      page: metadata.pageNumber,
      position: metadata.position ? {
        x: 0,
        y: 0,
        width: 0,
        height: 0
      } : undefined
    }];

    onDocumentSelect({
      id: documentId,
      name: documentName,
      content,
      type: 'excerpt',
      highlights
    });
  };

  const handleExampleClick = (question: string) => {
    setInput(question);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-800">Chat with Your Documents</h2>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center text-blue-600 hover:text-blue-800"
        >
          <Settings className="h-5 w-5 mr-1" />
          Settings
        </button>
      </div>

      {showSettings && (
        <div className="bg-blue-50 p-4 rounded-lg mb-4">
          <h3 className="font-medium text-blue-800 mb-2">LLM Settings</h3>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select LLM Provider
            </label>
            <div className="flex space-x-4">
              <button
                onClick={() => setActiveProvider('openai')}
                className={`px-4 py-2 rounded-md flex items-center ${
                  activeProvider === 'openai'
                    ? 'bg-blue-100 border-blue-500 border text-blue-700'
                    : 'bg-white border border-gray-300 text-gray-700'
                }`}
              >
                {activeProvider === 'openai' && <Check className="h-4 w-4 mr-1" />}
                OpenAI
              </button>
              <button
                onClick={() => setActiveProvider('gemini')}
                className={`px-4 py-2 rounded-md flex items-center ${
                  activeProvider === 'gemini'
                    ? 'bg-blue-100 border-blue-500 border text-blue-700'
                    : 'bg-white border border-gray-300 text-gray-700'
                }`}
              >
                {activeProvider === 'gemini' && <Check className="h-4 w-4 mr-1" />}
                Google Gemini
              </button>
            </div>
          </div>
          
          <div className="space-y-4">
            {/* OpenAI API Key - only show when OpenAI is selected */}
            {activeProvider === 'openai' && (
              <div>
                <label htmlFor="openaiApiKey" className="block text-sm font-medium text-gray-700 mb-1">
                  OpenAI API Key <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  id="openaiApiKey"
                  value={openaiApiKey}
                  onChange={(e) => setOpenaiApiKey(e.target.value)}
                  className={`w-full p-2 border rounded-md ${
                    !openaiApiKey
                      ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                      : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                  }`}
                  placeholder="sk-..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Required for OpenAI. Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">OpenAI dashboard</a>.
                </p>
              </div>
            )}
            
            {/* Gemini API Key - only show when Gemini is selected */}
            {activeProvider === 'gemini' && (
              <div>
                <label htmlFor="geminiApiKey" className="block text-sm font-medium text-gray-700 mb-1">
                  Google Gemini API Key <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  id="geminiApiKey"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  className={`w-full p-2 border rounded-md ${
                    !geminiApiKey
                      ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                      : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                  }`}
                  placeholder="AI..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Required for Gemini. Get your API key from <a href="https://ai.google.dev/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google AI Studio</a>.
                </p>
              </div>
            )}
            
            {/* Model Selection */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  Select Model <span className="text-red-500">*</span>
                </label>
                <button 
                  onClick={handleRefreshModels}
                  disabled={isLoadingModels || (!openaiApiKey && activeProvider === 'openai') || (!geminiApiKey && activeProvider === 'gemini')}
                  className="text-xs flex items-center text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`h-3 w-3 mr-1 ${isLoadingModels ? 'animate-spin' : ''}`} />
                  Refresh Models
                </button>
              </div>
              
              {isLoadingModels ? (
                <div className="bg-gray-100 p-3 rounded-md text-center flex items-center justify-center">
                  <Loader2 className="h-4 w-4 animate-spin mr-2 text-blue-600" />
                  <span className="text-sm text-gray-600">Loading available models...</span>
                </div>
              ) : availableModels.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {availableModels.map(model => (
                    <button
                      key={model.id}
                      onClick={() => setActiveModel(model.id)}
                      className={`p-2 text-sm rounded-md text-left ${
                        activeModel === model.id
                          ? 'bg-blue-100 border-blue-500 border text-blue-700'
                          : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center">
                        {activeModel === model.id && <Check className="h-3 w-3 mr-1 flex-shrink-0" />}
                        <span className="truncate">{model.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="bg-gray-100 p-2 rounded-md text-center text-sm text-gray-600">
                  {(activeProvider === 'openai' && !openaiApiKey) || (activeProvider === 'gemini' && !geminiApiKey)
                    ? `Enter your ${activeProvider === 'openai' ? 'OpenAI' : 'Google Gemini'} API key to see available models`
                    : 'No models available'}
                </div>
              )}
            </div>
          </div>
          
          <p className="text-xs text-gray-500 mt-4 mb-3">
            Your API keys are stored locally in your browser and never sent to our servers.
          </p>
          
          <button
            onClick={saveSettings}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Save Settings
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 p-3 rounded-md mb-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      <div className="flex-grow overflow-y-auto mb-4 border border-gray-200 rounded-lg bg-gray-50 p-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>No messages yet. Start by asking a question about your documents.</p>
            <div className="mt-6 space-y-2">
              <p className="text-sm font-medium text-gray-600">Try asking:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {activeContext.exampleQuestions.map((question, index) => (
                  <button
                    key={index}
                    onClick={() => handleExampleClick(question)}
                    className="px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-3/4 rounded-lg p-3 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-gray-200'
                  }`}
                >
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                  
                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-gray-200">
                      <p className="text-xs font-medium text-gray-500 mb-1">Sources:</p>
                      <div className="space-y-2">
                        {message.sources.map((source, index) => (
                          <div key={index} className="bg-gray-50 p-2 rounded text-xs">
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-medium text-gray-700">
                                {source.documentName}
                                {source.metadata.pageNumber ? ` (Page ${source.metadata.pageNumber})` : ''}
                              </span>
                              <button
                                onClick={() => viewDocument(
                                  source.documentId,
                                  source.content,
                                  source.documentName,
                                  source.metadata
                                )}
                                className="text-blue-600 hover:text-blue-800 flex items-center"
                              >
                                <FileText className="h-3 w-3 mr-1" />
                                View
                              </button>
                            </div>
                            <p className="text-gray-600 line-clamp-2">{source.content}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="text-right mt-1">
                    <span
                      className={`text-xs ${
                        message.role === 'user' ? 'text-blue-200' : 'text-gray-400'
                      }`}
                    >
                      {message.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="relative">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Ask a question about your ${activeContext.name.toLowerCase()}...`}
          className="w-full p-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          rows={3}
          disabled={isLoading}
        />
        <button
          onClick={handleSendMessage}
          disabled={isLoading || !input.trim()}
          className={`absolute right-3 bottom-3 p-2 rounded-full ${
            isLoading || !input.trim()
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </button>
      </div>
      
      {isLoading && (
        <div className="text-center text-sm text-gray-500 mt-2">
          Processing your query with {activeProvider === 'openai' ? 'OpenAI' : 'Google Gemini'} 
          {activeModel && ` (${availableModels.find(m => m.id === activeModel)?.name || activeModel})`}...
        </div>
      )}
    </div>
  );
}