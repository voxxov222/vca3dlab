import type { CardLayer, CardProject } from '../types/card';
import { ASSET_CATALOG, renderLibraryAssetUrl } from './assetLibrary';
import {
  CARD_TEX_H,
  CARD_TEX_W,
  DEPTH_TEX_H,
  DEPTH_TEX_W,
  generateAutoDepthMap,
} from './imageProcessing';

function makeCanvas(w = CARD_TEX_W, h = CARD_TEX_H): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

function drawRoundedRectPath(
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

function drawCardFrameOverlay(
  ctx: CanvasRenderingContext2D,
  opts: {
    borderColor: string;
    accentColor: string;
    title: string;
    subtitle: string;
    hpOrPower: string;
    serial: string;
  }
) {
  const w = CARD_TEX_W;
  const h = CARD_TEX_H;

  ctx.save();
  ctx.lineWidth = 24;
  ctx.strokeStyle = opts.borderColor;
  drawRoundedRectPath(ctx, 18, 18, w - 36, h - 36, 30);
  ctx.stroke();

  ctx.lineWidth = 4;
  ctx.strokeStyle = opts.accentColor;
  drawRoundedRectPath(ctx, 36, 36, w - 72, h - 72, 20);
  ctx.stroke();

  const corners = [
    [48, 48, 1, 1],
    [w - 48, 48, -1, 1],
    [48, h - 48, 1, -1],
    [w - 48, h - 48, -1, -1],
  ];
  ctx.strokeStyle = opts.accentColor;
  ctx.lineWidth = 3;
  for (const [cx, cy, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + sy * 44);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + sx * 44, cy);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx + sx * 12, cy + sy * 12, 4, 0, Math.PI * 2);
    ctx.fillStyle = opts.accentColor;
    ctx.fill();
  }

  const topGrad = ctx.createLinearGradient(60, 56, w - 60, 118);
  topGrad.addColorStop(0, 'rgba(10, 12, 20, 0.86)');
  topGrad.addColorStop(0.5, 'rgba(20, 24, 38, 0.9)');
  topGrad.addColorStop(1, 'rgba(10, 12, 20, 0.86)');
  ctx.fillStyle = topGrad;
  drawRoundedRectPath(ctx, 56, 56, w - 112, 68, 14);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = opts.accentColor;
  ctx.stroke();

  ctx.fillStyle = '#F8FAFC';
  ctx.font = '700 28px Outfit, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(opts.title, 78, 99);

  ctx.fillStyle = opts.accentColor;
  ctx.font = '600 22px "JetBrains Mono", monospace';
  ctx.textAlign = 'right';
  ctx.fillText(opts.hpOrPower, w - 78, 98);

  const botGrad = ctx.createLinearGradient(56, h - 185, w - 56, h - 56);
  botGrad.addColorStop(0, 'rgba(10, 12, 20, 0.88)');
  botGrad.addColorStop(1, 'rgba(15, 18, 28, 0.94)');
  ctx.fillStyle = botGrad;
  drawRoundedRectPath(ctx, 56, h - 178, w - 112, 118, 16);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = opts.accentColor;
  ctx.stroke();

  ctx.fillStyle = opts.accentColor;
  ctx.font = '600 17px "DM Sans", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(opts.subtitle, 80, h - 134);

  ctx.fillStyle = 'rgba(241, 245, 249, 0.82)';
  ctx.font = '400 16px "DM Sans", sans-serif';
  ctx.fillText('Depth-sculpted collector edition with dynamic foil relief', 80, h - 102);

  ctx.fillStyle = 'rgba(203, 213, 225, 0.72)';
  ctx.font = '500 14px "JetBrains Mono", monospace';
  ctx.fillText(opts.serial, 80, h - 75);

  ctx.textAlign = 'right';
  ctx.fillStyle = opts.accentColor;
  ctx.fillText('VCA LAB', w - 80, h - 75);
  ctx.restore();
}

function createRadialDepthSpot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  peak: number
) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  const v = Math.round(Math.min(255, Math.max(0, peak)));
  g.addColorStop(0, `rgba(${v},${v},${v},1)`);
  g.addColorStop(0.55, `rgba(${Math.round(v * 0.75)},${Math.round(v * 0.75)},${Math.round(v * 0.75)},0.8)`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Preset 0: Window Garden Shadowbox (inspired by layered physical shadowbox cards)
 */
async function buildWindowShadowboxPreset(): Promise<CardProject> {
  const findAsset = (id: string) => ASSET_CATALOG.find((a) => a.id === id)!;

  const bgUrl = renderLibraryAssetUrl(findAsset('bg-sunlit-garden'));
  const charUrl = renderLibraryAssetUrl(findAsset('png-ember-lizard'));
  const winUrl = renderLibraryAssetUrl(findAsset('png-teal-window'));
  const sillUrl = renderLibraryAssetUrl(findAsset('png-potted-tulips'));
  const fgFlowersUrl = renderLibraryAssetUrl(findAsset('png-garden-flowers-fg'));
  const borderUrl = renderLibraryAssetUrl(findAsset('png-shadowbox-card-border'));

  const [bgDepth, charDepth, winDepth, sillDepth, fgDepth, borderDepth] =
    await Promise.all([
      generateAutoDepthMap(bgUrl, 'background'),
      generateAutoDepthMap(charUrl, 'character'),
      generateAutoDepthMap(winUrl, 'foreground'),
      generateAutoDepthMap(sillUrl, 'character'),
      generateAutoDepthMap(fgFlowersUrl, 'foreground'),
      generateAutoDepthMap(borderUrl, 'foreground'),
    ]);

  const layers: CardLayer[] = [
    {
      id: 'sb-bg',
      name: 'Sunlit Courtyard Sky',
      role: 'background',
      visible: true,
      opacity: 1,
      imageUrl: bgUrl,
      originalImageUrl: bgUrl,
      depthMapUrl: bgDepth,
      zOffset: -0.09,
      displacementScale: 0.06,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      rotationDeg: 0,
      pitchDeg: 0,
      yawDeg: 0,
      foilWeight: 0.25,
    },
    {
      id: 'sb-char',
      name: 'Ember Lizard Behind Glass',
      role: 'character',
      visible: true,
      opacity: 1,
      imageUrl: charUrl,
      originalImageUrl: charUrl,
      depthMapUrl: charDepth,
      zOffset: -0.01,
      displacementScale: 0.16,
      scale: 0.92,
      offsetX: 0.04,
      offsetY: 0.12,
      rotationDeg: 0,
      pitchDeg: 0,
      yawDeg: 0,
      foilWeight: 0.5,
    },
    {
      id: 'sb-window',
      name: 'Teal Window & Brick Wall',
      role: 'fx',
      visible: true,
      opacity: 1,
      imageUrl: winUrl,
      originalImageUrl: winUrl,
      depthMapUrl: winDepth,
      zOffset: 0.07,
      displacementScale: 0.08,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      rotationDeg: 0,
      pitchDeg: 0,
      yawDeg: 0,
      foilWeight: 0.35,
    },
    {
      id: 'sb-sill',
      name: 'Potted Tulips & Sill Bird',
      role: 'character',
      visible: true,
      opacity: 1,
      imageUrl: sillUrl,
      originalImageUrl: sillUrl,
      depthMapUrl: sillDepth,
      zOffset: 0.15,
      displacementScale: 0.18,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      rotationDeg: 0,
      pitchDeg: 0,
      yawDeg: 0,
      foilWeight: 0.45,
    },
    {
      id: 'sb-fg-garden',
      name: 'Foreground Chair & Blooms',
      role: 'foreground',
      visible: true,
      opacity: 1,
      imageUrl: fgFlowersUrl,
      originalImageUrl: fgFlowersUrl,
      depthMapUrl: fgDepth,
      zOffset: 0.21,
      displacementScale: 0.15,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      rotationDeg: 0,
      pitchDeg: 0,
      yawDeg: 0,
      foilWeight: 0.55,
    },
    {
      id: 'sb-border',
      name: 'Silver Shadowbox Frame',
      role: 'foreground',
      visible: true,
      opacity: 1,
      imageUrl: borderUrl,
      originalImageUrl: borderUrl,
      depthMapUrl: borderDepth,
      zOffset: 0.27,
      displacementScale: 0.04,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      rotationDeg: 0,
      pitchDeg: 0,
      yawDeg: 0,
      foilWeight: 0.9,
    },
  ];

  return {
    id: 'preset-window-shadowbox',
    name: 'Window Garden — Shadowbox',
    artist: 'VCA Shadowbox Series',
    layers,
    foilStyle: 'starlight',
    foilIntensity: 0.65,
    foilSpeed: 0.9,
    particlePreset: 'embers',
    particleIntensity: 0.45,
    lightingPreset: 'gallery_daylight',
    slab: {
      enabled: true,
      title: 'WINDOW GARDEN',
      subtitle: '6-LAYER SHADOWBOX · RELIEF',
      grade: 'VCA 10 GEM MINT',
      serial: '#044 / 100',
      accentColor: '#2DD4BF',
    },
  };
}

/**
 * Preset 1: Geisha Moon — Astral Phantom
 */
async function buildGeishaMoonPreset(): Promise<CardProject> {
  const [bgC, bg] = makeCanvas();
  const sky = bg.createLinearGradient(0, 0, 0, CARD_TEX_H);
  sky.addColorStop(0, '#090B1A');
  sky.addColorStop(0.45, '#191D3A');
  sky.addColorStop(1, '#26183A');
  bg.fillStyle = sky;
  bg.fillRect(0, 0, CARD_TEX_W, CARD_TEX_H);

  for (let i = 0; i < 90; i++) {
    const sx = ((i * 197) % 710) + 20;
    const sy = ((i * 313) % 620) + 30;
    const sr = (i % 3) * 0.8 + 0.6;
    bg.fillStyle = `rgba(226, 232, 255, ${0.3 + (i % 5) * 0.14})`;
    bg.beginPath();
    bg.arc(sx, sy, sr, 0, Math.PI * 2);
    bg.fill();
  }

  const moonGrad = bg.createRadialGradient(375, 360, 40, 375, 360, 265);
  moonGrad.addColorStop(0, '#FFFDF7');
  moonGrad.addColorStop(0.58, '#E8ECFF');
  moonGrad.addColorStop(0.68, 'rgba(165, 180, 252, 0.35)');
  moonGrad.addColorStop(1, 'rgba(25, 29, 58, 0)');
  bg.fillStyle = moonGrad;
  bg.beginPath();
  bg.arc(375, 360, 265, 0, Math.PI * 2);
  bg.fill();

  bg.fillStyle = '#0D1021';
  bg.beginPath();
  bg.moveTo(0, 760);
  bg.quadraticCurveTo(180, 650, 380, 720);
  bg.quadraticCurveTo(560, 620, 750, 740);
  bg.lineTo(750, 1050);
  bg.lineTo(0, 1050);
  bg.closePath();
  bg.fill();

  bg.fillStyle = '#141328';
  bg.fillRect(250, 620, 22, 180);
  bg.fillRect(478, 620, 22, 180);
  bg.fillRect(210, 600, 330, 22);
  bg.fillRect(230, 646, 290, 14);

  const [fxC, fx] = makeCanvas();
  fx.save();
  fx.translate(375, 495);
  for (let r = 0; r < 3; r++) {
    fx.strokeStyle = r === 1 ? 'rgba(232, 121, 249, 0.55)' : 'rgba(139, 92, 246, 0.45)';
    fx.lineWidth = r === 0 ? 6 : 3;
    fx.setLineDash(r === 1 ? [18, 12] : []);
    fx.beginPath();
    fx.arc(0, 0, 210 + r * 36, 0, Math.PI * 2);
    fx.stroke();
  }
  fx.setLineDash([]);
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2 + 0.3;
    const wx = Math.cos(ang) * 235;
    const wy = Math.sin(ang) * 255;
    const wg = fx.createRadialGradient(wx, wy, 4, wx, wy, 56);
    wg.addColorStop(0, 'rgba(244, 114, 182, 0.95)');
    wg.addColorStop(0.45, 'rgba(168, 85, 247, 0.55)');
    wg.addColorStop(1, 'rgba(168, 85, 247, 0)');
    fx.fillStyle = wg;
    fx.beginPath();
    fx.arc(wx, wy, 56, 0, Math.PI * 2);
    fx.fill();
  }
  fx.restore();

  const [chC, ch] = makeCanvas();
  ch.save();
  ch.translate(375, 515);
  const bodyGrad = ch.createLinearGradient(0, -260, 0, 260);
  bodyGrad.addColorStop(0, '#FFFFFF');
  bodyGrad.addColorStop(0.55, '#E2E8F0');
  bodyGrad.addColorStop(1, '#94A3B8');

  ch.shadowColor = 'rgba(192, 132, 252, 0.55)';
  ch.shadowBlur = 24;
  ch.fillStyle = bodyGrad;
  ch.beginPath();
  ch.moveTo(0, -250);
  ch.lineTo(-55, -175);
  ch.lineTo(-145, -225);
  ch.lineTo(-125, -110);
  ch.lineTo(-225, -70);
  ch.lineTo(-165, 20);
  ch.lineTo(-210, 145);
  ch.lineTo(-105, 175);
  ch.lineTo(-55, 240);
  ch.lineTo(0, 195);
  ch.lineTo(55, 240);
  ch.lineTo(105, 175);
  ch.lineTo(210, 145);
  ch.lineTo(165, 20);
  ch.lineTo(225, -70);
  ch.lineTo(125, -110);
  ch.lineTo(145, -225);
  ch.lineTo(55, -175);
  ch.closePath();
  ch.fill();
  ch.shadowBlur = 0;

  ch.fillStyle = '#1E1B4B';
  ch.beginPath();
  ch.moveTo(-135, 45);
  ch.quadraticCurveTo(0, 120, 135, 45);
  ch.lineTo(155, 165);
  ch.quadraticCurveTo(0, 215, -155, 165);
  ch.closePath();
  ch.fill();

  ch.strokeStyle = '#F59E0B';
  ch.lineWidth = 7;
  ch.beginPath();
  ch.moveTo(-130, 58);
  ch.quadraticCurveTo(0, 128, 130, 58);
  ch.stroke();

  const gemG = ch.createRadialGradient(0, -112, 2, 0, -112, 26);
  gemG.addColorStop(0, '#FEF08A');
  gemG.addColorStop(0.6, '#F59E0B');
  gemG.addColorStop(1, '#B45309');
  ch.fillStyle = gemG;
  ch.beginPath();
  ch.ellipse(0, -112, 16, 26, 0, 0, Math.PI * 2);
  ch.fill();

  for (const dir of [-1, 1]) {
    ch.save();
    ch.translate(dir * 64, -44);
    ch.rotate(dir * 0.28);
    ch.fillStyle = '#DC2626';
    ch.beginPath();
    ch.ellipse(0, 0, 38, 20, 0, 0, Math.PI * 2);
    ch.fill();
    ch.fillStyle = '#FEF08A';
    ch.beginPath();
    ch.ellipse(dir * -4, 0, 11, 14, 0, 0, Math.PI * 2);
    ch.fill();
    ch.restore();
  }

  ch.fillStyle = '#312E81';
  ch.beginPath();
  ch.moveTo(-88, 16);
  ch.quadraticCurveTo(0, 78, 88, 16);
  ch.quadraticCurveTo(0, 48, -88, 16);
  ch.closePath();
  ch.fill();
  ch.fillStyle = '#F8FAFC';
  for (let t = -3; t <= 3; t++) {
    ch.fillRect(t * 21 - 8, 28 + Math.abs(t) * 2, 16, 18);
  }
  ch.restore();

  const [dC, dCtx] = makeCanvas(DEPTH_TEX_W, DEPTH_TEX_H);
  dCtx.fillStyle = '#000000';
  dCtx.fillRect(0, 0, DEPTH_TEX_W, DEPTH_TEX_H);
  const sx = DEPTH_TEX_W / CARD_TEX_W;
  const sy = DEPTH_TEX_H / CARD_TEX_H;
  createRadialDepthSpot(dCtx, 375 * sx, 510 * sy, 90, 210);
  createRadialDepthSpot(dCtx, 375 * sx, 465 * sy, 52, 240);

  const [fgC, fg] = makeCanvas();
  drawCardFrameOverlay(fg, {
    borderColor: '#1E1B4B',
    accentColor: '#F59E0B',
    title: 'ASTRAL PHANTOM',
    subtitle: 'GEISHA MOON · SPIRIT REALM',
    hpOrPower: 'PWR 340',
    serial: 'VCA-001 / 025 · FULL ART',
  });

  const bgUrl = bgC.toDataURL('image/png');
  const fxUrl = fxC.toDataURL('image/png');
  const chUrl = chC.toDataURL('image/png');
  const fgUrl = fgC.toDataURL('image/png');

  const [bgDepth, fxDepth, fgDepth] = await Promise.all([
    generateAutoDepthMap(bgUrl, 'background'),
    generateAutoDepthMap(fxUrl, 'fx'),
    generateAutoDepthMap(fgUrl, 'foreground'),
  ]);

  const layers: CardLayer[] = [
    {
      id: 'layer-bg',
      name: 'Moonlit Torii Backdrop',
      role: 'background',
      visible: true,
      opacity: 1,
      imageUrl: bgUrl,
      originalImageUrl: bgUrl,
      depthMapUrl: bgDepth,
      zOffset: -0.08,
      displacementScale: 0.08,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      rotationDeg: 0,
      pitchDeg: 0,
      yawDeg: 0,
      foilWeight: 0.35,
    },
    {
      id: 'layer-fx',
      name: 'Spectral Spirit Aura',
      role: 'fx',
      visible: true,
      opacity: 0.92,
      imageUrl: fxUrl,
      originalImageUrl: fxUrl,
      depthMapUrl: fxDepth,
      zOffset: 0.03,
      displacementScale: 0.1,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      rotationDeg: 0,
      pitchDeg: 0,
      yawDeg: 0,
      foilWeight: 1.0,
    },
    {
      id: 'layer-char',
      name: 'Phantom Spirit Subject',
      role: 'character',
      visible: true,
      opacity: 1,
      imageUrl: chUrl,
      originalImageUrl: chUrl,
      depthMapUrl: dC.toDataURL('image/png'),
      zOffset: 0.13,
      displacementScale: 0.22,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      rotationDeg: 0,
      pitchDeg: 0,
      yawDeg: 0,
      foilWeight: 0.7,
    },
    {
      id: 'layer-fg',
      name: 'Gold Filigree Card Frame',
      role: 'foreground',
      visible: true,
      opacity: 1,
      imageUrl: fgUrl,
      originalImageUrl: fgUrl,
      depthMapUrl: fgDepth,
      zOffset: 0.21,
      displacementScale: 0.05,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      rotationDeg: 0,
      pitchDeg: 0,
      yawDeg: 0,
      foilWeight: 0.85,
    },
  ];

  return {
    id: 'preset-geisha-moon',
    name: 'Geisha Moon — Astral Phantom',
    artist: 'VCA Studio Collection',
    layers,
    foilStyle: 'prism',
    foilIntensity: 0.85,
    foilSpeed: 1.0,
    particlePreset: 'astral_dust',
    particleIntensity: 0.75,
    lightingPreset: 'moonlit_indigo',
    slab: {
      enabled: true,
      title: 'ASTRAL PHANTOM',
      subtitle: 'GEISHA MOON EDITION · 3D RELIEF',
      grade: 'VCA 10 GEM MINT',
      serial: '#001 / 025',
      accentColor: '#F59E0B',
    },
  };
}

/**
 * Preset 2: Volt Wyrm — Stormcaller
 */
async function buildVoltWyrmPreset(): Promise<CardProject> {
  const [bgC, bg] = makeCanvas();
  const sky = bg.createLinearGradient(0, 0, 0, CARD_TEX_H);
  sky.addColorStop(0, '#091526');
  sky.addColorStop(0.5, '#0F2942');
  sky.addColorStop(1, '#090E17');
  bg.fillStyle = sky;
  bg.fillRect(0, 0, CARD_TEX_W, CARD_TEX_H);

  const cg = bg.createRadialGradient(375, 390, 20, 375, 390, 340);
  cg.addColorStop(0, 'rgba(56, 189, 248, 0.48)');
  cg.addColorStop(1, 'rgba(9, 14, 23, 0)');
  bg.fillStyle = cg;
  bg.fillRect(0, 0, CARD_TEX_W, CARD_TEX_H);

  const [fxC, fx] = makeCanvas();
  fx.strokeStyle = '#38BDF8';
  fx.lineWidth = 5;
  fx.shadowColor = '#7DD3FC';
  fx.shadowBlur = 18;
  const bolts = [
    [[110, 180], [210, 300], [170, 340], [310, 480]],
    [[640, 210], [530, 310], [575, 360], [445, 495]],
  ];
  for (const b of bolts) {
    fx.beginPath();
    fx.moveTo(b[0][0], b[0][1]);
    for (let i = 1; i < b.length; i++) fx.lineTo(b[i][0], b[i][1]);
    fx.stroke();
  }
  fx.shadowBlur = 0;

  const [chC, ch] = makeCanvas();
  ch.save();
  ch.translate(375, 485);
  const wingG = ch.createLinearGradient(-260, -140, 260, 140);
  wingG.addColorStop(0, '#0284C7');
  wingG.addColorStop(0.5, '#1E293B');
  wingG.addColorStop(1, '#0284C7');
  ch.fillStyle = wingG;
  for (const dir of [-1, 1]) {
    ch.beginPath();
    ch.moveTo(dir * 45, -20);
    ch.lineTo(dir * 270, -180);
    ch.lineTo(dir * 235, -35);
    ch.lineTo(dir * 260, 45);
    ch.lineTo(dir * 75, 85);
    ch.closePath();
    ch.fill();
  }
  const armorG = ch.createLinearGradient(0, -210, 0, 210);
  armorG.addColorStop(0, '#F8FAFC');
  armorG.addColorStop(0.5, '#64748B');
  armorG.addColorStop(1, '#1E293B');
  ch.fillStyle = armorG;
  ch.beginPath();
  ch.moveTo(0, -180);
  ch.lineTo(105, -60);
  ch.lineTo(72, 185);
  ch.lineTo(-72, 185);
  ch.lineTo(-105, -60);
  ch.closePath();
  ch.fill();
  ch.fillStyle = '#F59E0B';
  for (const dir of [-1, 1]) {
    ch.beginPath();
    ch.moveTo(dir * 28, -145);
    ch.quadraticCurveTo(dir * 115, -265, dir * 145, -230);
    ch.quadraticCurveTo(dir * 95, -185, dir * 48, -125);
    ch.closePath();
    ch.fill();
  }
  ch.restore();

  const [fgC, fg] = makeCanvas();
  drawCardFrameOverlay(fg, {
    borderColor: '#0F172A',
    accentColor: '#38BDF8',
    title: 'VOLT WYRM',
    subtitle: 'STORMCALLER · APEX EDITION',
    hpOrPower: 'PWR 380',
    serial: 'VCA-014 / 025 · PRISM HOLO',
  });

  const bgUrl = bgC.toDataURL('image/png');
  const fxUrl = fxC.toDataURL('image/png');
  const chUrl = chC.toDataURL('image/png');
  const fgUrl = fgC.toDataURL('image/png');

  const [bgDepth, fxDepth, chDepth, fgDepth] = await Promise.all([
    generateAutoDepthMap(bgUrl, 'background'),
    generateAutoDepthMap(fxUrl, 'fx'),
    generateAutoDepthMap(chUrl, 'character'),
    generateAutoDepthMap(fgUrl, 'foreground'),
  ]);

  return {
    id: 'preset-volt-wyrm',
    name: 'Volt Wyrm — Stormcaller',
    artist: 'VCA Studio Collection',
    layers: [
      {
        id: 'vw-bg',
        name: 'Storm Peaks Sky',
        role: 'background',
        visible: true,
        opacity: 1,
        imageUrl: bgUrl,
        originalImageUrl: bgUrl,
        depthMapUrl: bgDepth,
        zOffset: -0.08,
        displacementScale: 0.08,
        scale: 1,
        offsetX: 0,
        offsetY: 0,
        rotationDeg: 0,
        pitchDeg: 0,
        yawDeg: 0,
        foilWeight: 0.3,
      },
      {
        id: 'vw-fx',
        name: 'Arc Lightning Field',
        role: 'fx',
        visible: true,
        opacity: 0.95,
        imageUrl: fxUrl,
        originalImageUrl: fxUrl,
        depthMapUrl: fxDepth,
        zOffset: 0.04,
        displacementScale: 0.1,
        scale: 1,
        offsetX: 0,
        offsetY: 0,
        rotationDeg: 0,
        pitchDeg: 0,
        yawDeg: 0,
        foilWeight: 1,
      },
      {
        id: 'vw-char',
        name: 'Armored Storm Wyrm',
        role: 'character',
        visible: true,
        opacity: 1,
        imageUrl: chUrl,
        originalImageUrl: chUrl,
        depthMapUrl: chDepth,
        zOffset: 0.14,
        displacementScale: 0.24,
        scale: 1,
        offsetX: 0,
        offsetY: 0,
        rotationDeg: 0,
        pitchDeg: 0,
        yawDeg: 0,
        foilWeight: 0.75,
      },
      {
        id: 'vw-fg',
        name: 'Titanium Frame',
        role: 'foreground',
        visible: true,
        opacity: 1,
        imageUrl: fgUrl,
        originalImageUrl: fgUrl,
        depthMapUrl: fgDepth,
        zOffset: 0.22,
        displacementScale: 0.05,
        scale: 1,
        offsetX: 0,
        offsetY: 0,
        rotationDeg: 0,
        pitchDeg: 0,
        yawDeg: 0,
        foilWeight: 0.9,
      },
    ],
    foilStyle: 'cracked_ice',
    foilIntensity: 0.85,
    foilSpeed: 1.15,
    particlePreset: 'lightning',
    particleIntensity: 0.8,
    lightingPreset: 'studio_gold',
    slab: {
      enabled: true,
      title: 'VOLT WYRM',
      subtitle: 'STORMCALLER · CRACKED ICE FOIL',
      grade: 'VCA 10 GEM MINT',
      serial: '#014 / 025',
      accentColor: '#38BDF8',
    },
  };
}

/**
 * Preset 3: Ember Kitsune — Crimson Shrine
 */
async function buildKitsunePreset(): Promise<CardProject> {
  const [bgC, bg] = makeCanvas();
  const sky = bg.createLinearGradient(0, 0, 0, CARD_TEX_H);
  sky.addColorStop(0, '#1B0A10');
  sky.addColorStop(0.55, '#450A0A');
  sky.addColorStop(1, '#12080A');
  bg.fillStyle = sky;
  bg.fillRect(0, 0, CARD_TEX_W, CARD_TEX_H);

  const [fxC, fx] = makeCanvas();
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const x = 375 + Math.cos(angle) * 215;
    const y = 490 + Math.sin(angle) * 225;
    const fg = fx.createRadialGradient(x, y, 6, x, y, 72);
    fg.addColorStop(0, '#FEF08A');
    fg.addColorStop(0.45, 'rgba(249, 115, 22, 0.72)');
    fg.addColorStop(1, 'rgba(239, 68, 68, 0)');
    fx.fillStyle = fg;
    fx.beginPath();
    fx.arc(x, y, 72, 0, Math.PI * 2);
    fx.fill();
  }

  const [chC, ch] = makeCanvas();
  ch.save();
  ch.translate(375, 510);
  for (let t = -3; t <= 3; t++) {
    ch.save();
    ch.rotate(t * 0.28);
    const tg = ch.createLinearGradient(0, 0, 0, -245);
    tg.addColorStop(0, '#DC2626');
    tg.addColorStop(0.7, '#F97316');
    tg.addColorStop(1, '#FEF08A');
    ch.fillStyle = tg;
    ch.beginPath();
    ch.moveTo(0, 40);
    ch.quadraticCurveTo(-50, -110, 0, -255);
    ch.quadraticCurveTo(50, -110, 0, 40);
    ch.fill();
    ch.restore();
  }
  ch.fillStyle = '#FFFBEB';
  ch.beginPath();
  ch.moveTo(0, -140);
  ch.lineTo(-92, -62);
  ch.lineTo(-75, 62);
  ch.lineTo(0, 125);
  ch.lineTo(75, 62);
  ch.lineTo(92, -62);
  ch.closePath();
  ch.fill();
  ch.restore();

  const [fgC, fg] = makeCanvas();
  drawCardFrameOverlay(fg, {
    borderColor: '#290C0C',
    accentColor: '#F59E0B',
    title: 'EMBER KITSUNE',
    subtitle: 'SOLAR SHRINE · MYTHIC GOLD',
    hpOrPower: 'PWR 360',
    serial: 'VCA-009 / 025 · ETCHED GOLD',
  });

  const bgUrl = bgC.toDataURL('image/png');
  const fxUrl = fxC.toDataURL('image/png');
  const chUrl = chC.toDataURL('image/png');
  const fgUrl = fgC.toDataURL('image/png');

  const [bgDepth, fxDepth, chDepth, fgDepth] = await Promise.all([
    generateAutoDepthMap(bgUrl, 'background'),
    generateAutoDepthMap(fxUrl, 'fx'),
    generateAutoDepthMap(chUrl, 'character'),
    generateAutoDepthMap(fgUrl, 'foreground'),
  ]);

  return {
    id: 'preset-ember-kitsune',
    name: 'Ember Kitsune — Crimson Shrine',
    artist: 'VCA Studio Collection',
    layers: [
      {
        id: 'ek-bg',
        name: 'Crimson Solar Backdrop',
        role: 'background',
        visible: true,
        opacity: 1,
        imageUrl: bgUrl,
        originalImageUrl: bgUrl,
        depthMapUrl: bgDepth,
        zOffset: -0.08,
        displacementScale: 0.08,
        scale: 1,
        offsetX: 0,
        offsetY: 0,
        rotationDeg: 0,
        pitchDeg: 0,
        yawDeg: 0,
        foilWeight: 0.35,
      },
      {
        id: 'ek-fx',
        name: 'Solar Flame Orbs',
        role: 'fx',
        visible: true,
        opacity: 0.92,
        imageUrl: fxUrl,
        originalImageUrl: fxUrl,
        depthMapUrl: fxDepth,
        zOffset: 0.04,
        displacementScale: 0.1,
        scale: 1,
        offsetX: 0,
        offsetY: 0,
        rotationDeg: 0,
        pitchDeg: 0,
        yawDeg: 0,
        foilWeight: 1,
      },
      {
        id: 'ek-char',
        name: 'Kitsune Mask Spirit',
        role: 'character',
        visible: true,
        opacity: 1,
        imageUrl: chUrl,
        originalImageUrl: chUrl,
        depthMapUrl: chDepth,
        zOffset: 0.14,
        displacementScale: 0.22,
        scale: 1,
        offsetX: 0,
        offsetY: 0,
        rotationDeg: 0,
        pitchDeg: 0,
        yawDeg: 0,
        foilWeight: 0.7,
      },
      {
        id: 'ek-fg',
        name: 'Lacquered Gold Frame',
        role: 'foreground',
        visible: true,
        opacity: 1,
        imageUrl: fgUrl,
        originalImageUrl: fgUrl,
        depthMapUrl: fgDepth,
        zOffset: 0.22,
        displacementScale: 0.05,
        scale: 1,
        offsetX: 0,
        offsetY: 0,
        rotationDeg: 0,
        pitchDeg: 0,
        yawDeg: 0,
        foilWeight: 0.9,
      },
    ],
    foilStyle: 'etched_gold',
    foilIntensity: 0.9,
    foilSpeed: 1.0,
    particlePreset: 'embers',
    particleIntensity: 0.85,
    lightingPreset: 'crimson_forge',
    slab: {
      enabled: true,
      title: 'EMBER KITSUNE',
      subtitle: 'CRIMSON SHRINE · ETCHED GOLD',
      grade: 'VCA 10 GEM MINT',
      serial: '#009 / 025',
      accentColor: '#F97316',
    },
  };
}

export interface PresetDescriptor {
  id: string;
  label: string;
  build: () => Promise<CardProject>;
}

export const PRESET_DECKS: PresetDescriptor[] = [
  { id: 'preset-window-shadowbox', label: 'Window Shadowbox', build: buildWindowShadowboxPreset },
  { id: 'preset-geisha-moon', label: 'Astral Phantom', build: buildGeishaMoonPreset },
  { id: 'preset-volt-wyrm', label: 'Volt Wyrm', build: buildVoltWyrmPreset },
  { id: 'preset-ember-kitsune', label: 'Ember Kitsune', build: buildKitsunePreset },
];
