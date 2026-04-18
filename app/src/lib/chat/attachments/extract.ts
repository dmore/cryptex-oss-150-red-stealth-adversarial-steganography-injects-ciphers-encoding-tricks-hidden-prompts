import { extractImage } from './image';
import { extractPdf } from './pdf';
import { extractDocx } from './docx';

export type ExtractResult = {
  kind: 'image' | 'pdf' | 'docx' | 'text' | 'other';
  extractedText?: string;
  thumbnail?: Blob;
};

export async function extractAttachment(file: File): Promise<ExtractResult> {
  try {
    if (file.type.startsWith('image/')) return await extractImage(file);
    if (file.type === 'application/pdf') return await extractPdf(file);
    if (
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.name.toLowerCase().endsWith('.docx')
    ) {
      return await extractDocx(file);
    }
    if (file.type.startsWith('text/') || file.type === 'application/json') {
      const text = await file.text();
      return { kind: 'text', extractedText: text };
    }
  } catch (err) {
    console.warn('[extract] failed for', file.name, err);
    return { kind: 'other' };
  }
  return { kind: 'other' };
}
