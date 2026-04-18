export async function extractDocx(file: File): Promise<{ kind: 'docx'; extractedText: string }> {
  const mammoth = await import('mammoth');
  const ab = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: ab });
  return { kind: 'docx', extractedText: result.value };
}
