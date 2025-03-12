import React, { useState, useEffect } from 'react';
import { FileUploader } from './components/FileUploader';
import { DocumentProcessor } from './components/DocumentProcessor';
import { ChatInterface } from './components/ChatInterface';
import { DocumentViewer } from './components/DocumentViewer';
import { Database } from './lib/db';
import { FileSearch, MessageCircle, Upload, FileText, Settings } from 'lucide-react';
import { ProjectContext } from './lib/types';

// Initialize the database
const db = new Database();

// Available project contexts
const availableContexts: ProjectContext[] = [
  {
    id: 'pensions',
    name: 'Pension Backfiles',
    description: 'UK Pensions Administration Tool',
    promptPrefix: 'You are an expert UK pensions administrator assistant. Focus specifically on UK pension terminology and regulations. If you identify information about transfers, scheme details, benefit values, or retirement options, highlight these clearly.',
    exampleQuestions: [
      'What is the transfer value mentioned in the documents?',
      'When can I access my pension benefits?',
      'What are the death benefits in my pension scheme?'
    ]
  },
  {
    id: 'university',
    name: 'University Assessments',
    description: 'Academic Assessment Analysis Tool',
    promptPrefix: 'You are an expert academic assessor. Analyze the documents for academic quality, structure, and content. Evaluate whether the assessment meets the required criteria and provide constructive feedback.',
    exampleQuestions: [
      'Does this assessment meet the criteria for a distinction?',
      'What are the main subjects covered in this document?',
      'How could this assignment be improved?'
    ]
  },
  {
    id: 'legal',
    name: 'Legal Documents',
    description: 'Legal Document Analysis Tool',
    promptPrefix: 'You are a legal document specialist. Analyze contracts, agreements, and legal correspondence for key terms, obligations, and potential issues. Highlight important clauses and legal implications.',
    exampleQuestions: [
      'What are the key obligations in this contract?',
      'When does this agreement expire?',
      'Are there any concerning clauses in this document?'
    ]
  },
  {
    id: 'medical',
    name: 'Medical Records',
    description: 'Medical Documentation Analysis Tool',
    promptPrefix: 'You are a medical records specialist. Analyze medical documents for key diagnoses, treatments, and medical history. Focus on medical terminology and healthcare information.',
    exampleQuestions: [
      'What treatments are mentioned in these records?',
      'When was the last consultation date?',
      'Are there any medication allergies noted?'
    ]
  }
];

function App() {
  const [activeTab, setActiveTab] = useState('upload');
  const [processingStatus, setProcessingStatus] = useState<{
    isProcessing: boolean;
    progress: number;
    message: string;
  }>({
    isProcessing: false,
    progress: 0,
    message: '',
  });
  const [selectedDocument, setSelectedDocument] = useState<{
    id: string;
    name: string;
    content: string;
    type: string;
    highlights?: { text: string; page?: number; position?: { x: number; y: number; width: number; height: number } }[];
  } | null>(null);
  const [activeContext, setActiveContext] = useState<ProjectContext>(
    () => {
      const savedContextId = localStorage.getItem('active_context_id');
      return savedContextId 
        ? availableContexts.find(ctx => ctx.id === savedContextId) || availableContexts[0]
        : availableContexts[0];
    }
  );
  const [showContextSelector, setShowContextSelector] = useState(false);

  useEffect(() => {
    // Save the active context to localStorage whenever it changes
    localStorage.setItem('active_context_id', activeContext.id);
  }, [activeContext]);

  const handleProcessingUpdate = (status: { isProcessing: boolean; progress: number; message: string }) => {
    setProcessingStatus(status);
  };

  const handleDocumentSelect = (document: {
    id: string;
    name: string;
    content: string;
    type: string;
    highlights?: { text: string; page?: number; position?: { x: number; y: number; width: number; height: number } }[];
  }) => {
    setSelectedDocument(document);
    setActiveTab('view');
  };

  const handleContextChange = (context: ProjectContext) => {
    setActiveContext(context);
    setShowContextSelector(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-blue-700 text-white p-4 shadow-md">
        <div className="container mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center">
            <FileSearch className="mr-2" />
            Document Chat
          </h1>
          <div className="flex items-center">
            <div className="relative">
              <button 
                onClick={() => setShowContextSelector(!showContextSelector)}
                className="flex items-center text-white bg-blue-800 hover:bg-blue-900 px-3 py-1 rounded-md text-sm"
              >
                <span>{activeContext.name}</span>
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                </svg>
              </button>
              
              {showContextSelector && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg z-10">
                  <div className="py-1">
                    {availableContexts.map(context => (
                      <button
                        key={context.id}
                        onClick={() => handleContextChange(context)}
                        className={`w-full text-left px-4 py-2 text-sm ${
                          activeContext.id === context.id 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <div className="font-medium">{context.name}</div>
                        <div className="text-xs text-gray-500">{context.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="text-sm ml-4">{activeContext.description}</div>
          </div>
        </div>
      </header>

      <main className="flex-grow container mx-auto p-4 flex flex-col md:flex-row gap-4">
        <div className="w-full md:w-64 bg-white rounded-lg shadow-md p-4">
          <nav className="space-y-2">
            <button
              onClick={() => setActiveTab('upload')}
              className={`w-full flex items-center p-3 rounded-md ${
                activeTab === 'upload' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
              }`}
            >
              <Upload className="mr-2 h-5 w-5" />
              Upload Documents
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`w-full flex items-center p-3 rounded-md ${
                activeTab === 'chat' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
              }`}
            >
              <MessageCircle className="mr-2 h-5 w-5" />
              Chat Interface
            </button>
            <button
              onClick={() => setActiveTab('view')}
              className={`w-full flex items-center p-3 rounded-md ${
                activeTab === 'view' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
              }`}
              disabled={!selectedDocument}
            >
              <FileText className="mr-2 h-5 w-5" />
              Document Viewer
              {!selectedDocument && <span className="ml-1 text-xs text-gray-500">(Select a document first)</span>}
            </button>
          </nav>

          {processingStatus.isProcessing && (
            <div className="mt-6 p-3 bg-blue-50 rounded-md">
              <h3 className="font-medium text-blue-700">Processing Documents</h3>
              <div className="mt-2">
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full"
                    style={{ width: `${processingStatus.progress}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-600 mt-1">{processingStatus.message}</p>
              </div>
            </div>
          )}

          <div className="mt-6 p-3 bg-blue-50 rounded-md">
            <h3 className="font-medium text-blue-700 flex items-center">
              <Settings className="h-4 w-4 mr-1" />
              Current Context: {activeContext.name}
            </h3>
            <p className="text-xs text-gray-600 mt-2">
              {activeContext.description}
            </p>
            <div className="mt-3">
              <p className="text-xs font-medium text-blue-700">Example questions:</p>
              <ul className="text-xs text-gray-600 mt-1 list-disc list-inside">
                {activeContext.exampleQuestions.map((question, index) => (
                  <li key={index}>{question}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="flex-grow bg-white rounded-lg shadow-md p-6">
          {activeTab === 'upload' && (
            <FileUploader 
              db={db} 
              onProcessingUpdate={handleProcessingUpdate} 
              onDocumentSelect={handleDocumentSelect}
              activeContext={activeContext}
            />
          )}
          {activeTab === 'chat' && (
            <ChatInterface 
              db={db} 
              onDocumentSelect={handleDocumentSelect} 
              activeContext={activeContext}
            />
          )}
          {activeTab === 'view' && selectedDocument && (
            <DocumentViewer document={selectedDocument} />
          )}
          {activeTab === 'view' && !selectedDocument && (
            <div className="text-center py-12">
              <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-700 mb-2">No Document Selected</h3>
              <p className="text-gray-500 max-w-md mx-auto">
                Please select a document from the Upload Documents tab or from the Chat Interface to view its contents here.
              </p>
              <button
                onClick={() => setActiveTab('upload')}
                className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Go to Upload Documents
              </button>
            </div>
          )}
        </div>
      </main>

      <footer className="bg-gray-100 border-t border-gray-200 p-4">
        <div className="container mx-auto text-center text-gray-600 text-sm">
          Document Chat © {new Date().getFullYear()} - Document Analysis Tool
        </div>
      </footer>
    </div>
  );
}

export default App;