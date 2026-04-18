export async function extractImage(file: File): Promise<{ kind: 'image'; thumbnail: Blob; extractedText?: string }> {
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(new Error('FileReader failed'));
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('Image decode failed'));
    i.src = dataUrl;
  });
  const canvas = document.createElement('canvas');
  const max = 200;
  const ratio = Math.min(max / img.width, max / img.height, 1);
  canvas.width = img.width * ratio;
  canvas.height = img.height * ratio;
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((res, rej) => {
    canvas.toBlob((b) => {
      if (b) res(b); else rej(new Error('canvas.toBlob failed'));
    }, 'image/png');
  });
  return { kind: 'image', thumbnail: blob };
}
