// Edge flood-fill background removal: clears the background region that is
// connected to the image border, leaving same-colored areas inside the subject
// intact. Used by the "周辺透明化" (make surroundings transparent) feature.

export type RGB = [number, number, number];

// Estimate the background color from border pixels, using the most common
// (quantized) color so a subject touching one edge doesn't skew the result.
export function estimateBorderColor(img: ImageData): RGB {
  const { width: w, height: h, data } = img;
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  const sample = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    if (data[i + 3] < 128) return; // ignore already-transparent border pixels
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4); // 16 levels/channel
    const c = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    c.n++; c.r += r; c.g += g; c.b += b;
    buckets.set(key, c);
  };
  for (let x = 0; x < w; x++) { sample(x, 0); sample(x, h - 1); }
  for (let y = 0; y < h; y++) { sample(0, y); sample(w - 1, y); }

  let best: { n: number; r: number; g: number; b: number } | null = null;
  for (const c of buckets.values()) if (!best || c.n > best.n) best = c;
  if (!best) return [255, 255, 255];
  return [Math.round(best.r / best.n), Math.round(best.g / best.n), Math.round(best.b / best.n)];
}

// Flood-fill from every border pixel, clearing (alpha 0) any pixel whose color
// is within `threshold` (RGB Euclidean distance) of the reference color and is
// reachable from the border through other matching pixels. Returns a new ImageData.
export function removeEdgeBackground(src: ImageData, threshold: number, ref?: RGB): ImageData {
  const { width: w, height: h } = src;
  const out = new ImageData(new Uint8ClampedArray(src.data), w, h);
  const data = out.data;
  const [rr, rg, rb] = ref ?? estimateBorderColor(src);
  const t2 = threshold * threshold;

  const matches = (p: number) => {
    const i = p * 4;
    if (data[i + 3] === 0) return false; // already cleared
    const dr = data[i] - rr, dg = data[i + 1] - rg, db = data[i + 2] - rb;
    return dr * dr + dg * dg + db * db <= t2;
  };

  const inBg = new Uint8Array(w * h);
  const stack: number[] = [];
  const seed = (x: number, y: number) => {
    const p = y * w + x;
    if (!inBg[p] && matches(p)) { inBg[p] = 1; stack.push(p); }
  };
  for (let x = 0; x < w; x++) { seed(x, 0); seed(x, h - 1); }
  for (let y = 0; y < h; y++) { seed(0, y); seed(w - 1, y); }

  while (stack.length) {
    const p = stack.pop()!;
    const x = p % w;
    const y = (p / w) | 0;
    if (x > 0 && !inBg[p - 1] && matches(p - 1)) { inBg[p - 1] = 1; stack.push(p - 1); }
    if (x < w - 1 && !inBg[p + 1] && matches(p + 1)) { inBg[p + 1] = 1; stack.push(p + 1); }
    if (y > 0 && !inBg[p - w] && matches(p - w)) { inBg[p - w] = 1; stack.push(p - w); }
    if (y < h - 1 && !inBg[p + w] && matches(p + w)) { inBg[p + w] = 1; stack.push(p + w); }
  }

  for (let p = 0; p < w * h; p++) if (inBg[p]) data[p * 4 + 3] = 0;
  return out;
}
