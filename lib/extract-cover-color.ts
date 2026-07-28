/**
 * Averages the colors along the left-edge strip of a cover image — the
 * part of the artwork that would realistically wrap onto a spine — so the
 * shelf view's spine face reads as an extension of the actual cover
 * instead of an unrelated hashed color.
 */
export async function extractSpineColor(blob: Blob): Promise<string | null> {
  if (typeof document === "undefined" || typeof createImageBitmap === "undefined") return null;
  try {
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    const SAMPLE = 6;
    canvas.width = SAMPLE;
    canvas.height = SAMPLE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const stripWidth = Math.max(1, Math.round(bitmap.width * 0.12));
    ctx.drawImage(bitmap, 0, 0, stripWidth, bitmap.height, 0, 0, SAMPLE, SAMPLE);
    const { data } = ctx.getImageData(0, 0, SAMPLE, SAMPLE);

    let r = 0;
    let g = 0;
    let b = 0;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      count++;
    }
    if (!count) return null;
    // Slightly deepened so it reads as cloth/leather binding rather than a
    // washed-out average of the raw pixels.
    const shade = (c: number) => Math.round((c / count) * 0.82);
    return `rgb(${shade(r)}, ${shade(g)}, ${shade(b)})`;
  } catch {
    return null;
  }
}
