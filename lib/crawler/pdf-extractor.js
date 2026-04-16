import { PDFParse } from 'pdf-parse';

/**
 * Extracts text content from a PDF buffer
 * Returns the full text of the PDF
 */
export async function extractTextFromPDF(pdfBuffer) {
  let parser = null;

  try {
    if (!pdfBuffer) {
      throw new Error('No PDF buffer provided');
    }

    parser = new PDFParse({ data: pdfBuffer });
    const data = await parser.getText();

    // Combine all text from all pages
    let fullText = '';
    if (data.text) {
      fullText = data.text;
    }

    return {
      text: fullText,
      pages: data.total,
      metadata: data.info || {}
    };
  } catch (error) {
    console.error('Error extracting PDF text:', error.message);
    return {
      text: '',
      pages: 0,
      metadata: {},
      error: error.message
    };
  } finally {
    if (parser) {
      await parser.destroy();
    }
  }
}

/**
 * Extracts first N characters of PDF text for quick analysis
 */
export async function extractPDFPreview(pdfBuffer, previewLength = 2000) {
  try {
    const result = await extractTextFromPDF(pdfBuffer);
    return {
      preview: result.text.substring(0, previewLength),
      fullText: result.text,
      pages: result.pages
    };
  } catch (error) {
    console.error('Error extracting PDF preview:', error.message);
    return {
      preview: '',
      fullText: '',
      pages: 0
    };
  }
}
