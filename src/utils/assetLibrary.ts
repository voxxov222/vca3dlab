import type { AssetAttribution, LayerRole } from '../types/card';
import { CARD_TEX_H, CARD_TEX_W } from './imageProcessing';

export type AssetKind = 'png' | 'background' | 'model3d';

export type AssetSourceCategory =
  | 'all'
  | 'characters'
  | 'backgrounds'
  | 'frames'
  | 'kenney_fx'
  | 'oga_effects'
  | 'foreground'
  | 'models3d';

export interface LibraryAsset {
  id: string;
  name: string;
  kind: AssetKind;
  role: LayerRole;
  category: string;
  sourceCategory: Exclude<AssetSourceCategory, 'all'>;
  tags: string[];
  previewBg: string;
  proceduralModelId?: string;
  attribution: AssetAttribution;
  render: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
}

const renderedCache = new Map<string, string>();
const FAVORITES_KEY = 'vca_asset_favorites_v1';
const RECENTS_KEY = 'vca_asset_recents_v1';

export interface SavedAssetRef {
  key: string;
  name: string;
  imageUrl: string;
  role: LayerRole;
  kind: AssetKind;
  proceduralModelId?: string;
  attribution?: AssetAttribution;
}

export function getFavoriteAssets(): SavedAssetRef[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? (JSON.parse(raw) as SavedAssetRef[]) : [];
  } catch {
    return [];
  }
}

export function toggleFavoriteAsset(item: SavedAssetRef): SavedAssetRef[] {
  const list = getFavoriteAssets();
  const exists = list.some((x) => x.key === item.key);
  const next = exists ? list.filter((x) => x.key !== item.key) : [item, ...list].slice(0, 32);
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
  } catch {
    // ignore quota
  }
  return next;
}

export function getRecentAssets(): SavedAssetRef[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    return raw ? (JSON.parse(raw) as SavedAssetRef[]) : [];
  } catch {
    return [];
  }
}

export function recordRecentAsset(item: SavedAssetRef): SavedAssetRef[] {
  const list = getRecentAssets().filter((x) => x.key !== item.key);
  const next = [item, ...list].slice(0, 16);
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    // ignore quota
  }
  return next;
}

function makeCtx(w = CARD_TEX_W, h = CARD_TEX_H): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

const VCA_CC0: AssetAttribution = {
  source: 'VCA Original Studio Library',
  license: 'VCA CC0 / Commercial OK',
  commercialOk: true,
  format: 'PNG',
};

const KENNEY_CC0: AssetAttribution = {
  source: 'Kenney Particle & UI Style Pack',
  license: 'CC0 1.0 Public Domain',
  url: 'https://kenney.nl/assets',
  commercialOk: true,
  format: 'PNG',
};

const OGA_CC0: AssetAttribution = {
  source: 'OpenGameArt Elemental FX Pack',
  license: 'CC0 / CC-BY Compatible',
  url: 'https://opengameart.org/',
  commercialOk: true,
  format: 'PNG',
};

const MODEL3D_CC0: AssetAttribution = {
  source: 'VCA 3D Collectible Mesh Pack',
  license: 'CC0 / Commercial OK',
  commercialOk: true,
  format: 'GLB',
};

export const ASSET_CATALOG: LibraryAsset[] = [
  // ================= SHADOWBOX & CARD FRAMES =================
  {
    id: 'png-teal-window',
    name: 'Shadowbox Teal Window Frame',
    kind: 'png',
    role: 'foreground',
    category: 'Card Frames',
    sourceCategory: 'frames',
    tags: ['window', 'frame', 'shadowbox', 'teal', 'glass', 'architecture', 'mullion'],
    previewBg: '#1e293b',
    attribution: VCA_CC0,
    render: (ctx, w, h) => {
      ctx.fillStyle = '#47362b';
      ctx.fillRect(0, 0, 155, h);
      ctx.fillRect(w - 155, 0, 155, h);
      ctx.fillRect(0, 0, w, 120);
      ctx.strokeStyle = 'rgba(20, 14, 10, 0.55)';
      ctx.lineWidth = 4;
      for (let row = 0; row < 12; row++) {
        const y = row * 72 + 20;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(155, y);
        ctx.moveTo(w - 155, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      const sillG = ctx.createLinearGradient(0, 560, 0, 620);
      sillG.addColorStop(0, '#CBD5E1');
      sillG.addColorStop(1, '#64748B');
      ctx.fillStyle = sillG;
      roundedRect(ctx, 110, 562, w - 220, 48, 8);
      ctx.fill();
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.strokeStyle = '#0F766E';
      ctx.lineWidth = 28;
      ctx.strokeRect(156, 126, w - 312, 436);
      ctx.strokeStyle = '#2DD4BF';
      ctx.lineWidth = 8;
      ctx.strokeRect(156, 126, w - 312, 436);

      ctx.fillStyle = '#14B8A6';
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 3;
      ctx.fillRect(w / 2 - 12, 126, 24, 436);
      ctx.strokeRect(w / 2 - 12, 126, 24, 436);
      ctx.fillRect(156, 332, w - 312, 22);
      ctx.strokeRect(156, 332, w - 312, 22);

      ctx.save();
      ctx.beginPath();
      ctx.rect(170, 140, w - 340, 408);
      ctx.clip();
      const gl = ctx.createLinearGradient(160, 140, 580, 540);
      gl.addColorStop(0, 'rgba(224, 242, 254, 0.22)');
      gl.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
      gl.addColorStop(1, 'rgba(186, 230, 253, 0.18)');
      ctx.fillStyle = gl;
      ctx.fillRect(170, 140, w - 340, 408);
      ctx.restore();
    },
  },
  {
    id: 'png-shadowbox-card-border',
    name: 'Collector Silver Card Frame',
    kind: 'png',
    role: 'frame',
    category: 'Card Frames',
    sourceCategory: 'frames',
    tags: ['card', 'border', 'frame', 'silver', 'collector', 'shadowbox'],
    previewBg: '#0f172a',
    attribution: VCA_CC0,
    render: (ctx, w, h) => {
      const frameG = ctx.createLinearGradient(0, 0, w, h);
      frameG.addColorStop(0, '#E2E8F0');
      frameG.addColorStop(0.5, '#94A3B8');
      frameG.addColorStop(1, '#CBD5E1');
      ctx.strokeStyle = frameG;
      ctx.lineWidth = 36;
      roundedRect(ctx, 20, 20, w - 40, h - 40, 28);
      ctx.stroke();

      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 4;
      roundedRect(ctx, 38, 38, w - 76, h - 76, 18);
      ctx.stroke();

      ctx.fillStyle = 'rgba(15, 23, 42, 0.86)';
      roundedRect(ctx, 56, 48, w - 112, 58, 12);
      ctx.fill();
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#F8FAFC';
      ctx.font = '700 26px Outfit, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('SHADOWBOX EDITION', 78, 86);
      ctx.fillStyle = '#F59E0B';
      ctx.font = '700 22px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText('3D', w - 78, 85);

      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      roundedRect(ctx, 56, h - 148, w - 112, 92, 12);
      ctx.fill();
      ctx.strokeStyle = '#94A3B8';
      ctx.stroke();

      ctx.fillStyle = '#E2E8F0';
      ctx.font = '600 18px "DM Sans", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('LAYERED DIORAMA · VCA LAB', 78, h - 108);
      ctx.fillStyle = '#94A3B8';
      ctx.font = '500 14px "JetBrains Mono", monospace';
      ctx.fillText('VCA ORIGINAL · 3D DEPTH', 78, h - 76);
    },
  },

  // ================= ORIGINAL CHARACTERS =================
  {
    id: 'png-ember-lizard',
    name: 'Ember Salamander (Original)',
    kind: 'png',
    role: 'character',
    category: 'Characters',
    sourceCategory: 'characters',
    tags: ['lizard', 'dragon', 'fire', 'ember', 'creature', 'cute', 'original'],
    previewBg: '#0f172a',
    attribution: VCA_CC0,
    render: (ctx, w, h) => {
      ctx.save();
      ctx.translate(w * 0.5, h * 0.45);
      const bodyG = ctx.createRadialGradient(-10, -20, 18, 0, 10, 145);
      bodyG.addColorStop(0, '#FB923C');
      bodyG.addColorStop(0.65, '#EA580C');
      bodyG.addColorStop(1, '#9A3412');

      ctx.fillStyle = '#EA580C';
      ctx.beginPath();
      ctx.moveTo(45, 75);
      ctx.quadraticCurveTo(165, 95, 160, -10);
      ctx.quadraticCurveTo(130, 35, 50, 45);
      ctx.closePath();
      ctx.fill();

      const flameG = ctx.createRadialGradient(162, -26, 4, 162, -26, 46);
      flameG.addColorStop(0, '#FEF9C3');
      flameG.addColorStop(0.45, '#F59E0B');
      flameG.addColorStop(1, 'rgba(239, 68, 68, 0)');
      ctx.fillStyle = flameG;
      ctx.beginPath();
      ctx.arc(162, -26, 46, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = bodyG;
      ctx.strokeStyle = '#431407';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(0, 56, 70, 88, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FEF3C7';
      ctx.beginPath();
      ctx.ellipse(0, 62, 46, 68, 0, 0, Math.PI * 2);
      ctx.fill();

      for (const dir of [-1, 1]) {
        ctx.fillStyle = '#F97316';
        ctx.beginPath();
        ctx.ellipse(dir * 66, 22, 26, 18, dir * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      ctx.fillStyle = bodyG;
      ctx.beginPath();
      ctx.ellipse(0, -56, 62, 58, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      for (const dir of [-1, 1]) {
        ctx.fillStyle = '#0F172A';
        ctx.beginPath();
        ctx.ellipse(dir * 24, -64, 12, 16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.arc(dir * 24, -61, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(dir * 24 - 3, -70, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    },
  },
  {
    id: 'png-crystal-cluster',
    name: 'Prism Crystal Guardian',
    kind: 'png',
    role: 'character',
    category: 'Characters',
    sourceCategory: 'characters',
    tags: ['crystal', 'gem', 'prism', 'ice', 'shards', 'blue'],
    previewBg: '#090d16',
    attribution: VCA_CC0,
    render: (ctx, w, h) => {
      ctx.save();
      ctx.translate(w / 2, h * 0.62);
      const shards = [
        [-75, 20, -28, -165, 24, 20, '#38BDF8'],
        [0, 35, 12, -230, 58, 35, '#818CF8'],
        [75, 25, 92, -145, 125, 25, '#2DD4BF'],
      ] as const;
      for (const [x1, y1, tx, ty, x2, y2, col] of shards) {
        const g = ctx.createLinearGradient(tx, ty, x2, y2);
        g.addColorStop(0, '#F8FAFC');
        g.addColorStop(0.4, col);
        g.addColorStop(1, '#1E1B4B');
        ctx.fillStyle = g;
        ctx.strokeStyle = '#E0F2FE';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(tx, ty);
        ctx.lineTo(x2, y2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    },
  },

  // ================= FOREGROUND & BOTANICALS =================
  {
    id: 'png-potted-tulips',
    name: 'Potted Yellow Tulips & Bird',
    kind: 'png',
    role: 'character',
    category: 'Foreground',
    sourceCategory: 'foreground',
    tags: ['flowers', 'tulips', 'pot', 'plant', 'bird', 'garden', 'shadowbox'],
    previewBg: '#1e293b',
    attribution: VCA_CC0,
    render: (ctx) => {
      ctx.save();
      ctx.translate(225, 505);
      ctx.fillStyle = '#F1F5F9';
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-58, -50);
      ctx.lineTo(58, -50);
      ctx.lineTo(44, 72);
      ctx.lineTo(-44, 72);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#15803D';
      for (const ang of [-0.5, -0.2, 0.15, 0.45]) {
        ctx.save();
        ctx.rotate(ang);
        ctx.beginPath();
        ctx.ellipse(0, -110, 15, 68, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      const tulipPos = [
        [-38, -165],
        [-2, -195],
        [34, -152],
      ];
      for (const [tx, ty] of tulipPos) {
        ctx.strokeStyle = '#166534';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(0, -50);
        ctx.lineTo(tx, ty);
        ctx.stroke();

        ctx.fillStyle = '#FACC15';
        ctx.strokeStyle = '#854D0E';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(tx, ty, 18, 28, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();

      ctx.save();
      ctx.translate(328, 520);
      ctx.fillStyle = '#78350F';
      ctx.strokeStyle = '#1C1917';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 12, 28, 34, -0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FEF3C7';
      ctx.beginPath();
      ctx.ellipse(-6, 18, 16, 22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#92400E';
      ctx.beginPath();
      ctx.arc(-6, -24, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.moveTo(-24, -24);
      ctx.lineTo(-40, -18);
      ctx.lineTo(-24, -13);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(-13, -27, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
  },
  {
    id: 'png-garden-flowers-fg',
    name: 'Foreground Garden Chair & Blooms',
    kind: 'png',
    role: 'foreground',
    category: 'Foreground',
    sourceCategory: 'foreground',
    tags: ['garden', 'chair', 'flowers', 'foreground', 'vines', 'blooms', 'shadowbox'],
    previewBg: '#0f172a',
    attribution: VCA_CC0,
    render: (ctx) => {
      ctx.save();
      ctx.translate(520, 740);
      ctx.strokeStyle = '#0F766E';
      ctx.lineWidth = 10;
      roundedRect(ctx, -95, -130, 175, 160, 60);
      ctx.stroke();
      ctx.strokeStyle = '#99F6E4';
      ctx.lineWidth = 3;
      roundedRect(ctx, -95, -130, 175, 160, 60);
      ctx.stroke();
      ctx.restore();

      const clusters = [
        [150, 790, '#F472B6'],
        [210, 750, '#E879F9'],
        [275, 815, '#FB7185'],
        [520, 690, '#60A5FA'],
        [575, 735, '#A78BFA'],
        [630, 790, '#F472B6'],
        [455, 815, '#34D399'],
      ] as const;

      for (const [cx, cy, col] of clusters) {
        ctx.fillStyle = '#14532D';
        ctx.beginPath();
        ctx.arc(cx, cy + 16, 46, 0, Math.PI * 2);
        ctx.fill();

        for (let p = 0; p < 6; p++) {
          const ang = (p / 6) * Math.PI * 2;
          ctx.fillStyle = col;
          ctx.strokeStyle = '#1E293B';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx + Math.cos(ang) * 18, cy + Math.sin(ang) * 18, 16, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.arc(cx, cy, 10, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
  {
    id: 'png-sakura-branch',
    name: 'Blooming Sakura Branch',
    kind: 'png',
    role: 'foreground',
    category: 'Foreground',
    sourceCategory: 'foreground',
    tags: ['sakura', 'cherry blossom', 'flowers', 'branch', 'pink', 'japanese'],
    previewBg: '#0f172a',
    attribution: VCA_CC0,
    render: (ctx) => {
      ctx.strokeStyle = '#3F2318';
      ctx.lineWidth = 18;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 140);
      ctx.quadraticCurveTo(220, 210, 440, 160);
      ctx.stroke();
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(190, 178);
      ctx.quadraticCurveTo(290, 270, 355, 310);
      ctx.stroke();

      const blossoms = [
        [90, 155, 28],
        [170, 185, 34],
        [270, 190, 30],
        [375, 168, 32],
        [440, 155, 24],
        [295, 265, 28],
        [360, 310, 24],
      ];
      for (const [bx, by, br] of blossoms) {
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          ctx.fillStyle = i % 2 === 0 ? '#FBCFE8' : '#F9A8D4';
          ctx.beginPath();
          ctx.arc(bx + Math.cos(a) * br * 0.55, by + Math.sin(a) * br * 0.55, br * 0.45, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#F43F5E';
        ctx.beginPath();
        ctx.arc(bx, by, br * 0.2, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
  {
    id: 'png-paper-lantern',
    name: 'Glowing Shrine Lantern',
    kind: 'png',
    role: 'foreground',
    category: 'Foreground',
    sourceCategory: 'foreground',
    tags: ['lantern', 'shrine', 'glow', 'red', 'japanese', 'light'],
    previewBg: '#090d16',
    attribution: VCA_CC0,
    render: (ctx) => {
      ctx.save();
      ctx.translate(185, 270);
      const glow = ctx.createRadialGradient(0, 0, 12, 0, 0, 130);
      glow.addColorStop(0, 'rgba(253, 224, 71, 0.75)');
      glow.addColorStop(0.5, 'rgba(239, 68, 68, 0.35)');
      glow.addColorStop(1, 'rgba(239, 68, 68, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, 130, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(0, -140);
      ctx.lineTo(0, -68);
      ctx.stroke();

      ctx.fillStyle = '#DC2626';
      ctx.beginPath();
      ctx.ellipse(0, 0, 52, 70, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(-34, -74, 68, 14);
      ctx.fillRect(-34, 60, 68, 14);
      ctx.restore();
    },
  },

  // ================= KENNEY CC0 PARTICLE & UI SPRITE ELEMENTS =================
  {
    id: 'kenney-starburst-flare',
    name: 'Starburst Lens Flare (Kenney)',
    kind: 'png',
    role: 'fx',
    category: 'Particles & FX',
    sourceCategory: 'kenney_fx',
    tags: ['kenney', 'star', 'flare', 'sparkle', 'glow', 'particle', 'ui'],
    previewBg: '#090d16',
    attribution: KENNEY_CC0,
    render: (ctx, w, h) => {
      ctx.save();
      ctx.translate(w / 2, h / 2);
      const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 220);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.25, 'rgba(56, 189, 248, 0.65)');
      g.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 220, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#F8FAFC';
      for (const ang of [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4]) {
        ctx.save();
        ctx.rotate(ang);
        ctx.beginPath();
        ctx.ellipse(0, 0, ang % (Math.PI / 2) === 0 ? 210 : 120, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    },
  },
  {
    id: 'kenney-holo-spark-ring',
    name: 'Particle Spark Ring (Kenney)',
    kind: 'png',
    role: 'fx',
    category: 'Particles & FX',
    sourceCategory: 'kenney_fx',
    tags: ['kenney', 'sparks', 'ring', 'particles', 'gold', 'glow'],
    previewBg: '#090d16',
    attribution: KENNEY_CC0,
    render: (ctx, w, h) => {
      ctx.save();
      ctx.translate(w / 2, h / 2);
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const r = 175 + (i % 3) * 28;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        const sz = 16 + (i % 4) * 8;
        const sg = ctx.createRadialGradient(x, y, 2, x, y, sz * 1.8);
        sg.addColorStop(0, '#FEF9C3');
        sg.addColorStop(0.4, 'rgba(251, 191, 36, 0.8)');
        sg.addColorStop(1, 'rgba(251, 191, 36, 0)');
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.arc(x, y, sz * 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    },
  },
  {
    id: 'kenney-ui-stat-badge',
    name: 'Holo Stat Crest Panel (Kenney)',
    kind: 'png',
    role: 'text',
    category: 'UI & Badges',
    sourceCategory: 'kenney_fx',
    tags: ['kenney', 'ui', 'panel', 'badge', 'crest', 'hud'],
    previewBg: '#090d16',
    attribution: KENNEY_CC0,
    render: (ctx, w) => {
      ctx.save();
      ctx.translate(w - 150, 175);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#22D3EE';
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
        const px = Math.cos(a) * 68;
        const py = Math.sin(a) * 68;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#F8FAFC';
      ctx.font = '700 28px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('EX', 0, -6);
      ctx.fillStyle = '#22D3EE';
      ctx.font = '600 13px "JetBrains Mono", monospace';
      ctx.fillText('TIER 1', 0, 22);
      ctx.restore();
    },
  },

  // ================= OPENGAMEART ELEMENTAL EFFECTS =================
  {
    id: 'png-lightning-arcs',
    name: 'Electric Plasma Lightning',
    kind: 'png',
    role: 'energy',
    category: 'Elemental FX',
    sourceCategory: 'oga_effects',
    tags: ['lightning', 'electric', 'volt', 'thunder', 'fx', 'energy', 'opengameart'],
    previewBg: '#090d16',
    attribution: OGA_CC0,
    render: (ctx) => {
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 8;
      ctx.shadowColor = '#7DD3FC';
      ctx.shadowBlur = 22;
      const paths = [
        [[80, 160], [220, 280], [175, 330], [340, 470]],
        [[670, 200], [520, 320], [565, 370], [410, 500]],
        [[120, 820], [250, 690], [220, 635], [355, 540]],
        [[630, 840], [495, 700], [535, 645], [400, 545]],
      ];
      for (const p of paths) {
        ctx.beginPath();
        ctx.moveTo(p[0][0], p[0][1]);
        for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    },
  },
  {
    id: 'oga-solar-flame-burst',
    name: 'Inferno Flame Vortex',
    kind: 'png',
    role: 'energy',
    category: 'Elemental FX',
    sourceCategory: 'oga_effects',
    tags: ['fire', 'flame', 'inferno', 'attack', 'opengameart', 'energy'],
    previewBg: '#120707',
    attribution: OGA_CC0,
    render: (ctx, w, h) => {
      ctx.save();
      ctx.translate(w / 2, h * 0.55);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const r = 160;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r * 0.85;
        const g = ctx.createRadialGradient(x, y, 8, x, y, 105);
        g.addColorStop(0, '#FEF08A');
        g.addColorStop(0.4, 'rgba(249, 115, 22, 0.82)');
        g.addColorStop(1, 'rgba(220, 38, 38, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, 105, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    },
  },
  {
    id: 'oga-aqua-vortex',
    name: 'Hydro Surge Splash Ring',
    kind: 'png',
    role: 'energy',
    category: 'Elemental FX',
    sourceCategory: 'oga_effects',
    tags: ['water', 'aqua', 'hydro', 'splash', 'wave', 'opengameart'],
    previewBg: '#07131d',
    attribution: OGA_CC0,
    render: (ctx, w, h) => {
      ctx.save();
      ctx.translate(w / 2, h * 0.52);
      for (let ring = 0; ring < 3; ring++) {
        ctx.strokeStyle = ring === 0 ? '#7DD3FC' : ring === 1 ? '#38BDF8' : '#0284C7';
        ctx.lineWidth = 14 - ring * 3;
        ctx.beginPath();
        ctx.arc(0, 0, 165 + ring * 32, 0.3 + ring * 0.4, Math.PI * 1.75 + ring * 0.3);
        ctx.stroke();
      }
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        const r = 205 + (i % 2) * 30;
        ctx.fillStyle = '#BAE6FD';
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 8 + (i % 3) * 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    },
  },
  {
    id: 'png-magic-circle',
    name: 'Astral Runic Halo',
    kind: 'png',
    role: 'fx',
    category: 'Elemental FX',
    sourceCategory: 'oga_effects',
    tags: ['magic', 'circle', 'halo', 'runic', 'aura', 'gold', 'opengameart'],
    previewBg: '#090d16',
    attribution: OGA_CC0,
    render: (ctx, w, h) => {
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.strokeStyle = '#F59E0B';
      ctx.shadowColor = '#FBBF24';
      ctx.shadowBlur = 16;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, 250, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 3;
      ctx.setLineDash([18, 12]);
      ctx.beginPath();
      ctx.arc(0, 0, 210, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 165, Math.sin(a) * 165);
        ctx.lineTo(Math.cos(a + Math.PI * 0.75) * 165, Math.sin(a + Math.PI * 0.75) * 165);
        ctx.stroke();
      }
      ctx.restore();
    },
  },

  // ================= 3D PROCEDURAL COLLECTIBLE OBJECTS =================
  {
    id: 'model-crystal-gem',
    name: '3D Faceted Prism Crystal',
    kind: 'model3d',
    role: 'character',
    category: '3D Objects',
    sourceCategory: 'models3d',
    proceduralModelId: 'crystal_gem',
    tags: ['3d', 'model', 'crystal', 'gem', 'glb', 'mesh'],
    previewBg: '#09111f',
    attribution: MODEL3D_CC0,
    render: (ctx, w, h) => {
      ctx.save();
      ctx.translate(w / 2, h / 2);
      const g = ctx.createLinearGradient(-80, -140, 80, 140);
      g.addColorStop(0, '#E0F2FE');
      g.addColorStop(0.5, '#06B6D4');
      g.addColorStop(1, '#6366F1');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, -170);
      ctx.lineTo(105, -25);
      ctx.lineTo(70, 155);
      ctx.lineTo(0, 195);
      ctx.lineTo(-70, 155);
      ctx.lineTo(-105, -25);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.restore();
    },
  },
  {
    id: 'model-arcane-ring',
    name: '3D Orbital Runic Halo',
    kind: 'model3d',
    role: 'fx',
    category: '3D Objects',
    sourceCategory: 'models3d',
    proceduralModelId: 'arcane_ring',
    tags: ['3d', 'model', 'ring', 'torus', 'halo', 'magic'],
    previewBg: '#120d1e',
    attribution: MODEL3D_CC0,
    render: (ctx, w, h) => {
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 24;
      ctx.beginPath();
      ctx.ellipse(0, 0, 175, 115, -0.35, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#A78BFA';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.ellipse(0, 0, 130, 82, 0.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    },
  },
  {
    id: 'model-elemental-orb',
    name: '3D Plasma Energy Core',
    kind: 'model3d',
    role: 'energy',
    category: '3D Objects',
    sourceCategory: 'models3d',
    proceduralModelId: 'elemental_orb',
    tags: ['3d', 'model', 'orb', 'sphere', 'energy', 'plasma'],
    previewBg: '#09111f',
    attribution: MODEL3D_CC0,
    render: (ctx, w, h) => {
      ctx.save();
      ctx.translate(w / 2, h / 2);
      const g = ctx.createRadialGradient(-30, -30, 15, 0, 0, 145);
      g.addColorStop(0, '#FFFFFF');
      g.addColorStop(0.35, '#38BDF8');
      g.addColorStop(0.75, '#7C3AED');
      g.addColorStop(1, '#1E1B4B');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 145, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
  },
  {
    id: 'model-star-crest',
    name: '3D Gold Collector Emblem',
    kind: 'model3d',
    role: 'foreground',
    category: '3D Objects',
    sourceCategory: 'models3d',
    proceduralModelId: 'star_crest',
    tags: ['3d', 'model', 'star', 'gold', 'crest', 'emblem'],
    previewBg: '#161108',
    attribution: MODEL3D_CC0,
    render: (ctx, w, h) => {
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.fillStyle = '#F59E0B';
      ctx.strokeStyle = '#FEF3C7';
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 === 0 ? 155 : 68;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    },
  },

  // ================= BACKGROUND OUTPUT IMAGES =================
  {
    id: 'bg-sunlit-garden',
    name: 'Sunlit Courtyard Garden BG',
    kind: 'background',
    role: 'background',
    category: 'Backgrounds',
    sourceCategory: 'backgrounds',
    tags: ['garden', 'sunny', 'daylight', 'sky', 'trees', 'courtyard', 'background'],
    previewBg: '#38bdf8',
    attribution: VCA_CC0,
    render: (ctx, w, h) => {
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#38BDF8');
      sky.addColorStop(0.55, '#BAE6FD');
      sky.addColorStop(1, '#FEF9C3');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      const sun = ctx.createRadialGradient(w * 0.55, h * 0.3, 20, w * 0.55, h * 0.3, 280);
      sun.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      sun.addColorStop(0.5, 'rgba(254, 240, 138, 0.45)');
      sun.addColorStop(1, 'rgba(254, 240, 138, 0)');
      ctx.fillStyle = sun;
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = '#4ADE80';
      ctx.beginPath();
      ctx.moveTo(0, 620);
      ctx.quadraticCurveTo(240, 500, 480, 580);
      ctx.quadraticCurveTo(640, 610, w, 540);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#16A34A';
      ctx.beginPath();
      ctx.moveTo(0, 740);
      ctx.quadraticCurveTo(375, 650, w, 750);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();
    },
  },
  {
    id: 'bg-moonlit-shrine',
    name: 'Moonlit Indigo Shrine BG',
    kind: 'background',
    role: 'background',
    category: 'Backgrounds',
    sourceCategory: 'backgrounds',
    tags: ['moon', 'night', 'indigo', 'shrine', 'torii', 'stars', 'background'],
    previewBg: '#1e1b4b',
    attribution: VCA_CC0,
    render: (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#090B1A');
      g.addColorStop(0.5, '#1E1B4B');
      g.addColorStop(1, '#2E1065');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      const moon = ctx.createRadialGradient(w / 2, 340, 40, w / 2, 340, 240);
      moon.addColorStop(0, '#FFFDF7');
      moon.addColorStop(0.55, '#E0E7FF');
      moon.addColorStop(0.68, 'rgba(165,180,252,0.3)');
      moon.addColorStop(1, 'rgba(30,27,75,0)');
      ctx.fillStyle = moon;
      ctx.beginPath();
      ctx.arc(w / 2, 340, 240, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#0B0F1E';
      ctx.fillRect(245, 600, 22, 220);
      ctx.fillRect(483, 600, 22, 220);
      ctx.fillRect(205, 585, 340, 24);
      ctx.fillRect(225, 632, 300, 14);
    },
  },
  {
    id: 'bg-cosmic-nebula',
    name: 'Cosmic Nebula Void BG',
    kind: 'background',
    role: 'background',
    category: 'Backgrounds',
    sourceCategory: 'backgrounds',
    tags: ['space', 'nebula', 'cosmos', 'galaxy', 'stars', 'violet', 'background'],
    previewBg: '#090d16',
    attribution: VCA_CC0,
    render: (ctx, w, h) => {
      ctx.fillStyle = '#050711';
      ctx.fillRect(0, 0, w, h);
      const neb1 = ctx.createRadialGradient(220, 360, 20, 220, 360, 380);
      neb1.addColorStop(0, 'rgba(139, 92, 246, 0.65)');
      neb1.addColorStop(1, 'rgba(139, 92, 246, 0)');
      ctx.fillStyle = neb1;
      ctx.fillRect(0, 0, w, h);

      const neb2 = ctx.createRadialGradient(540, 640, 20, 540, 640, 360);
      neb2.addColorStop(0, 'rgba(14, 165, 233, 0.55)');
      neb2.addColorStop(1, 'rgba(14, 165, 233, 0)');
      ctx.fillStyle = neb2;
      ctx.fillRect(0, 0, w, h);

      for (let i = 0; i < 140; i++) {
        ctx.fillStyle = `rgba(255,255,255,${0.25 + (i % 5) * 0.15})`;
        ctx.beginPath();
        ctx.arc((i * 197) % w, (i * 317) % h, (i % 3) * 0.8 + 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
  {
    id: 'bg-crimson-forge',
    name: 'Molten Ember Cavern BG',
    kind: 'background',
    role: 'background',
    category: 'Backgrounds',
    sourceCategory: 'backgrounds',
    tags: ['fire', 'lava', 'crimson', 'ember', 'cave', 'orange', 'background'],
    previewBg: '#450a0a',
    attribution: VCA_CC0,
    render: (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#1C090C');
      g.addColorStop(0.55, '#5C1111');
      g.addColorStop(1, '#1A0808');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      const glow = ctx.createRadialGradient(w / 2, h * 0.45, 20, w / 2, h * 0.45, 340);
      glow.addColorStop(0, 'rgba(253, 224, 71, 0.72)');
      glow.addColorStop(0.4, 'rgba(249, 115, 22, 0.45)');
      glow.addColorStop(1, 'rgba(220, 38, 38, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: 'bg-neon-cyber-grid',
    name: 'Cyber Horizon Grid BG',
    kind: 'background',
    role: 'background',
    category: 'Backgrounds',
    sourceCategory: 'backgrounds',
    tags: ['neon', 'cyber', 'grid', 'synthwave', 'cyan', 'violet', 'background'],
    previewBg: '#090b16',
    attribution: VCA_CC0,
    render: (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#070914');
      g.addColorStop(0.55, '#1E1B4B');
      g.addColorStop(1, '#0F172A');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      const sun = ctx.createRadialGradient(w / 2, h * 0.48, 20, w / 2, h * 0.48, 220);
      sun.addColorStop(0, 'rgba(34, 211, 238, 0.8)');
      sun.addColorStop(0.5, 'rgba(139, 92, 246, 0.45)');
      sun.addColorStop(1, 'rgba(139, 92, 246, 0)');
      ctx.fillStyle = sun;
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.48, 220, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(34, 211, 238, 0.35)';
      ctx.lineWidth = 2;
      const horizon = h * 0.56;
      for (let i = 0; i <= 12; i++) {
        const y = horizon + Math.pow(i / 12, 1.8) * (h - horizon);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      for (let i = -8; i <= 8; i++) {
        ctx.beginPath();
        ctx.moveTo(w / 2 + i * 24, horizon);
        ctx.lineTo(w / 2 + i * 165, h);
        ctx.stroke();
      }
    },
  },
];

export function renderLibraryAssetUrl(asset: LibraryAsset): string {
  const existing = renderedCache.get(asset.id);
  if (existing) return existing;
  const [c, ctx] = makeCtx();
  ctx.clearRect(0, 0, CARD_TEX_W, CARD_TEX_H);
  asset.render(ctx, CARD_TEX_W, CARD_TEX_H);
  const url = c.toDataURL('image/png');
  renderedCache.set(asset.id, url);
  return url;
}

export function synthesizeCustomAsset(
  query: string,
  kind: 'png' | 'background'
): { name: string; role: LayerRole; imageUrl: string; attribution: AssetAttribution } {
  const q = query.trim().toLowerCase() || 'custom motif';
  const [c, ctx] = makeCtx();

  let hash = 0;
  for (let i = 0; i < q.length; i++) {
    hash = (hash * 31 + q.charCodeAt(i)) % 360;
  }
  const colorMap: Array<[string, number]> = [
    ['red', 4],
    ['fire', 18],
    ['flame', 20],
    ['gold', 42],
    ['yellow', 52],
    ['green', 140],
    ['forest', 135],
    ['teal', 175],
    ['cyan', 190],
    ['blue', 210],
    ['ice', 198],
    ['indigo', 240],
    ['purple', 275],
    ['violet', 270],
    ['pink', 330],
    ['sakura', 340],
  ];
  let hue = hash;
  for (const [kw, hVal] of colorMap) {
    if (q.includes(kw)) {
      hue = hVal;
      break;
    }
  }

  if (kind === 'background') {
    const bg = ctx.createLinearGradient(0, 0, 0, CARD_TEX_H);
    bg.addColorStop(0, `hsl(${hue}, 55%, 12%)`);
    bg.addColorStop(0.55, `hsl(${(hue + 24) % 360}, 62%, 22%)`);
    bg.addColorStop(1, `hsl(${hue}, 48%, 8%)`);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CARD_TEX_W, CARD_TEX_H);

    const orb = ctx.createRadialGradient(
      CARD_TEX_W / 2,
      CARD_TEX_H * 0.4,
      30,
      CARD_TEX_W / 2,
      CARD_TEX_H * 0.4,
      320
    );
    orb.addColorStop(0, `hsla(${(hue + 30) % 360}, 90%, 72%, 0.75)`);
    orb.addColorStop(1, `hsla(${hue}, 80%, 30%, 0)`);
    ctx.fillStyle = orb;
    ctx.fillRect(0, 0, CARD_TEX_W, CARD_TEX_H);

    return {
      name: `${query.trim() || 'Custom'} Background`,
      role: 'background',
      imageUrl: c.toDataURL('image/png'),
      attribution: VCA_CC0,
    };
  }

  ctx.clearRect(0, 0, CARD_TEX_W, CARD_TEX_H);
  ctx.save();
  ctx.translate(CARD_TEX_W / 2, CARD_TEX_H * 0.48);

  const glow = ctx.createRadialGradient(0, 0, 12, 0, 0, 210);
  glow.addColorStop(0, `hsla(${hue}, 95%, 72%, 0.85)`);
  glow.addColorStop(0.55, `hsla(${(hue + 28) % 360}, 85%, 52%, 0.4)`);
  glow.addColorStop(1, `hsla(${hue}, 80%, 40%, 0)`);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 210, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = `hsl(${hue}, 90%, 82%)`;
  ctx.fillStyle = `hsla(${hue}, 80%, 58%, 0.85)`;
  ctx.lineWidth = 5;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? 155 : 110;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  return {
    name: `${query.trim() || 'Custom'} PNG`,
    role: 'character',
    imageUrl: c.toDataURL('image/png'),
    attribution: VCA_CC0,
  };
}
