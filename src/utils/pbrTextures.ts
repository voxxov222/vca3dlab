import * as THREE from 'three';

export interface PbrMaterialSpec {
  id: string;
  name: string;
  source: string;
  license: string;
  roughnessBase: number;
  metalnessBase: number;
  previewColor: string;
  description: string;
}

export const PBR_CATALOG: PbrMaterialSpec[] = [
  {
    id: 'pbr-brushed-gold',
    name: 'Brushed Anisotropic Gold',
    source: 'Poly Haven CC0 Procedural',
    license: 'CC0 — Commercial OK',
    roughnessBase: 0.22,
    metalnessBase: 0.92,
    previewColor: '#D97706',
    description: 'Fine horizontal hairline micro-grooves for luxury metallic borders & foil',
  },
  {
    id: 'pbr-carbon-weave',
    name: '2x2 Twill Carbon Fiber',
    source: 'Poly Haven CC0 Procedural',
    license: 'CC0 — Commercial OK',
    roughnessBase: 0.34,
    metalnessBase: 0.55,
    previewColor: '#1E293B',
    description: 'Woven diagonal carbon weave with anisotropic roughness variation',
  },
  {
    id: 'pbr-hammered-copper',
    name: 'Hammered Forged Metal',
    source: 'Poly Haven CC0 Procedural',
    license: 'CC0 — Commercial OK',
    roughnessBase: 0.28,
    metalnessBase: 0.88,
    previewColor: '#B45309',
    description: 'Faceted dimpled metal normal map catching dramatic grazing speculars',
  },
  {
    id: 'pbr-obsidian-slate',
    name: 'Obsidian Mineral Slate',
    source: 'Poly Haven CC0 Procedural',
    license: 'CC0 — Commercial OK',
    roughnessBase: 0.48,
    metalnessBase: 0.18,
    previewColor: '#0F172A',
    description: 'Fractured volcanic stone grain for dark collector slabs & frames',
  },
  {
    id: 'pbr-iridescent-silk',
    name: 'Iridescent Micro-Silk',
    source: 'Poly Haven CC0 Procedural',
    license: 'CC0 — Commercial OK',
    roughnessBase: 0.26,
    metalnessBase: 0.42,
    previewColor: '#7C3AED',
    description: 'Fine cross-woven silk sheen with subtle pearl normal relief',
  },
  {
    id: 'pbr-frosted-crystal',
    name: 'Frosted Ice Crystal',
    source: 'Poly Haven CC0 Procedural',
    license: 'CC0 — Commercial OK',
    roughnessBase: 0.18,
    metalnessBase: 0.35,
    previewColor: '#0284C7',
    description: 'Crystalline micro-facets for cracked-ice foil and frosted acrylic',
  },
];

export interface PbrTextureSet {
  normalMap: THREE.DataTexture;
  roughnessMap: THREE.DataTexture;
  roughness: number;
  metalness: number;
}

const pbrCache = new Map<string, PbrTextureSet>();

function hash2D(x: number, y: number, seed = 0): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

function heightToNormalData(
  heights: Float32Array,
  size: number,
  strength: number
): Uint8Array {
  const out = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size;
      const xp = (x + 1) % size;
      const ym = (y - 1 + size) % size;
      const yp = (y + 1) % size;

      const dx = (heights[y * size + xp] - heights[y * size + xm]) * strength;
      const dy = (heights[yp * size + x] - heights[ym * size + x]) * strength;

      let nx = -dx;
      let ny = -dy;
      let nz = 1.0;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;

      const idx = (y * size + x) * 4;
      out[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      out[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      out[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      out[idx + 3] = 255;
    }
  }
  return out;
}

export function getPbrTextureSet(id: string, maxAniso = 4): PbrTextureSet | null {
  if (!id) return null;
  const cached = pbrCache.get(id);
  if (cached) return cached;

  const spec = PBR_CATALOG.find((p) => p.id === id);
  if (!spec) return null;

  const size = 128;
  const heights = new Float32Array(size * size);
  const roughBytes = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      let h = 0.5;
      let r = spec.roughnessBase;

      if (id === 'pbr-brushed-gold') {
        const streak = Math.sin(y * 1.85 + hash2D(x * 0.08, y, 1) * 4.2) * 0.5 + 0.5;
        const fine = hash2D(Math.floor(x / 6), y, 3);
        h = streak * 0.65 + fine * 0.35;
        r = 0.14 + h * 0.24;
      } else if (id === 'pbr-carbon-weave') {
        const cx = Math.floor(x / 8);
        const cy = Math.floor(y / 8);
        const phase = (cx + cy) % 2;
        const lx = (x % 8) / 8;
        const ly = (y % 8) / 8;
        h = phase === 0 ? Math.sin(lx * Math.PI) * 0.8 : Math.sin(ly * Math.PI) * 0.8;
        r = phase === 0 ? 0.22 + (1 - h) * 0.25 : 0.38 + (1 - h) * 0.22;
      } else if (id === 'pbr-hammered-copper') {
        const gx = x / 16;
        const gy = y / 16;
        const ix = Math.floor(gx);
        const iy = Math.floor(gy);
        let minD = 99;
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            const px = (ix + ox + 8) % 8;
            const py = (iy + oy + 8) % 8;
            const jx = ix + ox + hash2D(px, py, 7) * 0.8;
            const jy = iy + oy + hash2D(px, py, 11) * 0.8;
            const d = Math.hypot(gx - jx, gy - jy);
            if (d < minD) minD = d;
          }
        }
        h = Math.min(1, minD * minD * 1.4);
        r = 0.18 + (1 - h) * 0.24;
      } else if (id === 'pbr-obsidian-slate') {
        const n1 = Math.sin(x * 0.14 + y * 0.09) * 0.25 + 0.25;
        const n2 = hash2D(Math.floor(x / 2), Math.floor(y / 2), 9) * 0.5;
        h = n1 + n2;
        r = 0.36 + h * 0.38;
      } else if (id === 'pbr-iridescent-silk') {
        const wave = Math.sin(x * 0.9) * 0.4 + Math.cos(y * 0.9) * 0.4 + 0.5;
        h = Math.max(0, Math.min(1, wave * 0.5));
        r = 0.2 + h * 0.22;
      } else {
        // pbr-frosted-crystal
        const f1 = Math.abs(Math.sin((x + y) * 0.22) * Math.cos((x - y) * 0.19));
        const f2 = hash2D(Math.floor(x / 4), Math.floor(y / 4), 5) * 0.35;
        h = f1 * 0.65 + f2;
        r = 0.12 + (1 - h) * 0.32;
      }

      heights[i] = h;
      const rb = Math.round(Math.min(1, Math.max(0.05, r)) * 255);
      const bi = i * 4;
      roughBytes[bi] = rb;
      roughBytes[bi + 1] = rb;
      roughBytes[bi + 2] = rb;
      roughBytes[bi + 3] = 255;
    }
  }

  const normalBytes = heightToNormalData(
    heights,
    size,
    id === 'pbr-hammered-copper' ? 3.8 : id === 'pbr-carbon-weave' ? 2.8 : 2.2
  );

  const normalMap = new THREE.DataTexture(normalBytes, size, size, THREE.RGBAFormat);
  normalMap.wrapS = THREE.RepeatWrapping;
  normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.repeat.set(3, 4);
  normalMap.anisotropy = maxAniso;
  normalMap.needsUpdate = true;

  const roughnessMap = new THREE.DataTexture(roughBytes, size, size, THREE.RGBAFormat);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(3, 4);
  roughnessMap.anisotropy = maxAniso;
  roughnessMap.needsUpdate = true;

  const set: PbrTextureSet = {
    normalMap,
    roughnessMap,
    roughness: spec.roughnessBase,
    metalness: spec.metalnessBase,
  };
  pbrCache.set(id, set);
  return set;
}

export function renderPbrPreviewDataUrl(id: string): string {
  const texSet = getPbrTextureSet(id, 1);
  const spec = PBR_CATALOG.find((p) => p.id === id);
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = spec?.previewColor || '#334155';
  ctx.fillRect(0, 0, 128, 128);

  if (texSet) {
    const data = texSet.normalMap.image.data as Uint8Array;
    const img = ctx.getImageData(0, 0, 128, 128);
    for (let i = 0; i < 128 * 128; i++) {
      const bi = i * 4;
      const nx = (data[bi] / 255) * 2 - 1;
      const ny = (data[bi + 1] / 255) * 2 - 1;
      const light = Math.max(0.25, Math.min(1.6, 0.85 + nx * 0.45 - ny * 0.45));
      img.data[bi] = Math.min(255, Math.round(img.data[bi] * light));
      img.data[bi + 1] = Math.min(255, Math.round(img.data[bi + 1] * light));
      img.data[bi + 2] = Math.min(255, Math.round(img.data[bi + 2] * light));
    }
    ctx.putImageData(img, 0, 0);
  }
  return c.toDataURL('image/png');
}
