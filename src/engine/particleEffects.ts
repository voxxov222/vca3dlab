import * as THREE from 'three';
import type { ParticlePreset } from '../types/card';

function createSoftParticleTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.75)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class CardParticleSystem {
  public readonly group = new THREE.Group();
  private preset: ParticlePreset = 'none';
  private intensity = 0.75;

  private readonly count = 140;
  private readonly positions = new Float32Array(this.count * 3);
  private readonly velocities = new Float32Array(this.count * 3);
  private readonly seeds = new Float32Array(this.count);
  private readonly colors = new Float32Array(this.count * 3);

  private pointsGeo: THREE.BufferGeometry;
  private pointsMat: THREE.PointsMaterial;
  private pointsMesh: THREE.Points;
  private particleTex: THREE.CanvasTexture;

  // Jagged 3D lightning arcs around card perimeter
  private readonly boltCount = 4;
  private readonly boltSegs = 12;
  private boltPositions: Float32Array;
  private boltGeo: THREE.BufferGeometry;
  private boltMat: THREE.LineBasicMaterial;
  private boltMesh: THREE.LineSegments;
  private boltTimer = 0;

  constructor() {
    this.particleTex = createSoftParticleTexture();

    this.pointsGeo = new THREE.BufferGeometry();
    this.pointsGeo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.pointsGeo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    this.pointsMat = new THREE.PointsMaterial({
      size: 0.14,
      map: this.particleTex,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      sizeAttenuation: true,
    });

    this.pointsMesh = new THREE.Points(this.pointsGeo, this.pointsMat);
    this.pointsMesh.frustumCulled = false;
    this.group.add(this.pointsMesh);

    this.boltPositions = new Float32Array(this.boltCount * this.boltSegs * 2 * 3);
    this.boltGeo = new THREE.BufferGeometry();
    this.boltGeo.setAttribute('position', new THREE.BufferAttribute(this.boltPositions, 3));
    this.boltMat = new THREE.LineBasicMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.boltMesh = new THREE.LineSegments(this.boltGeo, this.boltMat);
    this.boltMesh.visible = false;
    this.boltMesh.frustumCulled = false;
    this.group.add(this.boltMesh);

    this.seedParticles('astral_dust');
  }

  public setConfig(preset: ParticlePreset, intensity: number): void {
    const presetChanged = this.preset !== preset;
    this.preset = preset;
    this.intensity = intensity;
    this.group.visible = preset !== 'none' && intensity > 0.01;
    this.boltMesh.visible = preset === 'lightning';

    if (presetChanged) {
      this.seedParticles(preset);
    }
    this.pointsMat.opacity = Math.min(1, 0.3 + intensity * 0.7);
    this.pointsMat.size = preset === 'sakura_wisps' ? 0.18 : 0.13;
  }

  private seedParticles(preset: ParticlePreset): void {
    const tmpColor = new THREE.Color();
    for (let i = 0; i < this.count; i++) {
      this.seeds[i] = Math.random() * 100;
      this.positions[i * 3] = (Math.random() - 0.5) * 3.4;
      this.positions[i * 3 + 1] = (Math.random() - 0.5) * 4.4;
      this.positions[i * 3 + 2] = (Math.random() - 0.5) * 0.9 + 0.15;

      if (preset === 'embers') {
        this.velocities[i * 3] = (Math.random() - 0.5) * 0.25;
        this.velocities[i * 3 + 1] = 0.65 + Math.random() * 1.1;
        this.velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.2;
        tmpColor.setHSL(0.03 + Math.random() * 0.08, 0.98, 0.55 + Math.random() * 0.2);
      } else if (preset === 'lightning') {
        this.velocities[i * 3] = (Math.random() - 0.5) * 1.4;
        this.velocities[i * 3 + 1] = (Math.random() - 0.5) * 1.4;
        this.velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
        tmpColor.setHSL(0.54 + Math.random() * 0.08, 0.95, 0.7);
      } else if (preset === 'sakura_wisps') {
        this.velocities[i * 3] = 0.22 + Math.random() * 0.25;
        this.velocities[i * 3 + 1] = -0.35 - Math.random() * 0.3;
        this.velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.18;
        tmpColor.setHSL(0.9 + Math.random() * 0.08, 0.82, 0.76);
      } else {
        // astral_dust
        this.velocities[i * 3] = (Math.random() - 0.5) * 0.2;
        this.velocities[i * 3 + 1] = 0.15 + Math.random() * 0.32;
        this.velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.2;
        tmpColor.setHSL(0.72 + Math.random() * 0.15, 0.85, 0.72);
      }

      this.colors[i * 3] = tmpColor.r;
      this.colors[i * 3 + 1] = tmpColor.g;
      this.colors[i * 3 + 2] = tmpColor.b;
    }
    this.pointsGeo.attributes.position.needsUpdate = true;
    this.pointsGeo.attributes.color.needsUpdate = true;
  }

  private regenerateBolts(): void {
    let ptr = 0;
    for (let b = 0; b < this.boltCount; b++) {
      const side = b % 4;
      let sx = 0;
      let sy = 0;
      let ex = 0;
      let ey = 0;
      if (side === 0) {
        sx = -1.35;
        sy = -1.2 + Math.random() * 2.4;
        ex = -0.6 + Math.random() * 0.5;
        ey = sy + (Math.random() - 0.5) * 1.4;
      } else if (side === 1) {
        sx = 1.35;
        sy = -1.2 + Math.random() * 2.4;
        ex = 0.6 - Math.random() * 0.5;
        ey = sy + (Math.random() - 0.5) * 1.4;
      } else if (side === 2) {
        sx = -1.0 + Math.random() * 2.0;
        sy = 1.85;
        ex = sx + (Math.random() - 0.5) * 1.0;
        ey = 0.5 + Math.random() * 0.6;
      } else {
        sx = -1.0 + Math.random() * 2.0;
        sy = -1.85;
        ex = sx + (Math.random() - 0.5) * 1.0;
        ey = -0.5 - Math.random() * 0.6;
      }
      const sz = 0.12 + Math.random() * 0.26;
      const ez = 0.2 + Math.random() * 0.25;

      let prevX = sx;
      let prevY = sy;
      let prevZ = sz;

      for (let s = 1; s <= this.boltSegs; s++) {
        const t = s / this.boltSegs;
        const jitter = Math.sin(t * Math.PI) * 0.22;
        const nx = THREE.MathUtils.lerp(sx, ex, t) + (Math.random() - 0.5) * jitter;
        const ny = THREE.MathUtils.lerp(sy, ey, t) + (Math.random() - 0.5) * jitter;
        const nz = THREE.MathUtils.lerp(sz, ez, t) + (Math.random() - 0.5) * jitter * 0.5;

        this.boltPositions[ptr++] = prevX;
        this.boltPositions[ptr++] = prevY;
        this.boltPositions[ptr++] = prevZ;
        this.boltPositions[ptr++] = nx;
        this.boltPositions[ptr++] = ny;
        this.boltPositions[ptr++] = nz;

        prevX = nx;
        prevY = ny;
        prevZ = nz;
      }
    }
    this.boltGeo.attributes.position.needsUpdate = true;
  }

  public update(delta: number, elapsed: number): void {
    if (!this.group.visible) return;
    const speedScale = 0.55 + this.intensity * 0.85;

    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3;
      const seed = this.seeds[i];
      const swirl = Math.sin(elapsed * 2.1 + seed) * 0.35;

      this.positions[i3] += (this.velocities[i3] + swirl * 0.4) * delta * speedScale;
      this.positions[i3 + 1] += this.velocities[i3 + 1] * delta * speedScale;
      this.positions[i3 + 2] += this.velocities[i3 + 2] * delta * speedScale;

      if (this.positions[i3 + 1] > 2.35) {
        this.positions[i3 + 1] = -2.2;
        this.positions[i3] = (Math.random() - 0.5) * 3.1;
      } else if (this.positions[i3 + 1] < -2.35) {
        this.positions[i3 + 1] = 2.2;
        this.positions[i3] = (Math.random() - 0.5) * 3.1;
      }

      if (Math.abs(this.positions[i3]) > 2.1) {
        this.positions[i3] = -Math.sign(this.positions[i3]) * 1.8;
      }
      if (this.positions[i3 + 2] > 0.9 || this.positions[i3 + 2] < -0.5) {
        this.positions[i3 + 2] = 0.2;
      }
    }
    this.pointsGeo.attributes.position.needsUpdate = true;

    if (this.preset === 'lightning') {
      this.boltTimer += delta;
      if (this.boltTimer > 0.085) {
        this.boltTimer = 0;
        this.regenerateBolts();
      }
      this.boltMat.opacity = (0.45 + 0.55 * Math.abs(Math.sin(elapsed * 24))) * this.intensity;
    }
  }

  public dispose(): void {
    this.pointsGeo.dispose();
    this.pointsMat.dispose();
    this.boltGeo.dispose();
    this.boltMat.dispose();
    this.particleTex.dispose();
  }
}
