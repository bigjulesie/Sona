/**
 * Extracts plain text from a file buffer based on MIME type or extension.
 * Supports: PDF, DOCX, plain text.
 */
export async function extractText(
  buffer: Buffer,
  mimeType: string,
  filename: string,
): Promise<string> {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''

  // PDF
  if (mimeType === 'application/pdf' || ext === 'pdf') {
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data: new Uint8Array(buffer) })
    try {
      const result = await parser.getText()
      return result.text
    } finally {
      await parser.destroy()
    }
  }

  // DOCX
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === 'docx'
  ) {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  }

  // Plain text (txt, md, etc.)
  return buffer.toString('utf-8')
}

export const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
]

export const ACCEPTED_EXTENSIONS = ['pdf', 'docx', 'txt', 'md']

/** Max file size: 10 MB */
export const MAX_FILE_SIZE = 10 * 1024 * 1024
