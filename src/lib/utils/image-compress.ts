/**
 * Downscale an image in the browser before upload.
 *
 * Bank-app screenshots are routinely 3–6MB, and Thai mobile upload bandwidth is
 * the bottleneck in this flow — a slip only has to be readable by a human, so
 * shrinking it costs nothing and saves the customer a long wait.
 *
 * Falls back to the original file whenever anything goes wrong; a slightly large
 * upload beats a failed one.
 */
export async function compressImage(
  file: File,
  opts: { maxEdge?: number; quality?: number } = {},
): Promise<File> {
  const maxEdge = opts.maxEdge ?? 1600;
  const quality = opts.quality ?? 0.82;

  if (typeof document === 'undefined' || !file.type.startsWith('image/')) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    // Already small enough and already a JPEG — re-encoding would only lose quality.
    if (scale === 1 && file.type === 'image/jpeg') {
      bitmap.close?.();
      return file;
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close?.();
      return file;
    }
    // Slips are screenshots on white — flatten transparency so PNG→JPEG stays legible.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    );
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}
