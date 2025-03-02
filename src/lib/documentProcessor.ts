import { v4 as uuidv4 } from 'uuid';
import * as pdfjs from 'pdfjs-dist';
import mammoth from 'mammoth';
import Tesseract from 'tesseract.js';
import { Database, ChunkRecord } from './db';
import { DocumentMetadata } from './types';

// Set the PDF.js worker source
//import * as pdfjsWorker from 'pdfjs-dist/build/pdf.worker.entry';
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs`;

export class DocumentProcessor {
  private db: Database;
  private onProgressUpdate: (status: { isProcessing: boolean; progress: number; message: string }) => void;

  constructor(
    db: Database,
    onProgressUpdate: (status: { isProcessing: boolean; progress: number; message: string }) => void
  ) {
    this.db = db;
    this.onProgressUpdate = onProgressUpdate;
  }

  async processFile(file: File, metadata: DocumentMetadata = {}): Promise<string> {
    this.onProgressUpdate({
      isProcessing: true,
      progress: 0,
      message: `Processing ${file.name}...`
    });

    try {
      let content = '';
      let rawContent = '';
      const fileType = this.getFileType(file);

      // Extract text based on file type
      if (fileType === 'pdf') {
        const result = await this.extractTextFromPDF(file);
        content = result.content;
        rawContent = result.rawContent;
      } else if (fileType === 'docx') {
        content = await this.extractTextFromDOCX(file);
        rawContent = content;
      } else if (fileType === 'image') {
        content = await this.extractTextFromImage(file);
        rawContent = content;
      } else {
        // For plain text files
        content = await file.text();
        rawContent = content;
      }

      this.onProgressUpdate({
        isProcessing: true,
        progress: 50,
        message: `Extracted text from ${file.name}, creating document record...`
      });

      // Create document record
      const documentId = uuidv4();
      await this.db.addDocument({
        id: documentId,
        name: file.name,
        content: content,
        type: fileType,
        rawContent: rawContent,
        metadata: {
          ...metadata,
          size: file.size,
          lastModified: new Date(file.lastModified).toISOString()
        }
      });

      // Create chunks from the document
      this.onProgressUpdate({
        isProcessing: true,
        progress: 75,
        message: `Creating text chunks for ${file.name}...`
      });

      const chunks = this.createChunks(documentId, content, fileType);
      await this.db.addChunks(chunks);

      // In a real app, you would create embeddings here
      // For now, we'll just create placeholder embeddings
      this.onProgressUpdate({
        isProcessing: true,
        progress: 90,
        message: `Creating embeddings for ${file.name}...`
      });

      // Placeholder for embeddings
      const embeddings = chunks.map(chunk => ({
        id: uuidv4(),
        chunkId: chunk.id,
        vector: Array(384).fill(0).map(() => Math.random()), // Placeholder vector
        tokens: chunk.content.split(/\s+/).slice(0, 20) // Simplified tokens
      }));

      await this.db.addEmbeddings(embeddings);

      this.onProgressUpdate({
        isProcessing: false,
        progress: 100,
        message: `Completed processing ${file.name}`
      });

      return documentId;
    } catch (error) {
      console.error('Error processing file:', error);
      this.onProgressUpdate({
        isProcessing: false,
        progress: 0,
        message: `Error processing ${file.name}: ${error instanceof Error ? error.message : String(error)}`
      });
      throw error;
    }
  }

  private getFileType(file: File): string {
    const extension = file.name.split('.').pop()?.toLowerCase() || '';

    if (['pdf'].includes(extension)) {
      return 'pdf';
    } else if (['docx', 'doc'].includes(extension)) {
      return 'docx';
    } else if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'tif'].includes(extension)) {
      return 'image';
    } else {
      return 'text';
    }
  }

  private async extractTextFromPDF(file: File): Promise<{ content: string; rawContent: string }> {
    const arrayBuffer = await file.arrayBuffer();

    // Load the PDF document with proper error handling
    let pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

    let fullText = '';
    let rawContent = '';

    // Process each page with proper error handling
    for (let i = 1; i <= pdf.numPages; i++) {
      this.onProgressUpdate({
        isProcessing: true,
        progress: Math.floor((i / pdf.numPages) * 40),
        message: `Extracting text from PDF page ${i} of ${pdf.numPages}...`
      });

      try {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();

        // Extract text items
        const pageText = textContent.items
          .map(item => 'str' in item ? item.str : '')
          .join(' ');

        fullText += `Page ${i}:\n${pageText}\n\n`;
        rawContent += pageText + '\n';
      } catch (pageError) {
        console.error(`Error extracting text from page ${i}:`, pageError);
        fullText += `Page ${i}:\n[Error extracting text from this page]\n\n`;
      }
    }

    // If we couldn't extract any text, return an error message
    if (!fullText.trim()) {
      this.onProgressUpdate({
        isProcessing: false,
        progress: 0,
        message: 'No text could be extracted from this PDF. It may be scanned or contain only images.'
      });
      return {
        content: '[No text could be extracted from this PDF. It may be scanned or contain only images.]',
        rawContent: ''
      };
    }

    return { content: fullText, rawContent };

  }

  private async extractTextFromDOCX(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  }

  private async extractTextFromImage(file: File): Promise<string> {
    this.onProgressUpdate({
      isProcessing: true,
      progress: 20,
      message: `Performing OCR on image ${file.name}...`
    });

    const result = await Tesseract.recognize(file, 'eng', {
      logger: m => {
        if (m.status === 'recognizing text') {
          this.onProgressUpdate({
            isProcessing: true,
            progress: 20 + Math.floor(m.progress * 20),
            message: `OCR progress: ${Math.floor(m.progress * 100)}%`
          });
        }
      }
    });

    return result.data.text;
  }

  private createChunks(documentId: string, content: string, fileType: string): ChunkRecord[] {
    const chunks: ChunkRecord[] = [];

    // Different chunking strategies based on file type
    if (fileType === 'pdf') {
      // Split by pages first
      const pages = content.split(/Page \d+:/);

      pages.forEach((pageContent, pageIndex) => {
        if (!pageContent.trim()) return;

        // Further split each page into paragraphs or sections
        const paragraphs = pageContent.split(/\n\s*\n/);

        paragraphs.forEach((paragraph) => {
          if (paragraph.trim().length < 10) return; // Skip very short paragraphs

          chunks.push({
            id: uuidv4(),
            documentId,
            content: paragraph.trim(),
            metadata: {
              pageNumber: pageIndex,
              position: {
                start: pageContent.indexOf(paragraph),
                end: pageContent.indexOf(paragraph) + paragraph.length
              },
              chunkType: 'paragraph'
            }
          });
        });
      });
    } else {
      // For other document types, split by paragraphs
      const paragraphs = content.split(/\n\s*\n/);

      paragraphs.forEach((paragraph, index) => {
        if (paragraph.trim().length < 10) return; // Skip very short paragraphs

        chunks.push({
          id: uuidv4(),
          documentId,
          content: paragraph.trim(),
          metadata: {
            position: {
              start: content.indexOf(paragraph),
              end: content.indexOf(paragraph) + paragraph.length
            },
            chunkType: 'paragraph'
          }
        });
      });
    }

    // If we have too few chunks, create more by splitting the existing ones
    if (chunks.length < 5 && content.length > 1000) {
      const sentences = content.match(/[^.!?]+[.!?]+/g) || [];

      // Group sentences into chunks of reasonable size
      let currentChunk = '';
      let chunkStart = 0;

      sentences.forEach((sentence) => {
        if (currentChunk.length + sentence.length > 500) {
          // Save current chunk and start a new one
          if (currentChunk) {
            chunks.push({
              id: uuidv4(),
              documentId,
              content: currentChunk.trim(),
              metadata: {
                position: {
                  start: chunkStart,
                  end: chunkStart + currentChunk.length
                },
                chunkType: 'sentence-group'
              }
            });
          }

          currentChunk = sentence;
          chunkStart = content.indexOf(sentence);
        } else {
          currentChunk += ' ' + sentence;
        }
      });

      // Add the last chunk if there is one
      if (currentChunk) {
        chunks.push({
          id: uuidv4(),
          documentId,
          content: currentChunk.trim(),
          metadata: {
            position: {
              start: chunkStart,
              end: chunkStart + currentChunk.length
            },
            chunkType: 'sentence-group'
          }
        });
      }
    }

    // Ensure we have at least one chunk even if content is empty or couldn't be processed
    if (chunks.length === 0) {
      chunks.push({
        id: uuidv4(),
        documentId,
        content: content.trim() || "[No extractable text content]",
        metadata: {
          chunkType: 'fallback'
        }
      });
    }

    return chunks;
  }
}