import React, { useState } from 'react';
import { ArrowLeft, Search, ZoomIn, ZoomOut } from 'lucide-react';

interface DocumentViewerProps {
  document: {
    id: string;
    name: string;
    content: string;
    type: string;
    highlights?: { 
      text: string; 
      page?: number; 
      position?: { 
        x: number; 
        y: number; 
        width: number; 
        height: number 
      } 
    }[];
  };
}

export function DocumentViewer({ document }: DocumentViewerProps) {
  const [zoomLevel, setZoomLevel] = useState(100);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeHighlight, setActiveHighlight] = useState(0);

  const increaseZoom = () => {
    setZoomLevel(prev => Math.min(prev + 10, 200));
  };

  const decreaseZoom = () => {
    setZoomLevel(prev => Math.max(prev - 10, 50));
  };

  const highlightMatches = (text: string) => {
    if (!searchTerm) return text;
    
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  };

  const formatContent = () => {
    let content = document.content;
    
    // For PDF content with page markers
    if (document.type === 'pdf' && content.includes('Page')) {
      return content.split(/Page \d+:/).map((page, index) => {
        if (!page.trim()) return null;
        return (
          <div key={index} className="mb-6">
            <h3 className="font-bold text-gray-700 mb-2">Page {index}</h3>
            <div 
              className="whitespace-pre-wrap" 
              dangerouslySetInnerHTML={{ __html: highlightMatches(page) }} 
            />
          </div>
        );
      });
    }
    
    // For excerpt type (from chat interface)
    if (document.type === 'excerpt') {
      return (
        <div className="bg-yellow-50 p-4 border-l-4 border-yellow-400">
          <div 
            className="whitespace-pre-wrap" 
            dangerouslySetInnerHTML={{ __html: highlightMatches(content) }} 
          />
          {document.highlights?.[0]?.page && (
            <div className="mt-2 text-sm text-gray-500">
              From page {document.highlights[0].page}
            </div>
          )}
        </div>
      );
    }
    
    // Default rendering
    return (
      <div 
        className="whitespace-pre-wrap" 
        dangerouslySetInnerHTML={{ __html: highlightMatches(content) }} 
      />
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-800 truncate flex-1">
          {document.name}
        </h2>
        <div className="flex items-center space-x-2">
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search in document..."
              className="pl-8 pr-2 py-1 border border-gray-300 rounded-md text-sm"
            />
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          </div>
          <button
            onClick={decreaseZoom}
            className="p-1 rounded-md hover:bg-gray-100"
            title="Zoom out"
          >
            <ZoomOut className="h-5 w-5 text-gray-600" />
          </button>
          <span className="text-sm text-gray-600">{zoomLevel}%</span>
          <button
            onClick={increaseZoom}
            className="p-1 rounded-md hover:bg-gray-100"
            title="Zoom in"
          >
            <ZoomIn className="h-5 w-5 text-gray-600" />
          </button>
        </div>
      </div>

      {document.highlights && document.highlights.length > 0 && (
        <div className="mb-4 bg-blue-50 p-3 rounded-md">
          <h3 className="font-medium text-blue-800 mb-2">Highlighted Content</h3>
          <div className="space-y-2">
            {document.highlights.map((highlight, index) => (
              <div 
                key={index}
                className={`p-2 rounded cursor-pointer ${
                  activeHighlight === index ? 'bg-blue-100 border border-blue-300' : 'bg-white border border-gray-200'
                }`}
                onClick={() => setActiveHighlight(index)}
              >
                <p className="text-sm text-gray-800">{highlight.text.substring(0, 150)}...</p>
                {highlight.page && (
                  <p className="text-xs text-gray-500 mt-1">Page {highlight.page}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div 
        className="flex-grow overflow-y-auto border border-gray-200 rounded-lg p-4 bg-white"
        style={{ fontSize: `${zoomLevel}%` }}
      >
        {formatContent()}
      </div>
    </div>
  );
}