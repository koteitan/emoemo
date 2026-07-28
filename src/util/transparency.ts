// Background removal for the "周辺透明化" feature. Combines three passes into one
// result: (1) flood-fill from the image border, (2) optionally every pixel that
// matches the border color anywhere (kills trapped same-color islands), and
// (3) flood-fills seeded by user clicks (any island the user points at).

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

// BFS from `seeds`, marking `cleared` for every pixel reachable through neighbors
// whose original color is within `threshold` (RGB Euclidean distance) of `ref`.
function flood(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  ref: RGB,
  t2: number,
  seeds: number[],
  cleared: Uint8Array,
) {
  const [rr, rg, rb] = ref;
  const matches = (p: number) => {
    const i = p * 4;
    const dr = data[i] - rr, dg = data[i + 1] - rg, db = data[i + 2] - rb;
    return dr * dr + dg * dg + db * db <= t2;
  };
  const stack: number[] = [];
  for (const p of seeds) {
    if (!cleared[p] && matches(p)) { cleared[p] = 1; stack.push(p); }
  }
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % w;
    const y = (p / w) | 0;
    if (x > 0 && !cleared[p - 1] && matches(p - 1)) { cleared[p - 1] = 1; stack.push(p - 1); }
    if (x < w - 1 && !cleared[p + 1] && matches(p + 1)) { cleared[p + 1] = 1; stack.push(p + 1); }
    if (y > 0 && !cleared[p - w] && matches(p - w)) { cleared[p - w] = 1; stack.push(p - w); }
    if (y < h - 1 && !cleared[p + w] && matches(p + w)) { cleared[p + w] = 1; stack.push(p + w); }
  }
}

export interface TransparencyOptions {
  threshold: number;
  // Also clear ALL pixels matching the border color, regardless of connectivity.
  globalSameColor?: boolean;
  // Extra flood-fill seeds in image pixel coordinates (from user clicks).
  clicks?: { x: number; y: number }[];
}

export function buildTransparent(src: ImageData, opts: TransparencyOptions): ImageData {
  const { width: w, height: h } = src;
  const out = new ImageData(new Uint8ClampedArray(src.data), w, h);
  const data = src.data; // always match against the ORIGINAL colors
  const t2 = opts.threshold * opts.threshold;
  const cleared = new Uint8Array(w * h);
  const ref = estimateBorderColor(src);

  // 1. flood-fill inward from the border
  const border: number[] = [];
  for (let x = 0; x < w; x++) { border.push(x, (h - 1) * w + x); }
  for (let y = 0; y < h; y++) { border.push(y * w, y * w + (w - 1)); }
  flood(data, w, h, ref, t2, border, cleared);

  // 2. optional: clear every pixel matching the border color anywhere
  if (opts.globalSameColor) {
    const [rr, rg, rb] = ref;
    for (let p = 0; p < w * h; p++) {
      const i = p * 4;
      const dr = data[i] - rr, dg = data[i + 1] - rg, db = data[i + 2] - rb;
      if (dr * dr + dg * dg + db * db <= t2) cleared[p] = 1;
    }
  }

  // 3. per-click flood-fill from the pointed island (ref = clicked pixel color)
  for (const c of opts.clicks ?? []) {
    const x = Math.max(0, Math.min(w - 1, Math.round(c.x)));
    const y = Math.max(0, Math.min(h - 1, Math.round(c.y)));
    const p = y * w + x;
    const i = p * 4;
    const cref: RGB = [data[i], data[i + 1], data[i + 2]];
    flood(data, w, h, cref, t2, [p], cleared);
  }

  const od = out.data;
  for (let p = 0; p < w * h; p++) if (cleared[p]) od[p * 4 + 3] = 0;
  return out;
}
