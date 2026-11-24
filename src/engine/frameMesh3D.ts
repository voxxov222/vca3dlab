import * as THREE from 'three';
import type { FrameConfig } from '../types/card';
import {
  getCardDimensionsForProportion,
  renderVcaFramePng,
} from '../utils/frameGenerator';

export interface FrameAssembly3D {
  group: THREE.Group;
  update: (config: FrameConfig, maxAniso: number) => void;
  dispose: () => void;
}

function makeRoundedShape(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  const rad = Math.max(0.01, Math.min(r, w / 2 - 0.01, h / 2 - 0.01));
  s.moveTo(x + rad, y);
  s.lineTo(x + w - rad, y);
  s.quadraticCurveTo(x + w, y, x + w, y + rad);
  s.lineTo(x + w, y + h - rad);
  s.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  s.lineTo(x + rad, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - rad);
  s.lineTo(x, y + rad);
  s.quadraticCurveTo(x, y, x + rad, y);
  return s;
}

function makeBezelFrameShape(
  outerW: number,
  outerH: number,
  outerR: number,
  innerW: number,
  innerH: number,
  innerR: number
): THREE.Shape {
  const shape = makeRoundedShape(outerW, outerH, outerR);
  const hole = new THREE.Path();
  const ix = -innerW / 2;
  const iy = -innerH / 2;
  const ir = Math.max(0.01, Math.min(innerR, innerW / 2 - 0.01, innerH / 2 - 0.01));
  hole.moveTo(ix + ir, iy);
  hole.lineTo(ix + innerW - ir, iy);
  hole.quadraticCurveTo(ix + innerW, iy, ix + innerW, iy + ir);
  hole.lineTo(ix + innerW, iy + innerH - ir);
  hole.quadraticCurveTo(ix + innerW, iy + innerH, ix + innerW - ir, iy + innerH);
  hole.lineTo(ix + ir, iy + innerH);
  hole.quadraticCurveTo(ix, iy + innerH, ix, iy + innerH - ir);
  hole.lineTo(ix, iy + ir);
  hole.quadraticCurveTo(ix, iy, ix + ir, iy);
  shape.holes.push(hole);
  return shape;
}

export function createFrameAssembly3D(
  initialConfig: FrameConfig,
  maxAniso: number
): FrameAssembly3D {
  const group = new THREE.Group();
  let disposables: Array<{ dispose: () => void }> = [];
  let lastKey = '';

  const rebuild = (config: FrameConfig, aniso: number) => {
    const nextKey = JSON.stringify(config);
    if (nextKey === lastKey) return;
    lastKey = nextKey;

    group.visible = config.enabled;
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }
    disposables.forEach((d) => d.dispose());
    disposables = [];

    if (!config.enabled) return;

    const { width, height } = getCardDimensionsForProportion(config.proportion);
    const borderWorld = (config.borderThickness / 300) * 0.85;
    const cornerWorld = Math.max(0.02, (config.cornerRadius / 300) * 0.9);
    const depth = Math.max(0.01, config.frameDepth);

    // 1. Extruded 3D Beveled Frame Bezel
    const bezelShape = makeBezelFrameShape(
      width + 0.02,
      height + 0.02,
      cornerWorld,
      Math.max(0.6, width - borderWorld * 2),
      Math.max(0.8, height - borderWorld * 2),
      Math.max(0.015, cornerWorld - borderWorld * 0.45)
    );
    const bezelGeo = new THREE.ExtrudeGeometry(bezelShape, {
      depth,
      bevelEnabled: true,
      bevelThickness: Math.min(0.018, depth * 0.35),
      bevelSize: 0.015,
      bevelSegments: 2,
      curveSegments: 14,
    });
    bezelGeo.center();
    disposables.push(bezelGeo);

    const isHolo = config.materialFinish === 'holo' || config.holoIntensity > 0.55;
    const bezelMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(config.borderColor || '#1e293b'),
      metalness:
        config.materialFinish === 'obsidian'
          ? 0.25
          : Math.min(0.96, config.metallicIntensity),
      roughness:
        config.materialFinish === 'matte'
          ? 0.72
          : config.materialFinish === 'obsidian'
            ? 0.42
            : 0.18,
      clearcoat: config.materialFinish === 'matte' ? 0.15 : 0.95,
      iridescence: isHolo ? Math.min(1, 0.35 + config.holoIntensity * 0.65) : 0,
      iridescenceIOR: 1.45,
      emissive:
        config.materialFinish === 'neon'
          ? new THREE.Color(config.accentColor || '#22d3ee')
          : new THREE.Color(0x000000),
      emissiveIntensity: config.materialFinish === 'neon' ? 0.35 : 0,
    });
    disposables.push(bezelMat);

    const bezelMesh = new THREE.Mesh(bezelGeo, bezelMat);
    bezelMesh.position.z = 0.25;
    bezelMesh.renderOrder = 10;
    group.add(bezelMesh);

    // 2. Transparent PNG Frame + Title/Footer Plates Overlay
    const pngUrl = renderVcaFramePng(config);
    const img = new Image();
    img.src = pngUrl;
    const tex = new THREE.Texture(img);
    img.onload = () => {
      tex.needsUpdate = true;
    };
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = aniso;
    disposables.push(tex);

    const overlayGeo = new THREE.PlaneGeometry(width, height);
    const overlayMat = new THREE.MeshPhysicalMaterial({
      map: tex,
      transparent: true,
      alphaTest: 0.02,
      roughness: 0.22,
      metalness: config.metallicIntensity * 0.5,
      iridescence: config.holoIntensity * 0.85,
      clearcoat: 0.8,
      side: THREE.DoubleSide,
    });
    disposables.push(overlayGeo, overlayMat);

    const overlayMesh = new THREE.Mesh(overlayGeo, overlayMat);
    overlayMesh.position.z = 0.25 + depth * 0.52 + 0.015;
    overlayMesh.renderOrder = 11;
    group.add(overlayMesh);
  };

  rebuild(initialConfig, maxAniso);

  return {
    group,
    update: rebuild,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
      disposables = [];
    },
  };
}
