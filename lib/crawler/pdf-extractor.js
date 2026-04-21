// Import pdf-parse - it exports the parse function as default
import * as pdfParseNs from 'pdf-parse';
const pdfParseModule = pdfParseNs.default || pdfParseNs;

const DEFAULT_PDF_TIMEOUT = 30000;
const MAX_PDF_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Extracts text content from a PDF buffer with robust error handling.
 * Returns the full text of the PDF, cleaned of excessive whitespace.
 */
export async function extractTextFromPDF(pdfBuffer, options = {}) {
  const {
    maxPages = 100,
    timeout = DEFAULT_PDF_TIMEOUT,
  } = options;

  try {
    if (!pdfBuffer) {
      throw new Error('No PDF buffer provided');
    }

    if (pdfBuffer.length === 0) {
      throw new Error('PDF buffer is empty');
    }

    if (pdfBuffer.length > MAX_PDF_SIZE) {
      throw new Error(`PDF size (${pdfBuffer.length} bytes) exceeds maximum allowed size (${MAX_PDF_SIZE} bytes)`);
    }

    // Set up timeout promise
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`PDF extraction timeout after ${timeout}ms`)), timeout)
    );

    // Extract with timeout
    const extractionPromise = pdfParseModule(pdfBuffer, {
      max: maxPages,
      pagerender: null, // Skip rendering for faster extraction
    });

    const data = await Promise.race([extractionPromise, timeoutPromise]);

    if (!data) {
      return {
        text: '',
        pages: 0,
        metadata: {},
        error: 'PDF parsing returned no data',
      };
    }

    // Clean text: normalize whitespace and remove excessive line breaks
    const fullText = (data.text || '')
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\n{3,}/g, '\n\n') // Remove excessive line breaks
      .trim();

    return {
      text: fullText,
      pages: data.numpages || data.numPages || 0,
      metadata: data.info || {},
      charCount: fullText.length,
    };
  } catch (error) {
    console.error('Error extracting PDF text:', error.message);
    return {
      text: '',
      pages: 0,
      metadata: {},
      error: error.message,
      charCount: 0,
    };
  }
}

/**
 * Extracts first N characters of PDF text for quick analysis
 */
export async function extractPDFPreview(pdfBuffer, previewLength = 2000, options = {}) {
  try {
    const result = await extractTextFromPDF(pdfBuffer, {
      maxPages: 3, // Only extract first 3 pages for preview
      ...options,
    });

    return {
      preview: result.text.substring(0, previewLength),
      fullText: result.text,
      pages: result.pages,
      charCount: result.charCount,
    };
  } catch (error) {
    console.error('Error extracting PDF preview:', error.message);
    return {
      preview: '',
      fullText: '',
      pages: 0,
      charCount: 0,
      error: error.message,
    };
  }
}
