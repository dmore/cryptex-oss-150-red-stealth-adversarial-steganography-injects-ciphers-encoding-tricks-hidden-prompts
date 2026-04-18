export async function extractPdf(file: File): Promise<{ kind: 'pdf'; extractedText: string; thumbnail?: Blob }> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  const ab = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: ab }).promise;
  let text = '';
  for (let p = 1; p <= Math.min(doc.numPages, 50); p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    text += content.items.map((i) => (i as { str: string }).str).join(' ') + '\n';
  }
  return { kind: 'pdf', extractedText: text.trim() };
}
