// File parsing service for extracting content from various file formats
import mammoth from 'mammoth';
import { Readable } from 'stream';

export interface ParsedFileContent {
  content: string;
  images: Buffer[];
  metadata: {
    fileType: string;
    pageCount?: number;
    estimatedTokens: number;
  };
}

/**
 * Rough token estimation: ~4 characters = 1 token
 */
const estimateTokens = (text: string): number => {
  return Math.ceil(text.length / 4);
};

type PdfParseResult = {
  text: string;
  numpages?: number;
};

let pdfParse: ((buffer: Buffer) => Promise<PdfParseResult>) | null = null;
let pdfParseLoadError: Error | null = null;

const loadPdfParse = () => {
  if (pdfParse !== null || pdfParseLoadError) {
    return;
  }

  try {
    // Load pdf-parse Node build which depends on @napi-rs/canvas for DOM polyfills
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pdfParseModule = require('pdf-parse');
    const resolved = pdfParseModule.default || pdfParseModule;
    pdfParse = resolved as (buffer: Buffer) => Promise<PdfParseResult>;
  } catch (error) {
    pdfParseLoadError = error as Error;
  }
};

export class FileParserService {
  /**
   * Parse PDF file
   */
  static async parsePDF(buffer: Buffer): Promise<ParsedFileContent> {
    try {
      loadPdfParse();

      if (!pdfParse) {
        const reason = pdfParseLoadError ? pdfParseLoadError.message : 'pdf-parse module is unavailable';
        throw new Error(`PDF parsing is not available: ${reason}`);
      }

      const data = await pdfParse(buffer);
      const content = data.text;
      const tokens = estimateTokens(content);

      return {
        content,
        images: [],
        metadata: {
          fileType: 'pdf',
          pageCount: data.numpages,
          estimatedTokens: tokens,
        },
      };
    } catch (error) {
      throw new Error(`Failed to parse PDF: ${(error as Error).message}`);
    }
  }

  /**
   * Parse DOCX file
   */
  static async parseDOCX(buffer: Buffer): Promise<ParsedFileContent> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      const content = result.value;
      const tokens = estimateTokens(content);

      return {
        content,
        images: [],
        metadata: {
          fileType: 'docx',
          estimatedTokens: tokens,
        },
      };
    } catch (error) {
      throw new Error(`Failed to parse DOCX: ${(error as Error).message}`);
    }
  }

  /**
   * Parse plain text file
   */
  static async parseTXT(buffer: Buffer): Promise<ParsedFileContent> {
    const content = buffer.toString('utf-8');
    const tokens = estimateTokens(content);

    return {
      content,
      images: [],
      metadata: {
        fileType: 'txt',
        estimatedTokens: tokens,
      },
    };
  }

  /**
   * Parse CSV file
   */
  static async parseCSV(buffer: Buffer): Promise<ParsedFileContent> {
    const content = buffer.toString('utf-8');
    const tokens = estimateTokens(content);

    return {
      content,
      images: [],
      metadata: {
        fileType: 'csv',
        estimatedTokens: tokens,
      },
    };
  }

  /**
   * Parse HTML file
   */
  static async parseHTML(buffer: Buffer): Promise<ParsedFileContent> {
    try {
      const html = buffer.toString('utf-8');
      // Strip HTML tags and decode entities
      const text = html
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/<style[^>]*>.*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();

      const tokens = estimateTokens(text);

      return {
        content: text,
        images: [],
        metadata: {
          fileType: 'html',
          estimatedTokens: tokens,
        },
      };
    } catch (error) {
      throw new Error(`Failed to parse HTML: ${(error as Error).message}`);
    }
  }

  /**
   * Parse RTF file - strip RTF formatting and extract text
   */
  static async parseRTF(buffer: Buffer): Promise<ParsedFileContent> {
    try {
      const rtf = buffer.toString('utf-8');
      // Remove RTF control sequences
      const text = rtf
        .replace(/\\[a-z]+[\-\d]*/gi, ' ')
        .replace(/[{}]/g, ' ')
        .replace(/\*[^;]*;/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      const tokens = estimateTokens(text);

      return {
        content: text,
        images: [],
        metadata: {
          fileType: 'rtf',
          estimatedTokens: tokens,
        },
      };
    } catch (error) {
      throw new Error(`Failed to parse RTF: ${(error as Error).message}`);
    }
  }

  /**
   * Parse Markdown file
   */
  static async parseMarkdown(buffer: Buffer): Promise<ParsedFileContent> {
    const content = buffer.toString('utf-8');
    const tokens = estimateTokens(content);

    return {
      content,
      images: [],
      metadata: {
        fileType: 'markdown',
        estimatedTokens: tokens,
      },
    };
  }

  /**
   * Parse JSON file
   */
  static async parseJSON(buffer: Buffer): Promise<ParsedFileContent> {
    try {
      const json = buffer.toString('utf-8');
      // Pretty-print JSON for readability
      const parsed = JSON.parse(json);
      const content = JSON.stringify(parsed, null, 2);
      const tokens = estimateTokens(content);

      return {
        content,
        images: [],
        metadata: {
          fileType: 'json',
          estimatedTokens: tokens,
        },
      };
    } catch (error) {
      throw new Error(`Failed to parse JSON: ${(error as Error).message}`);
    }
  }

  /**
   * Parse XLSX file - converts to CSV-like format
   */
  static async parseXLSX(buffer: Buffer): Promise<ParsedFileContent> {
    try {
      // Note: xlsx library needs to be imported
      const XLSX = require('xlsx');
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      
      let content = '';
      workbook.SheetNames.forEach((sheetName: string) => {
        const sheet = workbook.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(sheet);
        content += `Sheet: ${sheetName}\n${csv}\n\n`;
      });

      const tokens = estimateTokens(content);

      return {
        content,
        images: [],
        metadata: {
          fileType: 'xlsx',
          estimatedTokens: tokens,
        },
      };
    } catch (error) {
      throw new Error(`Failed to parse XLSX: ${(error as Error).message}`);
    }
  }

  /**
   * Parse EPUB file - basic text extraction
   */
  static async parseEPUB(buffer: Buffer): Promise<ParsedFileContent> {
    try {
      // Note: epub library would need to be installed for full support
      // For now, treat as binary and extract readable text
      const text = buffer.toString('utf-8', 0, Math.min(10000, buffer.length));
      const cleaned = text
        .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const tokens = estimateTokens(cleaned);

      return {
        content: cleaned.substring(0, 5000), // Limit EPUB extraction
        images: [],
        metadata: {
          fileType: 'epub',
          estimatedTokens: tokens,
        },
      };
    } catch (error) {
      throw new Error(`Failed to parse EPUB: ${(error as Error).message}`);
    }
  }

  /**
   * Main parse method - routes to appropriate parser based on MIME type
   */
  static async parse(buffer: Buffer, mimeType: string): Promise<ParsedFileContent> {
    const typeMap: Record<string, (buf: Buffer) => Promise<ParsedFileContent>> = {
      'application/pdf': this.parsePDF,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': this.parseDOCX,
      'application/msword': this.parseDOCX,
      'text/plain': this.parseTXT,
      'text/csv': this.parseCSV,
      'text/html': this.parseHTML,
      'application/rtf': this.parseRTF,
      'text/markdown': this.parseMarkdown,
      'application/json': this.parseJSON,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': this.parseXLSX,
      'application/vnd.ms-excel': this.parseXLSX,
      'application/epub+zip': this.parseEPUB,
    };

    const parser = typeMap[mimeType];
    if (!parser) {
      throw new Error(`Unsupported file type: ${mimeType}`);
    }

    return parser.call(this, buffer);
  }
}
