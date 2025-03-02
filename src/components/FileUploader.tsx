import React, { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Database } from '../lib/db';
import { DocumentProcessor } from '../lib/documentProcessor';
import { FileUp, File, CheckCircle, AlertCircle, Info, Eye, Tag } from 'lucide-react';
import { ProjectContext } from '../lib/types';

interface FileUploaderProps {
  db: Database;
  onProcessingUpdate: (status: { isProcessing: boolean; progress: number; message: string }) => void;
  onDocumentSelect?: (document: {
    id: string;
    name: string;
    content: string;
    type: string;
  }) => void;
  activeContext: ProjectContext;
}

export function FileUploader({ db, onProcessingUpdate, onDocumentSelect, activeContext }: FileUploaderProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [processedFiles, setProcessedFiles] = useState<string[]>([]);
  const [failedFiles, setFailedFiles] = useState<{ name: string; error: string }[]>([]);
  const [documents, setDocuments] = useState<Array<{ id: string; name: string; type: string; uploadDate: string; context?: string }>>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [documentTags, setDocumentTags] = useState<{ [fileIndex: number]: string[] }>({});
  const [newTag, setNewTag] = useState('');

  const documentProcessor = new DocumentProcessor(db, onProcessingUpdate);

  useEffect(() => {
    // Load existing documents
    const loadDocuments = async () => {
      const docs = await db.getDocuments();
      setDocuments(docs.map(doc => ({
        id: doc.id,
        name: doc.name,
        type: doc.type,
        uploadDate: doc.uploadDate,
        context: doc.metadata?.context
      })));
    };

    loadDocuments();
  }, [db, processedFiles]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles(prev => [...prev, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'image/*': ['.jpg', '.jpeg', '.png', '.tiff', '.bmp'],
      'text/plain': ['.txt']
    }
  });

  const processFiles = async () => {
    if (files.length === 0 || isProcessing) return;

    setIsProcessing(true);
    const processed: string[] = [];
    const failed: { name: string; error: string }[] = [];

    for (const [index, file] of files.entries()) {
      try {
        onProcessingUpdate({
          isProcessing: true,
          progress: 0,
          message: `Starting to process ${file.name}...`
        });

        // Add context and tags to metadata
        const metadata = {
          size: file.size,
          lastModified: new Date(file.lastModified).toISOString(),
          context: activeContext.id,
          tags: documentTags[index] || []
        };

        const documentId = await documentProcessor.processFile(file, metadata);
        processed.push(file.name);
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
        failed.push({ 
          name: file.name, 
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        });
      }
    }

    setProcessedFiles(prev => [...prev, ...processed]);
    setFailedFiles(prev => [...prev, ...failed]);
    setFiles([]);
    setDocumentTags({});
    setIsProcessing(false);
    
    onProcessingUpdate({
      isProcessing: false,
      progress: 100,
      message: 'All files processed'
    });
  };

  const removeFile = (fileIndex: number) => {
    const newFiles = [...files];
    newFiles.splice(fileIndex, 1);
    setFiles(newFiles);
    
    // Also remove tags for this file
    const newDocumentTags = { ...documentTags };
    delete newDocumentTags[fileIndex];
    
    // Reindex the remaining files
    const reindexedTags: { [fileIndex: number]: string[] } = {};
    Object.keys(newDocumentTags).forEach((key) => {
      const index = parseInt(key);
      if (index > fileIndex) {
        reindexedTags[index - 1] = newDocumentTags[index];
      } else {
        reindexedTags[index] = newDocumentTags[index];
      }
    });
    
    setDocumentTags(reindexedTags);
  };

  const handleViewDocument = async (documentId: string) => {
    if (!onDocumentSelect) return;
    
    try {
      const document = await db.getDocument(documentId);
      if (document) {
        onDocumentSelect({
          id: document.id,
          name: document.name,
          content: document.content,
          type: document.type
        });
      }
    } catch (error) {
      console.error('Error loading document for viewing:', error);
    }
  };

  const addTag = (fileIndex: number) => {
    if (!newTag.trim()) return;
    
    setDocumentTags(prev => {
      const currentTags = prev[fileIndex] || [];
      if (!currentTags.includes(newTag.trim())) {
        return {
          ...prev,
          [fileIndex]: [...currentTags, newTag.trim()]
        };
      }
      return prev;
    });
    
    setNewTag('');
  };

  const removeTag = (fileIndex: number, tag: string) => {
    setDocumentTags(prev => {
      const currentTags = prev[fileIndex] || [];
      return {
        ...prev,
        [fileIndex]: currentTags.filter(t => t !== tag)
      };
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-gray-800">Upload Documents</h2>
        <p className="text-gray-600">
          Upload documents for processing in the <span className="font-medium">{activeContext.name}</span> context.
        </p>
      </div>

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
        }`}
      >
        <input {...getInputProps()} />
        <FileUp className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-2 text-sm font-medium text-gray-900">
          {isDragActive ? 'Drop the files here' : 'Drag & drop files here, or click to select files'}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          PDF, DOCX, JPG, PNG, TXT (Max 50MB per file)
        </p>
      </div>

      {files.length > 0 && (
        <div className="mt-4">
          <h3 className="font-medium text-gray-900 mb-2">Files to process:</h3>
          <ul className="space-y-4">
            {files.map((file, index) => (
              <li key={index} className="p-3 bg-gray-50 rounded-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <File className="h-5 w-5 text-gray-500 mr-2" />
                    <span className="text-sm text-gray-700">{file.name}</span>
                  </div>
                  <button
                    onClick={() => removeFile(index)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    Remove
                  </button>
                </div>
                
                {/* Tags section */}
                <div className="mt-2">
                  <div className="flex items-center text-sm">
                    <Tag className="h-4 w-4 text-gray-500 mr-1" />
                    <span className="text-gray-600">Tags:</span>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mt-1">
                    {(documentTags[index] || []).map((tag, tagIndex) => (
                      <span 
                        key={tagIndex} 
                        className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                      >
                        {tag}
                        <button 
                          onClick={() => removeTag(index, tag)}
                          className="ml-1 text-blue-600 hover:text-blue-800"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                    
                    <div className="flex items-center">
                      <input
                        type="text"
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        placeholder="Add tag..."
                        className="text-xs border border-gray-300 rounded-l-md px-2 py-1 w-24"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addTag(index);
                          }
                        }}
                      />
                      <button
                        onClick={() => addTag(index)}
                        className="text-xs bg-blue-600 text-white px-2 py-1 rounded-r-md hover:bg-blue-700"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <button
            onClick={processFiles}
            disabled={isProcessing}
            className={`mt-4 px-4 py-2 rounded-md text-white font-medium ${
              isProcessing
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isProcessing ? 'Processing...' : 'Process Files'}
          </button>
        </div>
      )}

      {processedFiles.length > 0 && (
        <div className="mt-6">
          <h3 className="font-medium text-gray-900 mb-2">Successfully processed:</h3>
          <ul className="space-y-1">
            {processedFiles.map((fileName, index) => (
              <li key={index} className="flex items-center text-sm text-green-600">
                <CheckCircle className="h-4 w-4 mr-2" />
                {fileName}
              </li>
            ))}
          </ul>
        </div>
      )}

      {failedFiles.length > 0 && (
        <div className="mt-4">
          <h3 className="font-medium text-gray-900 mb-2">Failed to process:</h3>
          <ul className="space-y-2">
            {failedFiles.map((file, index) => (
              <li key={index} className="flex items-start text-sm text-red-600 bg-red-50 p-2 rounded">
                <AlertCircle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">{file.name}</p>
                  <p className="text-xs mt-1">{file.error}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {documents.length > 0 && (
        <div className="mt-8 border-t pt-6">
          <h3 className="font-medium text-gray-900 mb-4">Uploaded Documents</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Context
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Upload Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {doc.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {doc.type.toUpperCase()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {doc.context ? (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                          {doc.context}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(doc.uploadDate).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <button
                        onClick={() => handleViewDocument(doc.id)}
                        className="text-blue-600 hover:text-blue-800 flex items-center"
                        title="View Document"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {documents.length === 0 && !isProcessing && (
        <div className="mt-8 bg-blue-50 p-4 rounded-lg flex items-start">
          <Info className="h-5 w-5 text-blue-500 mr-2 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-800">Getting Started</h4>
            <p className="text-sm text-blue-700 mt-1">
              Upload documents to begin. Once processed, you can search and query them using the Chat interface.
            </p>
            <ul className="text-sm text-blue-700 mt-2 list-disc list-inside">
              <li>PDF files: Reports, statements, assessments</li>
              <li>Word documents: Essays, reports, letters</li>
              <li>Images: Scanned documents, certificates</li>
              <li>Text files: Notes, data, transcripts</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}