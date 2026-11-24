import * as THREE from 'three';
import type { SlabConfig } from '../types/card';

function createRoundedRectShape(width: number, height: number, radius: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;
  s.moveTo(x + radius, y);
  s.lineTo(x + width - radius, y);
  s.quadraticCurveTo(x + width, y, x + width, y + radius);
  s.lineTo(x + width, y + height - radius);
  s.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  s.lineTo(x + radius, y + height);
  s.quadraticCurveTo(x, y + height, x, y + height - radius);
  s.lineTo(x, y + radius);
  s.quadraticCurveTo(x, y, x + radius, y);
  return s;
}

function createRoundedRectFrameShape(
  outerW: number,
  outerH: number,
  outerR: number,
  innerW: number,
  innerH: number,
  innerR: number
): THREE.Shape {
  const shape = createRoundedRectShape(outerW, outerH, outerR);
  const hole = new THREE.Path();
  const ix = -innerW / 2;
  const iy = -innerH / 2;
  hole.moveTo(ix + innerR, iy);
  hole.lineTo(ix + innerW - innerR, iy);
  hole.quadraticCurveTo(ix + innerW, iy, ix + innerW, iy + innerR);
  hole.lineTo(ix + innerW, iy + innerH - innerR);
  hole.quadraticCurveTo(ix + innerW, iy + innerH, ix + innerW - innerR, iy + innerH);
  hole.lineTo(ix + innerR, iy + innerH);
  hole.quadraticCurveTo(ix, iy + innerH, ix, iy + innerH - innerR);
  hole.lineTo(ix, iy + innerR);
  hole.quadraticCurveTo(ix, iy, ix + innerR, iy);
  shape.holes.push(hole);
  return shape;
}

export function createCardBackTexture(maxAniso: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 716;
  const ctx = c.getContext('2d')!;

  const bg = ctx.createLinearGradient(0, 0, 512, 716);
  bg.addColorStop(0, '#0F172A');
  bg.addColorStop(0.5, '#1E1B4B');
  bg.addColorStop(1, '#0B0F19');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 716);

  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 10;
  ctx.strokeRect(22, 22, 468, 672);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
  ctx.strokeRect(36, 36, 440, 644);

  // Geometric mandala rings
  ctx.save();
  ctx.translate(256, 358);
  for (let r = 0; r < 3; r++) {
    ctx.strokeStyle = r === 1 ? 'rgba(245, 158, 11, 0.7)' : 'rgba(148, 163, 184, 0.3)';
    ctx.lineWidth = r === 1 ? 3 : 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 95 + r * 36, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#F59E0B';
  ctx.font = '700 44px Outfit, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('VCA', 0, -10);
  ctx.fillStyle = '#E2E8F0';
  ctx.font = '600 14px "JetBrains Mono", monospace';
  ctx.fillText('COLLECTOR EDITION', 0, 26);
  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

export function createSlabLabelTexture(
  config: SlabConfig,
  maxAniso: number
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 768;
  c.height = 192;
  const ctx = c.getContext('2d')!;

  // Brushed dark titanium plate
  const g = ctx.createLinearGradient(0, 0, 768, 192);
  g.addColorStop(0, '#0F131D');
  g.addColorStop(0.5, '#192030');
  g.addColorStop(1, '#0C1018');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 768, 192);

  // Hairline metallic border
  ctx.strokeStyle = config.accentColor || '#F59E0B';
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, 752, 176);

  // Left VCA Seal Box
  ctx.fillStyle = config.accentColor || '#F59E0B';
  ctx.fillRect(24, 24, 112, 144);
  ctx.fillStyle = '#090D16';
  ctx.font = '700 34px Outfit, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('VCA', 80, 82);
  ctx.font = '600 15px "JetBrains Mono", monospace';
  ctx.fillText('SLAB LAB', 80, 112);
  ctx.font = '600 13px "JetBrains Mono", monospace';
  ctx.fillText('NFC READY', 80, 144);

  // Center Title & Subtitle
  ctx.textAlign = 'left';
  ctx.fillStyle = '#F8FAFC';
  ctx.font = '700 34px Outfit, sans-serif';
  ctx.fillText((config.title || 'UNTITLED CARD').slice(0, 22), 162, 74);

  ctx.fillStyle = '#CBD5E1';
  ctx.font = '500 20px "DM Sans", sans-serif';
  ctx.fillText((config.subtitle || '3D COLLECTIBLE EDITION').slice(0, 34), 162, 112);

  ctx.fillStyle = config.accentColor || '#F59E0B';
  ctx.font = '600 18px "JetBrains Mono", monospace';
  ctx.fillText(config.serial || '#001 / 025', 162, 150);

  // Right Grade Box
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(584, 24, 158, 144);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 2;
  ctx.strokeRect(584, 24, 158, 144);

  const gradeParts = (config.grade || 'VCA 10').split(' ');
  const mainNum = gradeParts.find((p) => /\d/.test(p)) || '10';
  ctx.fillStyle = config.accentColor || '#F59E0B';
  ctx.textAlign = 'center';
  ctx.font = '700 54px Outfit, sans-serif';
  ctx.fillText(mainNum, 663, 98);

  ctx.fillStyle = '#F1F5F9';
  ctx.font = '600 16px "JetBrains Mono", monospace';
  ctx.fillText(
    gradeParts.filter((p) => p !== mainNum).join(' ').slice(0, 14) || 'GEM MINT',
    663,
    144
  );

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

export interface SlabAssembly {
  group: THREE.Group;
  labelMesh: THREE.Mesh;
  bezelMat: THREE.MeshStandardMaterial;
  sealMat: THREE.MeshPhysicalMaterial;
  updateLabel: (config: SlabConfig, maxAniso: number) => void;
  dispose: () => void;
}

/**
 * Builds an 8-part composite 3D VCA Graded Collector Slab Group:
 * 1. Outer beveled acrylic shell frame
 * 2. Frosted inner perimeter gasket
 * 3. Top header chamber housing
 * 4. Metallic anodized bezel trim around header
 * 5. Engraved VCA Grade Label Plate
 * 6. Rear crystal acrylic backing plate
 * 7. Corner ultrasonic weld pins (4 instances)
 * 8. Corner Holographic NFC Security Seal
 */
export function buildVcaSlabAssembly(
  initialConfig: SlabConfig,
  isSoftwareGl: boolean,
  maxAniso: number
): SlabAssembly {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  const slabW = 3.04;
  const slabH = 4.66;
  const cardWindowW = 2.58;
  const cardWindowH = 3.58;

  // 1. Outer beveled crystal acrylic perimeter shell
  const outerFrameShape = createRoundedRectFrameShape(
    slabW,
    slabH,
    0.16,
    cardWindowW,
    cardWindowH,
    0.08
  );
  // Shift card window slightly downward to make room for the top header label!
  const shellGeo = new THREE.ExtrudeGeometry(outerFrameShape, {
    depth: 0.24,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.025,
    bevelSegments: 3,
    curveSegments: 16,
  });
  shellGeo.center();
  // Offset the card window hole visually via translating the shell up slightly relative to card center (0,0,0)
  shellGeo.translate(0, 0.28, 0.04);
  disposables.push(shellGeo);

  const acrylicMat = new THREE.MeshPhysicalMaterial({
    color: 0xe2ecff,
    metalness: 0.05,
    roughness: 0.08,
    transmission: isSoftwareGl ? 0 : 0.84,
    transparent: true,
    opacity: isSoftwareGl ? 0.34 : 0.92,
    ior: 1.49,
    thickness: 0.28,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    depthWrite: false,
  });
  disposables.push(acrylicMat);

  const shellMesh = new THREE.Mesh(shellGeo, acrylicMat);
  shellMesh.renderOrder = 12;
  group.add(shellMesh);

  // 2. Frosted inner perimeter gasket ring around the card well
  const gasketShape = createRoundedRectFrameShape(
    cardWindowW + 0.08,
    cardWindowH + 0.08,
    0.1,
    cardWindowW - 0.02,
    cardWindowH - 0.02,
    0.06
  );
  const gasketGeo = new THREE.ExtrudeGeometry(gasketShape, {
    depth: 0.14,
    bevelEnabled: false,
    curveSegments: 12,
  });
  gasketGeo.center();
  gasketGeo.translate(0, 0, -0.02);
  disposables.push(gasketGeo);

  const gasketMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.45,
    metalness: 0.35,
  });
  disposables.push(gasketMat);
  const gasketMesh = new THREE.Mesh(gasketGeo, gasketMat);
  group.add(gasketMesh);

  // 3. Top Header Chamber Housing (dark obsidian chassis behind label)
  const headerBackingGeo = new THREE.BoxGeometry(2.64, 0.72, 0.16);
  disposables.push(headerBackingGeo);
  const headerBackingMat = new THREE.MeshStandardMaterial({
    color: 0x0b0f18,
    roughness: 0.4,
    metalness: 0.6,
  });
  disposables.push(headerBackingMat);
  const headerBacking = new THREE.Mesh(headerBackingGeo, headerBackingMat);
  headerBacking.position.set(0, 2.14, 0.02);
  group.add(headerBacking);

  // 4. Metallic Anodized Bezel Trim around header
  const bezelShape = createRoundedRectFrameShape(2.7, 0.78, 0.06, 2.56, 0.64, 0.04);
  const bezelGeo = new THREE.ExtrudeGeometry(bezelShape, {
    depth: 0.04,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.01,
    bevelSegments: 2,
  });
  bezelGeo.center();
  disposables.push(bezelGeo);
  const bezelMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(initialConfig.accentColor || '#F59E0B'),
    metalness: 0.85,
    roughness: 0.22,
  });
  disposables.push(bezelMat);
  const bezelMesh = new THREE.Mesh(bezelGeo, bezelMat);
  bezelMesh.position.set(0, 2.14, 0.11);
  group.add(bezelMesh);

  // 5. Engraved VCA Grade Label Plate
  let labelTex = createSlabLabelTexture(initialConfig, maxAniso);
  const labelGeo = new THREE.PlaneGeometry(2.54, 0.62);
  disposables.push(labelGeo);
  const labelMat = new THREE.MeshStandardMaterial({
    map: labelTex,
    roughness: 0.28,
    metalness: 0.35,
  });
  disposables.push(labelMat);
  const labelMesh = new THREE.Mesh(labelGeo, labelMat);
  labelMesh.position.set(0, 2.14, 0.125);
  group.add(labelMesh);

  // 6. Rear Acrylic Backplate (behind card layers)
  const backShape = createRoundedRectShape(slabW - 0.06, slabH - 0.06, 0.14);
  const backGeo = new THREE.ExtrudeGeometry(backShape, {
    depth: 0.04,
    bevelEnabled: false,
    curveSegments: 14,
  });
  backGeo.center();
  backGeo.translate(0, 0.28, -0.15);
  disposables.push(backGeo);
  const backMat = new THREE.MeshPhysicalMaterial({
    color: 0x0f172a,
    roughness: 0.14,
    metalness: 0.2,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
  });
  disposables.push(backMat);
  const backPlate = new THREE.Mesh(backGeo, backMat);
  group.add(backPlate);

  // 7. Four Corner Ultrasonic Rivet Pins (InstancedMesh)
  const pinGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.28, 12);
  pinGeo.rotateX(Math.PI / 2);
  disposables.push(pinGeo);
  const pinMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    metalness: 0.9,
    roughness: 0.2,
  });
  disposables.push(pinMat);
  const pins = new THREE.InstancedMesh(pinGeo, pinMat, 4);
  const dummy = new THREE.Object3D();
  const pinCoords = [
    [-1.36, 2.45],
    [1.36, 2.45],
    [-1.36, -1.89],
    [1.36, -1.89],
  ];
  pinCoords.forEach(([px, py], i) => {
    dummy.position.set(px, py, 0.03);
    dummy.updateMatrix();
    pins.setMatrixAt(i, dummy.matrix);
  });
  pins.instanceMatrix.needsUpdate = true;
  pins.computeBoundingSphere();
  group.add(pins);

  // 8. Corner Holographic VCA Security Seal
  const sealGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.015, 24);
  sealGeo.rotateX(Math.PI / 2);
  disposables.push(sealGeo);
  const sealMat = new THREE.MeshPhysicalMaterial({
    color: 0xfde68a,
    metalness: 0.92,
    roughness: 0.12,
    iridescence: 1.0,
    iridescenceIOR: 1.4,
    clearcoat: 1.0,
  });
  disposables.push(sealMat);
  const sealMesh = new THREE.Mesh(sealGeo, sealMat);
  sealMesh.position.set(1.24, -1.78, 0.18);
  group.add(sealMesh);

  return {
    group,
    labelMesh,
    bezelMat,
    sealMat,
    updateLabel: (config: SlabConfig, aniso: number) => {
      const nextTex = createSlabLabelTexture(config, aniso);
      labelMat.map = nextTex;
      labelMat.needsUpdate = true;
      labelTex.dispose();
      labelTex = nextTex;
      bezelMat.color.set(config.accentColor || '#F59E0B');
    },
    dispose: () => {
      labelTex.dispose();
      disposables.forEach((d) => d.dispose());
    },
  };
}
