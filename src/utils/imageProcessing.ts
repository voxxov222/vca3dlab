import type { CardLayer, LayerRole } from '../types/card';

export const CARD_TEX_W = 750;
export const CARD_TEX_H = 1050;
export const DEPTH_TEX_W = 256;
export const DEPTH_TEX_H = 358;

export function createFlatDepthMapUrl(level = 128): string {
  const canvas = document.createElement('canvas');
  canvas.width = DEPTH_TEX_W;
  canvas.height = DEPTH_TEX_H;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = `rgb(${level},${level},${level})`;
    ctx.fillRect(0, 0, DEPTH_TEX_W, DEPTH_TEX_H);
  }
  return canvas.toDataURL('image/png');
}

export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

/**
 * Fits any loaded HTMLImageElement onto the standard 750x1050 (5:7) collectible card canvas
 * while preserving aspect ratio and alpha transparency.
 */
export function fitImageElementToCardPng(img: HTMLImageElement): string {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_TEX_W;
  canvas.height = CARD_TEX_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.clearRect(0, 0, CARD_TEX_W, CARD_TEX_H);
  const scale = Math.min(CARD_TEX_W / img.width, CARD_TEX_H / img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  const dx = (CARD_TEX_W - drawW) * 0.5;
  const dy = (CARD_TEX_H - drawH) * 0.5;
  ctx.drawImage(img, dx, dy, drawW, drawH);

  return canvas.toDataURL('image/png');
}

/**
 * Imports a remote CORS-enabled image (PNG/WebP/GIF) safely into a local DataURL
 * so WebGL textures & PNG exports never taint the canvas.
 */
export async function importRemoteImageToSafeUrl(
  remoteUrl: string,
  isAnimatedGif = false
): Promise<{ url: string; isAnimatedGif: boolean }> {
  // Only allow safe http(s) or data/blob URLs
  const parsed = new URL(remoteUrl, window.location.origin);
  if (!['http:', 'https:', 'data:', 'blob:'].includes(parsed.protocol)) {
    throw new Error('Unsupported asset URL protocol');
  }

  if (isAnimatedGif || remoteUrl.toLowerCase().endsWith('.gif')) {
    const res = await fetch(remoteUrl, { mode: 'cors' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Failed to read remote GIF'));
      reader.readAsDataURL(blob);
    });
    return { url: dataUrl, isAnimatedGif: true };
  }

  const img = await loadImageElement(remoteUrl);
  return { url: fitImageElementToCardPng(img), isAnimatedGif: false };
}

/**
 * Fits an uploaded image file onto the standard 750x1050 (5:7) collectible card canvas
 * while preserving aspect ratio and alpha transparency.
 */
export async function importImageFileToLayerUrl(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });

  if (file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif')) {
    return dataUrl;
  }

  const img = await loadImageElement(dataUrl);
  return fitImageElementToCardPng(img) || dataUrl;
}

export type UniversalImportedAsset =
  | {
      type: 'image';
      name: string;
      format: 'PNG' | 'GIF' | 'WebP';
      imageUrl: string;
      isAnimatedGif: boolean;
    }
  | {
      type: 'model3d';
      name: string;
      format: 'GLB' | 'GLTF' | 'OBJ';
      modelUrl: string;
    };

/**
 * Universal asset importer that identifies file types (PNG, JPG, WebP, GIF, GLB, GLTF, OBJ),
 * validates them, and prepares them cleanly for the 3D scene editor.
 */
export async function importUniversalAssetFile(
  file: File
): Promise<UniversalImportedAsset | null> {
  const lower = file.name.toLowerCase();
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'Imported Asset';

  if (lower.endsWith('.glb') || lower.endsWith('.gltf') || lower.endsWith('.obj')) {
    const format: 'GLB' | 'GLTF' | 'OBJ' = lower.endsWith('.glb')
      ? 'GLB'
      : lower.endsWith('.gltf')
        ? 'GLTF'
        : 'OBJ';
    const modelUrl = URL.createObjectURL(file);
    return {
      type: 'model3d',
      name: baseName,
      format,
      modelUrl,
    };
  }

  if (
    file.type.startsWith('image/') ||
    /\.(png|jpe?g|webp|gif|svg)$/i.test(lower)
  ) {
    const isGif = file.type === 'image/gif' || lower.endsWith('.gif');
    const isWebp = file.type === 'image/webp' || lower.endsWith('.webp');
    const imageUrl = await importImageFileToLayerUrl(file);
    return {
      type: 'image',
      name: baseName,
      format: isGif ? 'GIF' : isWebp ? 'WebP' : 'PNG',
      imageUrl,
      isAnimatedGif: isGif,
    };
  }

  return null;
}

/**
 * Composites multiple image layers in stack order into a single 750x1050 transparent PNG.
 */
export async function mergeImageLayersToPng(layers: CardLayer[]): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_TEX_W;
  canvas.height = CARD_TEX_H;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, CARD_TEX_W, CARD_TEX_H);

  // Convert card world offsets (2.5 x 3.5) to canvas pixels (750 x 1050)
  const pxPerUnitX = CARD_TEX_W / 2.5;
  const pxPerUnitY = CARD_TEX_H / 3.5;

  for (const layer of layers) {
    if (!layer.visible || (layer.kind && layer.kind !== 'image')) continue;
    try {
      const img = await loadImageElement(layer.imageUrl);
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, layer.opacity));
      if (layer.blendMode === 'additive') {
        ctx.globalCompositeOperation = 'lighter';
      }
      ctx.translate(
        CARD_TEX_W * 0.5 + layer.offsetX * pxPerUnitX,
        CARD_TEX_H * 0.5 - layer.offsetY * pxPerUnitY
      );
      ctx.rotate((-layer.rotationDeg * Math.PI) / 180);
      ctx.scale(layer.scale, layer.scale);
      ctx.drawImage(img, -CARD_TEX_W * 0.5, -CARD_TEX_H * 0.5, CARD_TEX_W, CARD_TEX_H);
      ctx.restore();
    } catch {
      // Skip unreadable layer
    }
  }

  return canvas.toDataURL('image/png');
}

/**
 * Smart client-side background removal using corner-sampled adaptive color matching,
 * edge-connected BFS flood fill, and soft boundary alpha feathering.
 */
export async function removeBackgroundSmart(
  imageUrl: string,
  options: {
    tolerance?: number;
    feather?: number;
    mode?: 'edge_flood' | 'chroma';
  } = {}
): Promise<string> {
  const tolerance = options.tolerance ?? 38;
  const feather = options.feather ?? 14;
  const mode = options.mode ?? 'edge_flood';

  const img = await loadImageElement(imageUrl);
  const w = img.width;
  const h = img.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return imageUrl;

  ctx.drawImage(img, 0, 0);
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  const samples: Array<[number, number, number]> = [];
  const stepX = Math.max(1, Math.floor(w / 16));
  const stepY = Math.max(1, Math.floor(h / 16));

  for (let x = 0; x < w; x += stepX) {
    for (const y of [2, h - 3]) {
      const idx = (y * w + x) * 4;
      if (data[idx + 3] > 20) {
        samples.push([data[idx], data[idx + 1], data[idx + 2]]);
      }
    }
  }
  for (let y = 0; y < h; y += stepY) {
    for (const x of [2, w - 3]) {
      const idx = (y * w + x) * 4;
      if (data[idx + 3] > 20) {
        samples.push([data[idx], data[idx + 1], data[idx + 2]]);
      }
    }
  }

  if (samples.length === 0) return imageUrl;

  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  for (const [r, g, b] of samples) {
    sumR += r;
    sumG += g;
    sumB += b;
  }
  const refR = sumR / samples.length;
  const refG = sumG / samples.length;
  const refB = sumB / samples.length;

  const colorDist = (idx: number): number => {
    const dr = data[idx] - refR;
    const dg = data[idx + 1] - refG;
    const db = data[idx + 2] - refB;
    return Math.sqrt(0.299 * dr * dr + 0.587 * dg * dg + 0.114 * db * db);
  };

  const total = w * h;
  const mask = new Uint8Array(total);

  if (mode === 'edge_flood') {
    const visited = new Uint8Array(total);
    const queue = new Int32Array(total);
    let head = 0;
    let tail = 0;

    const trySeed = (x: number, y: number) => {
      const p = y * w + x;
      if (visited[p]) return;
      visited[p] = 1;
      const idx = p * 4;
      if (data[idx + 3] <= 12 || colorDist(idx) <= tolerance) {
        mask[p] = 1;
        queue[tail++] = p;
      }
    };

    for (let x = 0; x < w; x++) {
      trySeed(x, 0);
      trySeed(x, h - 1);
    }
    for (let y = 0; y < h; y++) {
      trySeed(0, y);
      trySeed(w - 1, y);
    }

    while (head < tail) {
      const p = queue[head++];
      const x = p % w;
      const y = (p - x) / w;

      const neighbors = [
        x > 0 ? p - 1 : -1,
        x < w - 1 ? p + 1 : -1,
        y > 0 ? p - w : -1,
        y < h - 1 ? p + w : -1,
      ];

      for (const n of neighbors) {
        if (n < 0 || visited[n]) continue;
        visited[n] = 1;
        const idx = n * 4;
        if (data[idx + 3] <= 12 || colorDist(idx) <= tolerance) {
          mask[n] = 1;
          queue[tail++] = n;
        }
      }
    }
  } else {
    for (let p = 0; p < total; p++) {
      const idx = p * 4;
      if (data[idx + 3] <= 12 || colorDist(idx) <= tolerance) {
        mask[p] = 1;
      }
    }
  }

  for (let p = 0; p < total; p++) {
    const idx = p * 4;
    if (mask[p] === 1) {
      data[idx + 3] = 0;
    } else if (feather > 0) {
      const dist = colorDist(idx);
      if (dist < tolerance + feather) {
        const factor = Math.max(0, Math.min(1, (dist - tolerance) / feather));
        data[idx + 3] = Math.round(data[idx + 3] * factor);
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL('image/png');
}

/**
 * Generates a smooth, sculpted 256x358 grayscale depth map from a layer's image
 * using alpha silhouette dome falloff, luminance contrast, and Sobel edge relief.
 */
export async function generateAutoDepthMap(
  imageUrl: string,
  role: LayerRole = 'character'
): Promise<string> {
  const img = await loadImageElement(imageUrl);
  const w = DEPTH_TEX_W;
  const h = DEPTH_TEX_H;

  const workCanvas = document.createElement('canvas');
  workCanvas.width = w;
  workCanvas.height = h;
  const ctx = workCanvas.getContext('2d');
  if (!ctx) return createFlatDepthMapUrl(128);

  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const src = ctx.getImageData(0, 0, w, h).data;

  const total = w * h;
  const lum = new Float32Array(total);
  const alpha = new Float32Array(total);
  const distToEdge = new Float32Array(total);

  for (let i = 0; i < total; i++) {
    const idx = i * 4;
    const a = src[idx + 3] / 255;
    alpha[i] = a;
    lum[i] = (0.299 * src[idx] + 0.587 * src[idx + 1] + 0.114 * src[idx + 2]) / 255;
    distToEdge[i] = a > 0.15 ? 999 : 0;
  }

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (distToEdge[i] > 0) {
        const m = Math.min(
          distToEdge[i - 1] + 1,
          distToEdge[i - w] + 1,
          distToEdge[i - w - 1] + 1.414,
          distToEdge[i - w + 1] + 1.414
        );
        if (m < distToEdge[i]) distToEdge[i] = m;
      }
    }
  }
  for (let y = h - 2; y >= 1; y--) {
    for (let x = w - 2; x >= 1; x--) {
      const i = y * w + x;
      if (distToEdge[i] > 0) {
        const m = Math.min(
          distToEdge[i + 1] + 1,
          distToEdge[i + w] + 1,
          distToEdge[i + w + 1] + 1.414,
          distToEdge[i + w - 1] + 1.414
        );
        if (m < distToEdge[i]) distToEdge[i] = m;
      }
    }
  }

  const rawDepth = new Float32Array(total);
  const maxDome = role === 'background' ? 14 : 26;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (alpha[i] < 0.05) {
        rawDepth[i] = 0;
        continue;
      }

      const gx =
        -lum[i - w - 1] +
        lum[i - w + 1] -
        2 * lum[i - 1] +
        2 * lum[i + 1] -
        lum[i + w - 1] +
        lum[i + w + 1];
      const gy =
        -lum[i - w - 1] -
        2 * lum[i - w] -
        lum[i - w + 1] +
        lum[i + w - 1] +
        2 * lum[i + w] +
        lum[i + w + 1];
      const edge = Math.min(1, Math.sqrt(gx * gx + gy * gy) * 0.65);

      const nx = (x / w - 0.5) * 2;
      const ny = (y / h - 0.5) * 2;
      const centerBias = Math.max(0, 1 - Math.sqrt(nx * nx + ny * ny) * 0.65);
      const dome = Math.min(1, distToEdge[i] / maxDome);
      const smoothDome = dome * (2 - dome);

      if (role === 'background' || role === 'atmosphere') {
        rawDepth[i] = 0.15 + lum[i] * 0.35 + (1 - centerBias) * 0.25;
      } else if (role === 'foreground' || role === 'frame' || role === 'text') {
        rawDepth[i] = (0.65 + edge * 0.25 + lum[i] * 0.1) * alpha[i];
      } else if (role === 'fx' || role === 'energy') {
        rawDepth[i] = (0.35 + lum[i] * 0.5 + smoothDome * 0.15) * alpha[i];
      } else {
        rawDepth[i] =
          (0.22 + smoothDome * 0.48 + lum[i] * 0.2 + edge * 0.12 + centerBias * 0.1) *
          alpha[i];
      }
    }
  }

  const temp = new Float32Array(total);
  const out = new Float32Array(total);
  const r = 3;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let acc = 0;
      let cnt = 0;
      for (let kx = -r; kx <= r; kx++) {
        const sx = Math.min(w - 1, Math.max(0, x + kx));
        acc += rawDepth[y * w + sx];
        cnt++;
      }
      temp[y * w + x] = acc / cnt;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let acc = 0;
      let cnt = 0;
      for (let ky = -r; ky <= r; ky++) {
        const sy = Math.min(h - 1, Math.max(0, y + ky));
        acc += temp[sy * w + x];
        cnt++;
      }
      out[y * w + x] = Math.min(1, Math.max(0, acc / cnt));
    }
  }

  const outImg = ctx.createImageData(w, h);
  for (let i = 0; i < total; i++) {
    const v = Math.round(out[i] * 255);
    const idx = i * 4;
    outImg.data[idx] = v;
    outImg.data[idx + 1] = v;
    outImg.data[idx + 2] = v;
    outImg.data[idx + 3] = 255;
  }
  ctx.putImageData(outImg, 0, 0);
  return workCanvas.toDataURL('image/png');
}

export async function sampleDepthMapPixels(depthMapUrl: string): Promise<Float32Array> {
  const img = await loadImageElement(depthMapUrl);
  const canvas = document.createElement('canvas');
  canvas.width = DEPTH_TEX_W;
  canvas.height = DEPTH_TEX_H;
  const ctx = canvas.getContext('2d');
  const result = new Float32Array(DEPTH_TEX_W * DEPTH_TEX_H);
  if (!ctx) return result;

  ctx.drawImage(img, 0, 0, DEPTH_TEX_W, DEPTH_TEX_H);
  const data = ctx.getImageData(0, 0, DEPTH_TEX_W, DEPTH_TEX_H).data;
  for (let i = 0; i < result.length; i++) {
    result[i] = data[i * 4] / 255;
  }
  return result;
}
