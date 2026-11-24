import type {
  CardProportionPreset,
  FrameConfig,
  FrameStylePreset,
} from '../types/card';
import { CARD_TEX_H, CARD_TEX_W } from './imageProcessing';

export interface FramePresetTemplate {
  id: FrameStylePreset;
  label: string;
  desc: string;
  defaults: Partial<FrameConfig>;
}

export const FRAME_PRESETS: FramePresetTemplate[] = [
  {
    id: 'classic_vca',
    label: 'Classic VCA',
    desc: 'Structured collector frame with clean title & footer plates',
    defaults: {
      materialFinish: 'metallic',
      borderThickness: 28,
      frameDepth: 0.05,
      cornerRadius: 28,
      metallicIntensity: 0.72,
      holoIntensity: 0.35,
      innerFrameVisible: true,
      showTextPanels: true,
      windowOpacity: 0,
      borderColor: '#1E293B',
      innerBorderColor: '#94A3B8',
      accentColor: '#F59E0B',
    },
  },
  {
    id: 'full_art',
    label: 'Full Art',
    desc: 'Slim edge bezel keeping 92% open artwork window',
    defaults: {
      materialFinish: 'holo',
      borderThickness: 16,
      frameDepth: 0.035,
      cornerRadius: 24,
      metallicIntensity: 0.5,
      holoIntensity: 0.78,
      innerFrameVisible: true,
      showTextPanels: true,
      windowOpacity: 0,
      borderColor: '#0F172A',
      innerBorderColor: '#38BDF8',
      accentColor: '#38BDF8',
    },
  },
  {
    id: 'extended_art',
    label: 'Extended Art',
    desc: 'Borderless top/sides with floating crystal accent corners',
    defaults: {
      materialFinish: 'holo',
      borderThickness: 12,
      frameDepth: 0.025,
      cornerRadius: 18,
      metallicIntensity: 0.35,
      holoIntensity: 0.65,
      innerFrameVisible: false,
      showTextPanels: false,
      windowOpacity: 0,
      borderColor: '#1E1B4B',
      innerBorderColor: '#818CF8',
      accentColor: '#A78BFA',
    },
  },
  {
    id: 'gold_metallic',
    label: 'Gold Metallic',
    desc: 'Brushed 24k gold bevel with engraved corner plates',
    defaults: {
      materialFinish: 'metallic',
      borderThickness: 32,
      frameDepth: 0.075,
      cornerRadius: 28,
      metallicIntensity: 0.96,
      holoIntensity: 0.25,
      innerFrameVisible: true,
      showTextPanels: true,
      windowOpacity: 0,
      borderColor: '#92400E',
      innerBorderColor: '#FDE68A',
      accentColor: '#FBBF24',
    },
  },
  {
    id: 'silver_metallic',
    label: 'Silver Platinum',
    desc: 'Machined titanium & platinum border frame',
    defaults: {
      materialFinish: 'metallic',
      borderThickness: 28,
      frameDepth: 0.06,
      cornerRadius: 24,
      metallicIntensity: 0.9,
      holoIntensity: 0.3,
      innerFrameVisible: true,
      showTextPanels: true,
      windowOpacity: 0,
      borderColor: '#64748B',
      innerBorderColor: '#E2E8F0',
      accentColor: '#38BDF8',
    },
  },
  {
    id: 'rainbow_holo',
    label: 'Rainbow Holo',
    desc: 'Prismatic spectrum gradient bezel with high-glint diffraction',
    defaults: {
      materialFinish: 'holo',
      borderThickness: 30,
      frameDepth: 0.06,
      cornerRadius: 30,
      metallicIntensity: 0.6,
      holoIntensity: 1.0,
      innerFrameVisible: true,
      showTextPanels: true,
      windowOpacity: 0.04,
      borderColor: '#7C3AED',
      innerBorderColor: '#F472B6',
      accentColor: '#22D3EE',
    },
  },
  {
    id: 'obsidian',
    label: 'Obsidian Relic',
    desc: 'Matte volcanic dark slate with razor-sharp gold pinstripe',
    defaults: {
      materialFinish: 'obsidian',
      borderThickness: 34,
      frameDepth: 0.085,
      cornerRadius: 16,
      metallicIntensity: 0.3,
      holoIntensity: 0.2,
      innerFrameVisible: true,
      showTextPanels: true,
      windowOpacity: 0,
      borderColor: '#090D16',
      innerBorderColor: '#334155',
      accentColor: '#F59E0B',
    },
  },
  {
    id: 'electric_neon',
    label: 'Electric Neon',
    desc: 'Cybernetic cyan-violet rim glow with tech chamfer plates',
    defaults: {
      materialFinish: 'neon',
      borderThickness: 24,
      frameDepth: 0.055,
      cornerRadius: 14,
      metallicIntensity: 0.45,
      holoIntensity: 0.85,
      innerFrameVisible: true,
      showTextPanels: true,
      windowOpacity: 0,
      borderColor: '#0F172A',
      innerBorderColor: '#06B6D4',
      accentColor: '#22D3EE',
    },
  },
  {
    id: 'elemental_flame',
    label: 'Elemental Ember',
    desc: 'Forged crimson-amber crest frame for elemental cards',
    defaults: {
      materialFinish: 'metallic',
      borderThickness: 30,
      frameDepth: 0.065,
      cornerRadius: 26,
      metallicIntensity: 0.78,
      holoIntensity: 0.55,
      innerFrameVisible: true,
      showTextPanels: true,
      windowOpacity: 0,
      borderColor: '#450A0A',
      innerBorderColor: '#F97316',
      accentColor: '#FB923C',
    },
  },
  {
    id: 'collector_crest',
    label: 'Premium Collector',
    desc: 'Museum-grade deep navy & champagne gold shadowbox surround',
    defaults: {
      materialFinish: 'metallic',
      borderThickness: 36,
      frameDepth: 0.095,
      cornerRadius: 24,
      metallicIntensity: 0.85,
      holoIntensity: 0.45,
      innerFrameVisible: true,
      showTextPanels: true,
      windowOpacity: 0,
      borderColor: '#0F172A',
      innerBorderColor: '#FDE68A',
      accentColor: '#F59E0B',
    },
  },
];

export function createDefaultFrameConfig(): FrameConfig {
  return {
    enabled: false,
    preset: 'classic_vca',
    proportion: 'standard_tcg',
    borderThickness: 28,
    frameDepth: 0.055,
    cornerRadius: 26,
    materialFinish: 'metallic',
    metallicIntensity: 0.75,
    holoIntensity: 0.45,
    innerFrameVisible: true,
    showTextPanels: true,
    windowOpacity: 0,
    borderColor: '#1E293B',
    innerBorderColor: '#94A3B8',
    accentColor: '#F59E0B',
    title: 'ORIGINAL EDITION',
    powerLabel: 'PWR 340',
    subtitle: 'VCA STUDIO · LAYERED 3D',
    serial: 'VCA-001 / 050',
  };
}

export function getCardDimensionsForProportion(proportion: CardProportionPreset): {
  width: number;
  height: number;
  texW: number;
  texH: number;
} {
  if (proportion === 'tall_showcase') {
    return { width: 2.5, height: 3.8, texW: 750, texH: 1140 };
  }
  if (proportion === 'square_relic') {
    return { width: 3.0, height: 3.0, texW: 900, texH: 900 };
  }
  return { width: 2.5, height: 3.5, texW: CARD_TEX_W, texH: CARD_TEX_H };
}

function traceRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

/**
 * Generates an original VCA trading card frame as a crisp transparent PNG DataURL.
 * Leaves the central artwork window alpha-transparent so layered 3D artwork & characters shine through.
 */
export function renderVcaFramePng(config: FrameConfig): string {
  const { texW: w, texH: h } = getCardDimensionsForProportion(config.proportion);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);

  const b = Math.max(8, Math.min(54, config.borderThickness));
  const r = Math.max(4, Math.min(52, config.cornerRadius));

  // Build outer border mask using evenodd fill rule so the artwork window stays genuinely transparent
  ctx.save();
  ctx.beginPath();
  // Outer rectangle
  const ox = 4;
  const oy = 4;
  const ow = w - 8;
  const oh = h - 8;
  const or = Math.min(r, ow / 2, oh / 2);
  ctx.moveTo(ox + or, oy);
  ctx.lineTo(ox + ow - or, oy);
  ctx.quadraticCurveTo(ox + ow, oy, ox + ow, oy + or);
  ctx.lineTo(ox + ow, oy + oh - or);
  ctx.quadraticCurveTo(ox + ow, oy + oh, ox + ow - or, oy + oh);
  ctx.lineTo(ox + or, oy + oh);
  ctx.quadraticCurveTo(ox, oy + oh, ox, oy + oh - or);
  ctx.lineTo(ox, oy + or);
  ctx.quadraticCurveTo(ox, oy, ox + or, oy);
  ctx.closePath();

  // Inner transparent window cutout (counter-clockwise / evenodd)
  const ix = ox + b;
  const iy = oy + b;
  const iw = ow - b * 2;
  const ih = oh - b * 2;
  const ir = Math.max(2, or - b * 0.45);
  ctx.moveTo(ix + ir, iy);
  ctx.lineTo(ix + iw - ir, iy);
  ctx.quadraticCurveTo(ix + iw, iy, ix + iw, iy + ir);
  ctx.lineTo(ix + iw, iy + ih - ir);
  ctx.quadraticCurveTo(ix + iw, iy + ih, ix + iw - ir, iy + ih);
  ctx.lineTo(ix + ir, iy + ih);
  ctx.quadraticCurveTo(ix, iy + ih, ix, iy + ih - ir);
  ctx.lineTo(ix, iy + ir);
  ctx.quadraticCurveTo(ix, iy, ix + ir, iy);
  ctx.closePath();

  if (config.materialFinish === 'holo' || config.preset === 'rainbow_holo') {
    const holoGrad = ctx.createLinearGradient(0, 0, w, h);
    holoGrad.addColorStop(0, '#06B6D4');
    holoGrad.addColorStop(0.28, '#8B5CF6');
    holoGrad.addColorStop(0.55, '#EC4899');
    holoGrad.addColorStop(0.8, '#F59E0B');
    holoGrad.addColorStop(1, '#22D3EE');
    ctx.fillStyle = holoGrad;
  } else if (config.materialFinish === 'metallic') {
    const metGrad = ctx.createLinearGradient(0, 0, w, h);
    metGrad.addColorStop(0, config.borderColor);
    metGrad.addColorStop(0.35, config.innerBorderColor);
    metGrad.addColorStop(0.65, config.borderColor);
    metGrad.addColorStop(1, config.innerBorderColor);
    ctx.fillStyle = metGrad;
  } else {
    ctx.fillStyle = config.borderColor;
  }
  ctx.fill('evenodd');
  ctx.restore();

  // Optional subtle tinted glass inside artwork window
  if (config.windowOpacity > 0.005) {
    ctx.save();
    traceRoundedRect(ctx, ix, iy, iw, ih, ir);
    ctx.fillStyle = `rgba(148, 163, 184, ${Math.min(0.35, config.windowOpacity)})`;
    ctx.fill();
    ctx.restore();
  }

  // Inner pinstripe + neon glow
  if (config.innerFrameVisible) {
    ctx.save();
    traceRoundedRect(ctx, ix + 3, iy + 3, iw - 6, ih - 6, Math.max(2, ir - 2));
    ctx.lineWidth = config.materialFinish === 'neon' ? 5 : 3;
    if (config.materialFinish === 'neon') {
      ctx.shadowColor = config.accentColor;
      ctx.shadowBlur = 16;
    }
    ctx.strokeStyle = config.innerBorderColor;
    ctx.stroke();
    ctx.restore();
  }

  // Corner collector brackets
  const pad = b + 12;
  const arm = 36;
  const corners = [
    [pad, pad, 1, 1],
    [w - pad, pad, -1, 1],
    [pad, h - pad, 1, -1],
    [w - pad, h - pad, -1, -1],
  ] as const;
  ctx.save();
  ctx.strokeStyle = config.accentColor;
  ctx.fillStyle = config.accentColor;
  ctx.lineWidth = 3;
  for (const [cx, cy, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + sy * arm);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + sx * arm, cy);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx + sx * 10, cy + sy * 10, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Independent Title & Footer Text Panels
  if (config.showTextPanels) {
    const px = b + 16;
    const pw = w - px * 2;
    const topY = b + 16;

    // Top Header Plate
    ctx.save();
    const topGrad = ctx.createLinearGradient(px, topY, px + pw, topY + 62);
    topGrad.addColorStop(0, 'rgba(9, 13, 22, 0.88)');
    topGrad.addColorStop(0.5, 'rgba(18, 25, 40, 0.92)');
    topGrad.addColorStop(1, 'rgba(9, 13, 22, 0.88)');
    traceRoundedRect(ctx, px, topY, pw, 62, 12);
    ctx.fillStyle = topGrad;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = config.accentColor;
    ctx.stroke();

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '700 26px Outfit, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText((config.title || 'ORIGINAL CARD').slice(0, 24), px + 18, topY + 40);

    ctx.fillStyle = config.accentColor;
    ctx.font = '700 20px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText((config.powerLabel || 'PWR 300').slice(0, 12), px + pw - 18, topY + 39);
    ctx.restore();

    // Bottom Collector Plate
    const botH = 98;
    const botY = h - b - botH - 16;
    ctx.save();
    const botGrad = ctx.createLinearGradient(px, botY, px, botY + botH);
    botGrad.addColorStop(0, 'rgba(9, 13, 22, 0.88)');
    botGrad.addColorStop(1, 'rgba(14, 19, 32, 0.95)');
    traceRoundedRect(ctx, px, botY, pw, botH, 14);
    ctx.fillStyle = botGrad;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = config.accentColor;
    ctx.stroke();

    ctx.fillStyle = config.accentColor;
    ctx.font = '600 16px "DM Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText((config.subtitle || 'VCA STUDIO EDITION').slice(0, 34), px + 18, botY + 34);

    ctx.fillStyle = 'rgba(226, 232, 240, 0.78)';
    ctx.font = '500 14px "JetBrains Mono", monospace';
    ctx.fillText((config.serial || 'VCA-001').slice(0, 28), px + 18, botY + 68);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 13px "JetBrains Mono", monospace';
    ctx.fillText('VCA ORIGINAL FRAME', px + pw - 18, botY + 68);
    ctx.restore();
  }

  return c.toDataURL('image/png');
}
