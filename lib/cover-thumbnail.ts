const MAX_COVER_WIDTH = 384;
const MAX_COVER_HEIGHT = 576;

/**
 * Produces a display-sized cover so a multi-megapixel source image is not
 * decoded at full resolution for every library card. Falls back to the source
 * Blob when browser bitmap/canvas APIs are unavailable.
 */
export async function createCoverThumbnail(blob: Blob): Promise<Blob> {
  if (typeof document === "undefined" || typeof createImageBitmap === "undefined") {
    return blob;
  }

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(blob);
    const scale = Math.min(
      1,
      MAX_COVER_WIDTH / bitmap.width,
      MAX_COVER_HEIGHT / bitmap.height
    );
    if (scale >= 1) return blob;

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return blob;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    return (
      (await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/webp", 0.84)
      )) ?? blob
    );
  } catch {
    return blob;
  } finally {
    bitmap?.close();
  }
}
