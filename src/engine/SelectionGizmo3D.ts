import * as THREE from 'three';
import type { CardLayer } from '../types/card';
import type { SnapGuideLine } from './SnapEngine';

export type GizmoHandleType =
  | 'corner-tl'
  | 'corner-tr'
  | 'corner-bl'
  | 'corner-br'
  | 'rotate-roll'
  | 'orient-pitch'
  | 'body';

const BASE_W = 2.5;
const BASE_H = 3.5;

const IDLE_BOX_COLOR = 0x22d3ee; // Neon cyan accent
const LOCKED_BOX_COLOR = 0x64748b; // Slate locked indicator
const IDLE_CORNER_COLOR = 0xfef3c7;
const ACTIVE_CORNER_COLOR = 0xf59e0b;
const PITCH_HANDLE_COLOR = 0xa78bfa;

export class SelectionGizmo3D {
  public readonly group = new THREE.Group();
  public readonly guideGroup = new THREE.Group();
  public readonly handleMeshes: THREE.Mesh[] = [];

  private outlineGeo: THREE.BufferGeometry;
  private outlineMat: THREE.LineBasicMaterial;
  private outlineLoop: THREE.LineLoop;

  private stemGeo: THREE.BufferGeometry;
  private stemLine: THREE.LineSegments;

  private snapGeo: THREE.BufferGeometry;
  private snapMat: THREE.LineBasicMaterial;
  private snapLines: THREE.LineSegments;

  private gridGeo: THREE.BufferGeometry;
  private gridMat: THREE.LineBasicMaterial;
  private gridLines: THREE.LineSegments;

  private cornerGroups: Array<{
    type: GizmoHandleType;
    nx: number;
    ny: number;
    visual: THREE.Mesh;
    hitProxy: THREE.Mesh;
    mat: THREE.MeshBasicMaterial;
  }> = [];

  private rollVisual: THREE.Mesh;
  private rollHit: THREE.Mesh;
  private rollMat: THREE.MeshBasicMaterial;

  private pitchVisual: THREE.Mesh;
  private pitchHit: THREE.Mesh;
  private pitchMat: THREE.MeshBasicMaterial;

  private highlightedHandle: GizmoHandleType | null = null;
  private disposables: Array<{ dispose: () => void }> = [];

  constructor() {
    this.group.renderOrder = 999;
    this.guideGroup.renderOrder = 998;

    // 1. Crisp 3D Bounding Box Outline
    const outlinePts = new Float32Array(4 * 3);
    this.outlineGeo = new THREE.BufferGeometry();
    this.outlineGeo.setAttribute('position', new THREE.BufferAttribute(outlinePts, 3));
    this.outlineMat = new THREE.LineBasicMaterial({
      color: IDLE_BOX_COLOR,
      transparent: true,
      opacity: 0.92,
      depthTest: false,
    });
    this.outlineLoop = new THREE.LineLoop(this.outlineGeo, this.outlineMat);
    this.outlineLoop.renderOrder = 999;
    this.group.add(this.outlineLoop);
    this.disposables.push(this.outlineGeo, this.outlineMat);

    // 2. Stems connecting box to Roll (top) & Pitch/Yaw (right) handles
    this.stemGeo = new THREE.BufferGeometry();
    this.stemGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(4 * 3), 3)
    );
    this.stemLine = new THREE.LineSegments(this.stemGeo, this.outlineMat);
    this.stemLine.renderOrder = 999;
    this.group.add(this.stemLine);
    this.disposables.push(this.stemGeo);

    // 3. 4 Highlighted Box Corners
    const cornerGeo = new THREE.PlaneGeometry(0.13, 0.13);
    const hitGeo = new THREE.SphereGeometry(0.24, 10, 10);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    this.disposables.push(cornerGeo, hitGeo, hitMat);

    const corners: Array<{ type: GizmoHandleType; nx: number; ny: number }> = [
      { type: 'corner-tl', nx: -1, ny: 1 },
      { type: 'corner-tr', nx: 1, ny: 1 },
      { type: 'corner-bl', nx: -1, ny: -1 },
      { type: 'corner-br', nx: 1, ny: -1 },
    ];

    for (const c of corners) {
      const mat = new THREE.MeshBasicMaterial({
        color: IDLE_CORNER_COLOR,
        side: THREE.DoubleSide,
        depthTest: false,
      });
      this.disposables.push(mat);

      const visual = new THREE.Mesh(cornerGeo, mat);
      visual.renderOrder = 1000;

      const hitProxy = new THREE.Mesh(hitGeo, hitMat);
      hitProxy.userData.gizmoHandle = c.type;
      hitProxy.layers.set(2);

      this.group.add(visual, hitProxy);
      this.handleMeshes.push(hitProxy);
      this.cornerGroups.push({ ...c, visual, hitProxy, mat });
    }

    // 4. Top Roll Rotation Handle (Diamond)
    const rollGeo = new THREE.OctahedronGeometry(0.09, 0);
    this.rollMat = new THREE.MeshBasicMaterial({
      color: IDLE_BOX_COLOR,
      depthTest: false,
    });
    this.rollVisual = new THREE.Mesh(rollGeo, this.rollMat);
    this.rollVisual.renderOrder = 1000;
    this.rollHit = new THREE.Mesh(hitGeo, hitMat);
    this.rollHit.userData.gizmoHandle = 'rotate-roll';
    this.rollHit.layers.set(2);
    this.group.add(this.rollVisual, this.rollHit);
    this.handleMeshes.push(this.rollHit);
    this.disposables.push(rollGeo, this.rollMat);

    // 5. Right 3D Pitch & Yaw Orientation Handle (Torus)
    const pitchGeo = new THREE.TorusGeometry(0.082, 0.025, 8, 20);
    this.pitchMat = new THREE.MeshBasicMaterial({
      color: PITCH_HANDLE_COLOR,
      depthTest: false,
    });
    this.pitchVisual = new THREE.Mesh(pitchGeo, this.pitchMat);
    this.pitchVisual.renderOrder = 1000;
    this.pitchHit = new THREE.Mesh(hitGeo, hitMat);
    this.pitchHit.userData.gizmoHandle = 'orient-pitch';
    this.pitchHit.layers.set(2);
    this.group.add(this.pitchVisual, this.pitchHit);
    this.handleMeshes.push(this.pitchHit);
    this.disposables.push(pitchGeo, this.pitchMat);

    // 6. Smart Magnetic Snap Alignment Guide Lines (up to 4 lines)
    this.snapGeo = new THREE.BufferGeometry();
    this.snapGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(8 * 3), 3)
    );
    this.snapGeo.setDrawRange(0, 0);
    this.snapMat = new THREE.LineBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.9,
      depthTest: false,
    });
    this.snapLines = new THREE.LineSegments(this.snapGeo, this.snapMat);
    this.snapLines.renderOrder = 1001;
    this.guideGroup.add(this.snapLines);
    this.disposables.push(this.snapGeo, this.snapMat);

    // 7. Optional Snap-to-Grid Card Plane Overlay
    const gridVerts: number[] = [];
    for (let x = -1.25; x <= 1.251; x += 0.25) {
      gridVerts.push(x, -1.75, 0.29, x, 1.75, 0.29);
    }
    for (let y = -1.75; y <= 1.751; y += 0.25) {
      gridVerts.push(-1.25, y, 0.29, 1.25, y, 0.29);
    }
    this.gridGeo = new THREE.BufferGeometry();
    this.gridGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(gridVerts), 3)
    );
    this.gridMat = new THREE.LineBasicMaterial({
      color: 0x94a3b8,
      transparent: true,
      opacity: 0.18,
      depthTest: false,
    });
    this.gridLines = new THREE.LineSegments(this.gridGeo, this.gridMat);
    this.gridLines.visible = false;
    this.guideGroup.add(this.gridLines);
    this.disposables.push(this.gridGeo, this.gridMat);
  }

  public setGridVisible(visible: boolean): void {
    this.gridLines.visible = visible;
  }

  public setSnapGuides(guides: SnapGuideLine[]): void {
    const attr = this.snapGeo.attributes.position as THREE.BufferAttribute;
    const count = Math.min(4, guides.length);
    for (let i = 0; i < count; i++) {
      const g = guides[i];
      attr.setXYZ(i * 2, g.x1, g.y1, 0.34);
      attr.setXYZ(i * 2 + 1, g.x2, g.y2, 0.34);
    }
    attr.needsUpdate = true;
    this.snapGeo.setDrawRange(0, count * 2);
  }

  public setHighlighted(handle: GizmoHandleType | null): void {
    this.highlightedHandle = handle;

    for (const c of this.cornerGroups) {
      const isHot = handle === c.type;
      c.mat.color.setHex(isHot ? ACTIVE_CORNER_COLOR : IDLE_CORNER_COLOR);
      c.visual.scale.setScalar(isHot ? 1.45 : 1.0);
    }

    const rollHot = handle === 'rotate-roll';
    this.rollMat.color.setHex(rollHot ? ACTIVE_CORNER_COLOR : IDLE_BOX_COLOR);
    this.rollVisual.scale.setScalar(rollHot ? 1.4 : 1.0);

    const pitchHot = handle === 'orient-pitch';
    this.pitchMat.color.setHex(pitchHot ? ACTIVE_CORNER_COLOR : PITCH_HANDLE_COLOR);
    this.pitchVisual.scale.setScalar(pitchHot ? 1.4 : 1.0);

    this.outlineMat.color.setHex(
      handle && handle !== 'body' ? ACTIVE_CORNER_COLOR : IDLE_BOX_COLOR
    );
  }

  public syncFromLayer(
    layer: CardLayer | undefined,
    zWorldPos: number,
    visible: boolean
  ): void {
    this.group.visible = Boolean(visible && layer && layer.visible);
    if (!this.group.visible || !layer) return;

    const locked = Boolean(layer.locked);
    this.outlineMat.color.setHex(
      locked
        ? LOCKED_BOX_COLOR
        : this.highlightedHandle && this.highlightedHandle !== 'body'
          ? ACTIVE_CORNER_COLOR
          : IDLE_BOX_COLOR
    );

    this.group.position.set(layer.offsetX, layer.offsetY, zWorldPos + 0.035);
    this.group.rotation.set(
      THREE.MathUtils.degToRad(layer.pitchDeg ?? 0),
      THREE.MathUtils.degToRad(layer.yawDeg ?? 0),
      THREE.MathUtils.degToRad(layer.rotationDeg),
      'YXZ'
    );

    const isModel = layer.kind === 'model3d';
    const baseW = isModel ? 1.65 : BASE_W;
    const baseH = isModel ? 1.65 : BASE_H;
    const hw = baseW * layer.scale * 0.5;
    const hh = baseH * layer.scale * 0.5;

    const outPos = this.outlineGeo.attributes.position as THREE.BufferAttribute;
    outPos.setXYZ(0, -hw, hh, 0);
    outPos.setXYZ(1, hw, hh, 0);
    outPos.setXYZ(2, hw, -hh, 0);
    outPos.setXYZ(3, -hw, -hh, 0);
    outPos.needsUpdate = true;

    for (const c of this.cornerGroups) {
      c.visual.visible = !locked;
      c.hitProxy.visible = !locked;
      const cx = c.nx * hw;
      const cy = c.ny * hh;
      c.visual.position.set(cx, cy, 0.01);
      c.hitProxy.position.set(cx, cy, 0.01);
      c.hitProxy.updateMatrixWorld();
    }

    const rollY = hh + 0.34;
    const pitchX = hw + 0.34;

    this.stemLine.visible = !locked;
    this.rollVisual.visible = !locked;
    this.rollHit.visible = !locked;
    this.pitchVisual.visible = !locked;
    this.pitchHit.visible = !locked;

    this.rollVisual.position.set(0, rollY, 0.01);
    this.rollHit.position.set(0, rollY, 0.01);
    this.rollHit.updateMatrixWorld();

    this.pitchVisual.position.set(pitchX, 0, 0.01);
    this.pitchHit.position.set(pitchX, 0, 0.01);
    this.pitchHit.updateMatrixWorld();

    const stemPos = this.stemGeo.attributes.position as THREE.BufferAttribute;
    stemPos.setXYZ(0, 0, hh, 0);
    stemPos.setXYZ(1, 0, rollY, 0);
    stemPos.setXYZ(2, hw, 0, 0);
    stemPos.setXYZ(3, pitchX, 0, 0);
    stemPos.needsUpdate = true;

    this.outlineGeo.computeBoundingSphere();
    this.stemGeo.computeBoundingSphere();
  }

  public getHighlighted(): GizmoHandleType | null {
    return this.highlightedHandle;
  }

  public dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}
