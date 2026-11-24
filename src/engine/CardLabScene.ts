import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import type {
  CardLayer,
  CardProject,
  ExportDimensionPreset,
  ExportFormat,
  InteractionMode,
  LightingPreset,
  SnapConfig,
  TransformGizmoMode,
} from '../types/card';
import { createDefaultFrameConfig, getCardDimensionsForProportion } from '../utils/frameGenerator';
import {
  DEPTH_TEX_H,
  DEPTH_TEX_W,
  loadImageElement,
  sampleDepthMapPixels,
} from '../utils/imageProcessing';
import {
  applyMaterialFinishAndPbr,
  createCardLayerMaterial,
  foilStyleToIndex,
  type FoilUniforms,
} from './foilShader';
import { createFrameAssembly3D, type FrameAssembly3D } from './frameMesh3D';
import {
  buildProceduralModel3D,
  loadExternalModel3D,
  type LoadedModel3D,
} from './modelLoader3D';
import { CardParticleSystem } from './particleEffects';
import { SelectionGizmo3D, type GizmoHandleType } from './SelectionGizmo3D';
import {
  buildVcaSlabAssembly,
  createCardBackTexture,
  type SlabAssembly,
} from './slabBuilder';
import {
  DEFAULT_SNAP_CONFIG,
  snapAngleDeg,
  snapPosition,
  snapScaleValue,
} from './SnapEngine';

interface AnimatedGifController {
  texture: THREE.CanvasTexture;
  timerId: number;
  disposed: boolean;
}

interface LayerRenderNode {
  id: string;
  kind: 'image' | 'model3d' | 'frame';
  rootObject: THREE.Object3D;
  mesh?: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshPhysicalMaterial>;
  model3d?: LoadedModel3D;
  modelKey?: string;
  foilUniforms?: FoilUniforms;
  imageUrl: string;
  depthMapUrl: string;
  depthPixels: Float32Array | null;
  alphaMask: Uint8Array | null;
  lastAppliedDisp: number;
  lastMaterialKey: string;
  tex: THREE.Texture | null;
  gifController?: AnimatedGifController;
}

const CARD_W = 2.5;
const CARD_H = 3.5;
const ALPHA_W = 128;
const ALPHA_H = 180;

function detectSoftwareGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(128, 128, 12, 128, 128, 122);
  g.addColorStop(0, 'rgba(0,0,0,0.68)');
  g.addColorStop(0.5, 'rgba(0,0,0,0.28)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildAlphaMaskFromImage(img: HTMLImageElement): Uint8Array {
  const c = document.createElement('canvas');
  c.width = ALPHA_W;
  c.height = ALPHA_H;
  const ctx = c.getContext('2d');
  const out = new Uint8Array(ALPHA_W * ALPHA_H);
  if (!ctx) return out;
  ctx.drawImage(img, 0, 0, ALPHA_W, ALPHA_H);
  const data = ctx.getImageData(0, 0, ALPHA_W, ALPHA_H).data;
  for (let i = 0; i < out.length; i++) {
    out[i] = data[i * 4 + 3];
  }
  return out;
}

async function createAnimatedGifTexture(
  dataUrl: string,
  maxAniso: number
): Promise<AnimatedGifController | null> {
  const DecoderCtor = (
    window as unknown as {
      ImageDecoder?: new (init: {
        data: BufferSource;
        type: string;
      }) => {
        tracks: { ready: Promise<void>; selectedTrack?: { frameCount: number } };
        decode: (opts: { frameIndex: number }) => Promise<{
          image: {
            displayWidth: number;
            displayHeight: number;
            duration?: number;
            close: () => void;
          };
        }>;
        close: () => void;
      };
    }
  ).ImageDecoder;

  if (!DecoderCtor) return null;

  try {
    const res = await fetch(dataUrl);
    const buf = await res.arrayBuffer();
    const decoder = new DecoderCtor({ data: buf, type: 'image/gif' });
    await decoder.tracks.ready;
    const frameCount = decoder.tracks.selectedTrack?.frameCount ?? 1;
    if (frameCount <= 1) {
      decoder.close();
      return null;
    }

    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 716;
    const ctx = c.getContext('2d')!;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAniso;

    const ctrl: AnimatedGifController = {
      texture: tex,
      timerId: 0,
      disposed: false,
    };

    let idx = 0;
    const step = async () => {
      if (ctrl.disposed) {
        decoder.close();
        return;
      }
      try {
        const result = await decoder.decode({ frameIndex: idx % frameCount });
        const img = result.image;
        ctx.clearRect(0, 0, c.width, c.height);
        const sc = Math.min(c.width / img.displayWidth, c.height / img.displayHeight);
        const dw = img.displayWidth * sc;
        const dh = img.displayHeight * sc;
        ctx.drawImage(img as unknown as CanvasImageSource, (c.width - dw) / 2, (c.height - dh) / 2, dw, dh);
        tex.needsUpdate = true;
        const delayMs = Math.max(40, Math.round((img.duration ?? 80000) / 1000));
        img.close();
        idx = (idx + 1) % frameCount;
        ctrl.timerId = window.setTimeout(step, delayMs);
      } catch {
        decoder.close();
      }
    };
    step();
    return ctrl;
  } catch {
    return null;
  }
}

export interface SceneInteractionCallbacks {
  onContextLost?: (lost: boolean) => void;
  onSelectLayer?: (layerId: string) => void;
  onDoubleTapLayer?: (layerId: string) => void;
  onLongPressLayer?: (layerId: string, clientX: number, clientY: number) => void;
  onUpdateLayerTransform?: (layerId: string, patch: Partial<CardLayer>) => void;
  onCommitTransform?: () => void;
}

export class CardLabScene {
  private container: HTMLElement;
  private isSoftwareGl: boolean;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private transformControls: TransformControls;
  private transformHelper: THREE.Object3D;
  private clock = new THREE.Clock();

  private cardRoot = new THREE.Group();
  private layerGroup = new THREE.Group();
  private cardBackMesh: THREE.Mesh;
  private cardCoreMesh: THREE.Mesh;
  private contactShadow: THREE.Mesh;
  private slabAssembly: SlabAssembly;
  private frameAssembly: FrameAssembly3D;
  private particles: CardParticleSystem;
  private gizmo: SelectionGizmo3D;

  private keyLight: THREE.DirectionalLight;
  private fillLight: THREE.HemisphereLight;
  private rimLight: THREE.DirectionalLight;
  private rectSoftbox: THREE.RectAreaLight | null = null;

  private layerNodes = new Map<string, LayerRenderNode>();
  private textureCache = new Map<string, THREE.Texture>();
  private alphaCache = new Map<string, Uint8Array>();
  private depthCache = new Map<string, Float32Array>();

  private frameId = 0;
  private disposed = false;
  private contextLost = false;
  private maxAniso = 1;

  // Interactive & Viewer states
  private interactionMode: InteractionMode = 'object';
  private gizmoMode: TransformGizmoMode = 'translate';
  private viewerMode = false;
  private viewerTurntable = false;
  private snapConfig: SnapConfig = { ...DEFAULT_SNAP_CONFIG };
  private selectedLayerId = '';
  private pointerNorm = new THREE.Vector2(0, 0);
  private targetTilt = new THREE.Vector2(0, 0);
  private currentTilt = new THREE.Vector2(0, 0);
  private explodeTarget = 0;
  private explodeCurrent = 0;
  private floatEnabled = true;
  private dockCenterBias = -0.35;
  private currentCenterBias = -0.35;
  private cameraSensitivity = 1.0;

  private foilSpeed = 1.0;
  private foilSweepSpeed = 1.0;
  private foilFresnel = 1.0;
  private foilScale = 1.0;
  private foilTint = new THREE.Color('#ffffff');
  private foilStyleIndex = 1;
  private foilIntensity = 0.85;
  private latestLayers: CardLayer[] = [];
  private lastSlabKey = '';
  private activeBgHex = 0x0b0d12;

  // Gesture & Long-press / Double-tap state
  private activePointers = new Map<number, { x: number; y: number }>();
  private lastTapInfo: { layerId: string; time: number } | null = null;
  private longPressTimer = 0;
  private dragMoved = false;
  private isTransformDragging = false;
  private activeDrag:
    | {
        mode: 'handle';
        layerId: string;
        handle: GizmoHandleType;
        startPointerLocal: THREE.Vector3;
        startClient: { x: number; y: number };
        startLayer: CardLayer;
        groupSiblings: Array<{ id: string; startX: number; startY: number }>;
      }
    | null = null;

  // Reusable scratch math
  private readonly _targetVec = new THREE.Vector3();
  private readonly _raycaster = new THREE.Raycaster();
  private readonly _rayNdc = new THREE.Vector2();
  private readonly _layerPlane = new THREE.Plane();
  private readonly _planeNormal = new THREE.Vector3();
  private readonly _planePoint = new THREE.Vector3();
  private readonly _hitWorld = new THREE.Vector3();
  private readonly _hitLocal = new THREE.Vector3();
  private readonly _invMatrix = new THREE.Matrix4();

  private callbacks: SceneInteractionCallbacks;

  constructor(
    container: HTMLElement,
    initialProject: CardProject,
    callbacks: SceneInteractionCallbacks = {}
  ) {
    this.container = container;
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareGl();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b0d12);
    this.scene.fog = new THREE.FogExp2(0x0b0d12, 0.045);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    this.camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    this.camera.position.set(0, 0.25, 7.8);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
      alpha: true,
    });
    this.renderer.setClearColor(0x0b0d12, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.touchAction = 'none';
    this.maxAniso = this.renderer.capabilities.getMaxAnisotropy();

    container.appendChild(this.renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    this.fillLight = new THREE.HemisphereLight(0xdbeafe, 0x0f172a, 0.72);
    this.scene.add(this.fillLight);

    this.keyLight = new THREE.DirectionalLight(0xfff1dc, 2.2);
    this.keyLight.position.set(3.8, 5.2, 5.6);
    this.keyLight.castShadow = !this.isSoftwareGl;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.near = 1;
    this.keyLight.shadow.camera.far = 16;
    this.keyLight.shadow.camera.left = -3.5;
    this.keyLight.shadow.camera.right = 3.5;
    this.keyLight.shadow.camera.top = 3.5;
    this.keyLight.shadow.camera.bottom = -3.5;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);

    this.rimLight = new THREE.DirectionalLight(0x93c5fd, 1.35);
    this.rimLight.position.set(-4.2, 2.5, -4.0);
    this.scene.add(this.rimLight);

    if (!this.isSoftwareGl) {
      RectAreaLightUniformsLib.init();
      this.rectSoftbox = new THREE.RectAreaLight(0xffffff, 2.4, 4.5, 6.0);
      this.rectSoftbox.position.set(-2.8, 1.8, 4.2);
      this.rectSoftbox.lookAt(0, 0, 0);
      this.scene.add(this.rectSoftbox);
    }

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.07;
    this.controls.minDistance = 3.4;
    this.controls.maxDistance = 14.5;
    this.controls.target.set(0, -0.35, 0);
    this.controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };

    // Real Three.js TransformControls for Precision Mode
    this.transformControls = new TransformControls(
      this.camera,
      this.renderer.domElement
    );
    this.transformControls.setSize(0.75);
    this.transformControls.enabled = false;
    this.transformHelper = this.transformControls.getHelper();
    this.transformHelper.visible = false;
    this.scene.add(this.transformHelper);

    this.transformControls.addEventListener('dragging-changed', (event) => {
      const dragging = Boolean((event as { value: boolean }).value);
      this.isTransformDragging = dragging;
      this.controls.enabled = !dragging;
      if (!dragging) {
        this.syncTransformControlsToLayerState();
        this.callbacks.onCommitTransform?.();
      }
    });

    this.transformControls.addEventListener('objectChange', () => {
      if (this.isTransformDragging) {
        this.syncTransformControlsToLayerState();
      }
    });

    const shadowTex = createContactShadowTexture();
    const shadowGeo = new THREE.PlaneGeometry(4.8, 3.2);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    this.contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.contactShadow.position.set(0, -2.55, 0);
    this.scene.add(this.contactShadow);

    this.scene.add(this.cardRoot);
    this.cardRoot.add(this.layerGroup);

    const coreGeo = new THREE.BoxGeometry(CARD_W - 0.02, CARD_H - 0.02, 0.036);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.45,
      metalness: 0.5,
    });
    this.cardCoreMesh = new THREE.Mesh(coreGeo, coreMat);
    this.cardCoreMesh.position.z = -0.105;
    this.cardRoot.add(this.cardCoreMesh);

    const backTex = createCardBackTexture(this.maxAniso);
    const backGeo = new THREE.PlaneGeometry(CARD_W, CARD_H);
    backGeo.rotateY(Math.PI);
    const backMat = new THREE.MeshPhysicalMaterial({
      map: backTex,
      roughness: 0.3,
      metalness: 0.25,
      clearcoat: 0.7,
    });
    this.cardBackMesh = new THREE.Mesh(backGeo, backMat);
    this.cardBackMesh.position.z = -0.126;
    this.cardRoot.add(this.cardBackMesh);

    this.frameAssembly = createFrameAssembly3D(
      initialProject.frame || createDefaultFrameConfig(),
      this.maxAniso
    );
    this.cardRoot.add(this.frameAssembly.group);

    this.slabAssembly = buildVcaSlabAssembly(
      initialProject.slab,
      this.isSoftwareGl,
      this.maxAniso
    );
    this.cardRoot.add(this.slabAssembly.group);

    this.particles = new CardParticleSystem();
    this.cardRoot.add(this.particles.group);

    this.gizmo = new SelectionGizmo3D();
    this.layerGroup.add(this.gizmo.group);
    this.layerGroup.add(this.gizmo.guideGroup);

    this.syncProject(initialProject);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.tick();
  }

  private syncTransformControlsToLayerState(): void {
    const layer = this.latestLayers.find((l) => l.id === this.selectedLayerId);
    const node = layer ? this.layerNodes.get(layer.id) : undefined;
    if (!layer || !node || layer.locked) return;

    const obj = node.rootObject;
    let nx = Number(THREE.MathUtils.clamp(obj.position.x, -1.8, 1.8).toFixed(2));
    let ny = Number(THREE.MathUtils.clamp(obj.position.y, -2.2, 2.2).toFixed(2));
    const nLayers = Math.max(1, this.latestLayers.length);
    const idx = this.latestLayers.findIndex((l) => l.id === layer.id);
    const spread = (idx - (nLayers - 1) * 0.5) * 0.55 * this.explodeCurrent;
    const nz = Number(
      THREE.MathUtils.clamp(obj.position.z - spread, -0.25, 0.55).toFixed(2)
    );

    if (this.snapConfig.enabled && this.gizmoMode === 'translate') {
      const snapped = snapPosition(nx, ny, layer.id, this.latestLayers, this.snapConfig);
      nx = snapped.offsetX;
      ny = snapped.offsetY;
      this.gizmo.setSnapGuides(snapped.guides);
    }

    const pitchDeg = Math.round(THREE.MathUtils.radToDeg(obj.rotation.x));
    const yawDeg = Math.round(THREE.MathUtils.radToDeg(obj.rotation.y));
    const rollDeg = snapAngleDeg(
      THREE.MathUtils.radToDeg(obj.rotation.z),
      this.snapConfig
    );
    const sc = snapScaleValue(
      THREE.MathUtils.clamp(obj.scale.x, 0.2, 2.5),
      this.snapConfig
    );

    this.callbacks.onUpdateLayerTransform?.(layer.id, {
      offsetX: nx,
      offsetY: ny,
      zOffset: nz,
      pitchDeg: THREE.MathUtils.clamp(pitchDeg, -65, 65),
      yawDeg: THREE.MathUtils.clamp(yawDeg, -65, 65),
      rotationDeg: rollDeg,
      scale: sc,
    });
  }

  private bindEvents(): void {
    const dom = this.renderer.domElement;

    window.addEventListener('resize', this.handleResize);
    dom.addEventListener('pointerdown', this.handlePointerDown);
    dom.addEventListener('pointermove', this.handlePointerMove);
    dom.addEventListener('pointerup', this.handlePointerUp);
    dom.addEventListener('pointercancel', this.handlePointerUp);
    dom.addEventListener('pointerleave', this.handlePointerLeave);
    dom.addEventListener('contextmenu', this.handleContextMenu);
    dom.addEventListener('webglcontextlost', this.handleContextLost);
    dom.addEventListener('webglcontextrestored', this.handleContextRestored);
  }

  private handleContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
    if (this.viewerMode || this.interactionMode === 'camera') return;
    const picked = this.hitTestLayerAlphaAware(e.clientX, e.clientY);
    if (picked) {
      this.selectedLayerId = picked.id;
      this.callbacks.onSelectLayer?.(picked.id);
      this.callbacks.onLongPressLayer?.(picked.id, e.clientX, e.clientY);
    }
  };

  private handleContextLost = (e: Event): void => {
    e.preventDefault();
    this.contextLost = true;
    this.callbacks.onContextLost?.(true);
  };

  private handleContextRestored = (): void => {
    this.contextLost = false;
    this.callbacks.onContextLost?.(false);
  };

  private handleResize = (): void => {
    if (this.disposed) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private updateRayFromClient(clientX: number, clientY: number): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this._rayNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this._rayNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this._raycaster.setFromCamera(this._rayNdc, this.camera);
  }

  private projectClientToCardLocal(
    clientX: number,
    clientY: number,
    zPlaneLocal: number
  ): THREE.Vector3 | null {
    this.updateRayFromClient(clientX, clientY);
    this.layerGroup.updateMatrixWorld();
    this._planeNormal.set(0, 0, 1).transformDirection(this.layerGroup.matrixWorld);
    this._planePoint.set(0, 0, zPlaneLocal).applyMatrix4(this.layerGroup.matrixWorld);
    this._layerPlane.setFromNormalAndCoplanarPoint(this._planeNormal, this._planePoint);

    if (!this._raycaster.ray.intersectPlane(this._layerPlane, this._hitWorld)) {
      return null;
    }
    this._invMatrix.copy(this.layerGroup.matrixWorld).invert();
    this._hitLocal.copy(this._hitWorld).applyMatrix4(this._invMatrix);
    return this._hitLocal.clone();
  }

  private hitTestGizmo(clientX: number, clientY: number): GizmoHandleType | null {
    if (!this.gizmo.group.visible) return null;
    this.updateRayFromClient(clientX, clientY);
    this._raycaster.layers.set(2);
    const hits = this._raycaster.intersectObjects(this.gizmo.handleMeshes, false);
    this._raycaster.layers.set(0);
    if (hits.length > 0) {
      return hits[0].object.userData.gizmoHandle as GizmoHandleType;
    }
    return null;
  }

  private hitTestLayerAlphaAware(clientX: number, clientY: number): CardLayer | null {
    this.updateRayFromClient(clientX, clientY);
    this._raycaster.layers.set(0);

    const targets: THREE.Object3D[] = [];
    for (const layer of this.latestLayers) {
      if (!layer.visible) continue;
      const node = this.layerNodes.get(layer.id);
      if (node) targets.push(node.rootObject);
    }

    const intersects = this._raycaster.intersectObjects(targets, true);
    for (const hit of intersects) {
      const layer = this.latestLayers.find((l) => {
        const node = this.layerNodes.get(l.id);
        if (!node) return false;
        let cur: THREE.Object3D | null = hit.object;
        while (cur) {
          if (cur === node.rootObject) return true;
          cur = cur.parent;
        }
        return false;
      });
      if (!layer) continue;
      const node = this.layerNodes.get(layer.id);
      if (!node) continue;

      if (node.kind === 'image' && node.alphaMask && hit.uv) {
        const px = Math.min(
          ALPHA_W - 1,
          Math.max(0, Math.round(hit.uv.x * (ALPHA_W - 1)))
        );
        const py = Math.min(
          ALPHA_H - 1,
          Math.max(0, Math.round((1 - hit.uv.y) * (ALPHA_H - 1)))
        );
        const alpha = node.alphaMask[py * ALPHA_W + px];
        if (alpha < 18) continue;
      }
      return layer;
    }
    return null;
  }

  private clearLongPress(): void {
    if (this.longPressTimer) {
      window.clearTimeout(this.longPressTimer);
      this.longPressTimer = 0;
    }
  }

  private handlePointerDown = (e: PointerEvent): void => {
    this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.clearLongPress();
    this.dragMoved = false;

    if (this.viewerMode || this.interactionMode === 'camera' || this.interactionMode === 'tilt') {
      return;
    }

    // In Precision Mode, let TransformControls + OrbitControls handle interaction naturally
    if (this.interactionMode === 'precision') {
      if (
        this.activePointers.size === 1 &&
        !this.isTransformDragging &&
        !this.transformControls.axis
      ) {
        const picked = this.hitTestLayerAlphaAware(e.clientX, e.clientY);
        if (picked && picked.id !== this.selectedLayerId) {
          this.selectedLayerId = picked.id;
          this.callbacks.onSelectLayer?.(picked.id);
          this.attachTransformControlsToSelected();
        }
      }
      return;
    }

    // OBJECT MODE:
    // 2 fingers -> Zoom & pan camera cleanly via OrbitControls
    if (this.activePointers.size >= 2) {
      this.activeDrag = null;
      this.controls.enabled = true;
      return;
    }

    // 1. Check highlighted gizmo corners & orientation handles first
    const gizmoHandle = this.hitTestGizmo(e.clientX, e.clientY);
    if (gizmoHandle) {
      const layer = this.latestLayers.find((l) => l.id === this.selectedLayerId);
      if (layer && !layer.locked) {
        this.controls.enabled = false;
        this.renderer.domElement.setPointerCapture(e.pointerId);
        const localPt =
          this.projectClientToCardLocal(e.clientX, e.clientY, layer.zOffset) ||
          new THREE.Vector3();
        this.gizmo.setHighlighted(gizmoHandle);
        this.activeDrag = {
          mode: 'handle',
          layerId: layer.id,
          handle: gizmoHandle,
          startPointerLocal: localPt,
          startClient: { x: e.clientX, y: e.clientY },
          startLayer: { ...layer },
          groupSiblings: [],
        };
        return;
      }
    }

    // 2. Hit-test object beneath pointer (alpha-aware!)
    const pickedLayer = this.hitTestLayerAlphaAware(e.clientX, e.clientY);
    if (pickedLayer) {
      // Double-tap detection
      const now = performance.now();
      if (
        this.lastTapInfo &&
        this.lastTapInfo.layerId === pickedLayer.id &&
        now - this.lastTapInfo.time < 320
      ) {
        this.lastTapInfo = null;
        this.callbacks.onDoubleTapLayer?.(pickedLayer.id);
      } else {
        this.lastTapInfo = { layerId: pickedLayer.id, time: now };
      }

      // Long-press context menu
      const pressX = e.clientX;
      const pressY = e.clientY;
      const pressedId = pickedLayer.id;
      this.longPressTimer = window.setTimeout(() => {
        if (!this.dragMoved && this.activePointers.size === 1) {
          this.activeDrag = null;
          this.controls.enabled = true;
          this.callbacks.onLongPressLayer?.(pressedId, pressX, pressY);
        }
      }, 480);

      // Select object
      const wasAlreadySelected = this.selectedLayerId === pickedLayer.id;
      this.selectedLayerId = pickedLayer.id;
      this.callbacks.onSelectLayer?.(pickedLayer.id);

      // Move only if unlocked AND (already selected or non-background foreground/character/fx)
      // Background layer acts like empty canvas for safe camera orbit unless unlocked AND explicitly selected
      const canDragObject =
        !pickedLayer.locked &&
        (wasAlreadySelected || pickedLayer.role !== 'background');

      if (canDragObject) {
        this.controls.enabled = false;
        this.renderer.domElement.setPointerCapture(e.pointerId);
        const localPt =
          this.projectClientToCardLocal(e.clientX, e.clientY, pickedLayer.zOffset) ||
          new THREE.Vector3();
        this.gizmo.setHighlighted('body');

        const groupSiblings = pickedLayer.groupId
          ? this.latestLayers
              .filter(
                (l) =>
                  l.groupId === pickedLayer.groupId &&
                  l.id !== pickedLayer.id &&
                  !l.locked
              )
              .map((l) => ({ id: l.id, startX: l.offsetX, startY: l.offsetY }))
          : [];

        this.activeDrag = {
          mode: 'handle',
          layerId: pickedLayer.id,
          handle: 'body',
          startPointerLocal: localPt,
          startClient: { x: e.clientX, y: e.clientY },
          startLayer: { ...pickedLayer },
          groupSiblings,
        };
        return;
      }
    }

    // 3. Empty canvas (or locked background): allow smooth 1-finger OrbitControls camera!
    this.controls.enabled = true;
  };

  private handlePointerMove = (e: PointerEvent): void => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerNorm.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNorm.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    if (this.activePointers.has(e.pointerId)) {
      this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (this.interactionMode === 'tilt' && !this.viewerMode) {
      this.targetTilt.x = THREE.MathUtils.clamp(-this.pointerNorm.y * 0.34, -0.45, 0.45);
      this.targetTilt.y = THREE.MathUtils.clamp(this.pointerNorm.x * 0.42, -0.55, 0.55);
      return;
    }

    if (this.interactionMode !== 'object' || this.viewerMode) return;

    if (this.activeDrag?.mode === 'handle') {
      const { handle, layerId, startLayer, startPointerLocal, startClient, groupSiblings } =
        this.activeDrag;

      if (Math.hypot(e.clientX - startClient.x, e.clientY - startClient.y) > 7) {
        this.dragMoved = true;
        this.clearLongPress();
      }

      const localPt = this.projectClientToCardLocal(
        e.clientX,
        e.clientY,
        startLayer.zOffset
      );

      if (handle === 'body' && localPt) {
        const dx = localPt.x - startPointerLocal.x;
        const dy = localPt.y - startPointerLocal.y;
        const rawX = THREE.MathUtils.clamp(startLayer.offsetX + dx, -1.8, 1.8);
        const rawY = THREE.MathUtils.clamp(startLayer.offsetY + dy, -2.2, 2.2);
        const snapped = snapPosition(
          rawX,
          rawY,
          layerId,
          this.latestLayers,
          this.snapConfig
        );
        this.gizmo.setSnapGuides(snapped.guides);

        this.callbacks.onUpdateLayerTransform?.(layerId, {
          offsetX: snapped.offsetX,
          offsetY: snapped.offsetY,
        });

        // Move grouped siblings together
        const appliedDx = snapped.offsetX - startLayer.offsetX;
        const appliedDy = snapped.offsetY - startLayer.offsetY;
        for (const sib of groupSiblings) {
          this.callbacks.onUpdateLayerTransform?.(sib.id, {
            offsetX: Number(
              THREE.MathUtils.clamp(sib.startX + appliedDx, -1.8, 1.8).toFixed(2)
            ),
            offsetY: Number(
              THREE.MathUtils.clamp(sib.startY + appliedDy, -2.2, 2.2).toFixed(2)
            ),
          });
        }
      } else if (
        (handle === 'corner-tl' ||
          handle === 'corner-tr' ||
          handle === 'corner-bl' ||
          handle === 'corner-br') &&
        localPt
      ) {
        const startDist = Math.max(
          0.15,
          Math.hypot(
            startPointerLocal.x - startLayer.offsetX,
            startPointerLocal.y - startLayer.offsetY
          )
        );
        const curDist = Math.max(
          0.08,
          Math.hypot(localPt.x - startLayer.offsetX, localPt.y - startLayer.offsetY)
        );
        const newScale = snapScaleValue(
          THREE.MathUtils.clamp(startLayer.scale * (curDist / startDist), 0.2, 2.5),
          this.snapConfig
        );
        this.callbacks.onUpdateLayerTransform?.(layerId, { scale: newScale });
      } else if (handle === 'rotate-roll' && localPt) {
        const a0 = Math.atan2(
          startPointerLocal.y - startLayer.offsetY,
          startPointerLocal.x - startLayer.offsetX
        );
        const a1 = Math.atan2(
          localPt.y - startLayer.offsetY,
          localPt.x - startLayer.offsetX
        );
        const deg = snapAngleDeg(
          startLayer.rotationDeg + THREE.MathUtils.radToDeg(a1 - a0),
          this.snapConfig
        );
        this.callbacks.onUpdateLayerTransform?.(layerId, { rotationDeg: deg });
      } else if (handle === 'orient-pitch') {
        const dxPx = e.clientX - startClient.x;
        const dyPx = e.clientY - startClient.y;
        const newYaw = THREE.MathUtils.clamp(
          snapAngleDeg(startLayer.yawDeg + dxPx * 0.35, this.snapConfig),
          -65,
          65
        );
        const newPitch = THREE.MathUtils.clamp(
          snapAngleDeg(startLayer.pitchDeg + dyPx * 0.35, this.snapConfig),
          -65,
          65
        );
        this.callbacks.onUpdateLayerTransform?.(layerId, {
          yawDeg: newYaw,
          pitchDeg: newPitch,
        });
      }
      return;
    }

    // Hover feedback
    const hoverHandle = this.hitTestGizmo(e.clientX, e.clientY);
    this.gizmo.setHighlighted(hoverHandle);
    if (hoverHandle === 'corner-tl' || hoverHandle === 'corner-br') {
      this.renderer.domElement.style.cursor = 'nwse-resize';
    } else if (hoverHandle === 'corner-tr' || hoverHandle === 'corner-bl') {
      this.renderer.domElement.style.cursor = 'nesw-resize';
    } else if (hoverHandle === 'rotate-roll' || hoverHandle === 'orient-pitch') {
      this.renderer.domElement.style.cursor = 'grab';
    } else {
      const hoveredLayer = this.hitTestLayerAlphaAware(e.clientX, e.clientY);
      this.renderer.domElement.style.cursor =
        hoveredLayer && !hoveredLayer.locked ? 'move' : 'grab';
    }
  };

  private handlePointerUp = (e: PointerEvent): void => {
    this.clearLongPress();
    this.activePointers.delete(e.pointerId);
    if (this.activePointers.size === 0) {
      if (this.activeDrag && this.dragMoved) {
        this.callbacks.onCommitTransform?.();
      }
      this.activeDrag = null;
      this.gizmo.setHighlighted(null);
      this.gizmo.setSnapGuides([]);
      this.controls.enabled =
        this.viewerMode ||
        this.interactionMode === 'camera' ||
        this.interactionMode === 'object' ||
        this.interactionMode === 'precision';
    }
  };

  private handlePointerLeave = (): void => {
    this.clearLongPress();
    if (this.interactionMode === 'tilt') {
      this.targetTilt.set(0, 0);
    }
  };

  private attachTransformControlsToSelected(): void {
    const showPrecision =
      !this.viewerMode && this.interactionMode === 'precision';
    const layer = this.latestLayers.find((l) => l.id === this.selectedLayerId);
    const node = layer ? this.layerNodes.get(layer.id) : undefined;

    if (showPrecision && layer && node && layer.visible && !layer.locked) {
      this.transformControls.attach(node.rootObject);
      this.transformHelper.visible = true;
      this.transformControls.enabled = true;
      this.transformControls.setMode(this.gizmoMode);
      this.transformControls.setTranslationSnap(
        this.snapConfig.enabled && this.snapConfig.snapToGrid
          ? this.snapConfig.gridStep
          : null
      );
      this.transformControls.setRotationSnap(
        this.snapConfig.enabled && this.snapConfig.rotationStep > 0
          ? THREE.MathUtils.degToRad(this.snapConfig.rotationStep)
          : null
      );
      this.transformControls.setScaleSnap(
        this.snapConfig.enabled && this.snapConfig.scaleStep > 0
          ? this.snapConfig.scaleStep
          : null
      );
    } else {
      this.transformControls.detach();
      this.transformHelper.visible = false;
      this.transformControls.enabled = false;
    }
  }

  public setInteractionMode(mode: InteractionMode): void {
    this.interactionMode = mode;
    this.activeDrag = null;
    this.activePointers.clear();
    this.clearLongPress();
    this.gizmo.setSnapGuides([]);

    if (mode === 'tilt') {
      this.controls.enabled = false;
      this.resetCamera();
      this.renderer.domElement.style.cursor = 'grab';
    } else {
      this.targetTilt.set(0, 0);
      this.controls.enabled = true;
      this.renderer.domElement.style.cursor = 'grab';
    }
    this.attachTransformControlsToSelected();
  }

  public setTransformGizmoMode(mode: TransformGizmoMode): void {
    this.gizmoMode = mode;
    this.transformControls.setMode(mode);
  }

  public setSnapConfig(snap: SnapConfig): void {
    this.snapConfig = { ...snap };
    this.gizmo.setGridVisible(
      !this.viewerMode &&
        snap.enabled &&
        snap.snapToGrid &&
        (this.interactionMode === 'object' || this.interactionMode === 'precision')
    );
    this.attachTransformControlsToSelected();
  }

  public setCameraSensitivity(sens: number): void {
    this.cameraSensitivity = THREE.MathUtils.clamp(sens, 0.3, 2.2);
    this.controls.rotateSpeed = this.cameraSensitivity;
    this.controls.zoomSpeed = this.cameraSensitivity;
    this.controls.panSpeed = this.cameraSensitivity;
  }

  public setViewerMode(enabled: boolean, turntable = false): void {
    this.viewerMode = enabled;
    this.viewerTurntable = turntable;
    this.controls.autoRotate = enabled && turntable && !this.isSoftwareGl;
    this.controls.autoRotateSpeed = 2.2;
    this.controls.enabled = enabled || this.interactionMode !== 'tilt';
    this.gizmo.setSnapGuides([]);
    this.gizmo.setGridVisible(
      !enabled &&
        this.snapConfig.enabled &&
        this.snapConfig.snapToGrid &&
        (this.interactionMode === 'object' || this.interactionMode === 'precision')
    );
    this.attachTransformControlsToSelected();
    if (enabled) {
      this.setCameraPreset('angle');
    }
  }

  public setSelectedLayerId(id: string): void {
    this.selectedLayerId = id;
    this.attachTransformControlsToSelected();
  }

  public setExplodeFactor(factor: number): void {
    this.explodeTarget = THREE.MathUtils.clamp(factor, 0, 1);
  }

  public setFloatEnabled(enabled: boolean): void {
    this.floatEnabled = enabled;
  }

  public setDockOpen(isOpen: boolean): void {
    this.dockCenterBias = isOpen ? -0.42 : 0.0;
  }

  public resetCamera(): void {
    this.camera.position.set(0, 0.25, this.slabAssembly.group.visible ? 7.8 : 6.7);
    this.controls.target.set(0, this.dockCenterBias, 0);
    this.controls.update();
  }

  public setCameraPreset(preset: 'front' | 'angle' | 'side' | 'back'): void {
    const dist = this.slabAssembly.group.visible ? 7.6 : 6.5;
    if (preset === 'front') {
      this.camera.position.set(0, 0.2, dist);
    } else if (preset === 'angle') {
      this.camera.position.set(2.8, 0.85, dist * 0.9);
    } else if (preset === 'side') {
      this.camera.position.set(dist * 0.92, 0.28, 2.1);
    } else if (preset === 'back') {
      this.camera.position.set(0, 0.2, -dist);
    }
    this.controls.target.set(0, this.dockCenterBias, 0);
    this.controls.update();
  }

  private applyLightingPreset(preset: LightingPreset): void {
    if (preset === 'moonlit_indigo') {
      this.activeBgHex = 0x090b14;
      this.keyLight.color.setHex(0xe0e7ff);
      this.keyLight.intensity = 2.05;
      this.fillLight.color.setHex(0xa5b4fc);
      this.fillLight.groundColor.setHex(0x1e1b4b);
      this.rimLight.color.setHex(0xc084fc);
      this.rimLight.intensity = 1.65;
    } else if (preset === 'crimson_forge') {
      this.activeBgHex = 0x12090b;
      this.keyLight.color.setHex(0xffedd5);
      this.keyLight.intensity = 2.25;
      this.fillLight.color.setHex(0xfca5a5);
      this.fillLight.groundColor.setHex(0x2a0a0a);
      this.rimLight.color.setHex(0xf97316);
      this.rimLight.intensity = 1.75;
    } else if (preset === 'gallery_daylight') {
      this.activeBgHex = 0x131722;
      this.keyLight.color.setHex(0xffffff);
      this.keyLight.intensity = 2.3;
      this.fillLight.color.setHex(0xf1f5f9);
      this.fillLight.groundColor.setHex(0x1e293b);
      this.rimLight.color.setHex(0x7dd3fc);
      this.rimLight.intensity = 1.3;
    } else {
      this.activeBgHex = 0x0b0d12;
      this.keyLight.color.setHex(0xfff1dc);
      this.keyLight.intensity = 2.2;
      this.fillLight.color.setHex(0xdbeafe);
      this.fillLight.groundColor.setHex(0x0f172a);
      this.rimLight.color.setHex(0xfbbf24);
      this.rimLight.intensity = 1.45;
    }
    this.scene.background = new THREE.Color(this.activeBgHex);
    (this.scene.fog as THREE.FogExp2).color.setHex(this.activeBgHex);
  }

  public syncProject(project: CardProject): void {
    this.latestLayers = project.layers;
    this.foilStyleIndex = foilStyleToIndex(project.foilStyle);
    this.foilIntensity = project.foilIntensity;
    this.foilSpeed = project.foilSpeed;
    this.foilSweepSpeed = project.foilSweepSpeed ?? 1.0;
    this.foilFresnel = project.foilFresnel ?? 1.0;
    this.foilScale = project.foilScale ?? 1.0;
    this.foilTint.set(project.foilTint || '#ffffff');

    this.applyLightingPreset(project.lightingPreset);
    this.particles.setConfig(project.particlePreset, project.particleIntensity);

    const frameCfg = project.frame || createDefaultFrameConfig();
    this.frameAssembly.update(frameCfg, this.maxAniso);

    // Update core card proportions if frame proportion changed
    const dims = getCardDimensionsForProportion(frameCfg.proportion);
    this.cardCoreMesh.scale.set(dims.width / CARD_W, dims.height / CARD_H, 1);
    this.cardBackMesh.scale.set(dims.width / CARD_W, dims.height / CARD_H, 1);

    this.slabAssembly.group.visible = project.slab.enabled;
    const slabKey = JSON.stringify(project.slab);
    if (slabKey !== this.lastSlabKey) {
      this.lastSlabKey = slabKey;
      this.slabAssembly.updateLabel(project.slab, this.maxAniso);
    }

    const activeIds = new Set(project.layers.map((l) => l.id));

    for (const [id, node] of this.layerNodes.entries()) {
      if (!activeIds.has(id)) {
        this.layerGroup.remove(node.rootObject);
        node.gifController && (node.gifController.disposed = true);
        if (node.gifController?.timerId) clearTimeout(node.gifController.timerId);
        node.gifController?.texture.dispose();
        node.mesh?.geometry.dispose();
        node.mesh?.material.dispose();
        node.model3d?.dispose();
        this.layerNodes.delete(id);
      }
    }

    project.layers.forEach((layer, idx) => {
      this.syncLayerNode(layer, idx);
    });

    this.attachTransformControlsToSelected();
  }

  private async getOrLoadTextureAndAlpha(
    url: string
  ): Promise<{ tex: THREE.Texture; alpha: Uint8Array }> {
    const cachedTex = this.textureCache.get(url);
    const cachedAlpha = this.alphaCache.get(url);
    if (cachedTex && cachedAlpha) {
      return { tex: cachedTex, alpha: cachedAlpha };
    }

    const img = await loadImageElement(url);
    const tex = new THREE.Texture(img);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = this.maxAniso;
    tex.needsUpdate = true;

    const alpha = buildAlphaMaskFromImage(img);
    this.textureCache.set(url, tex);
    this.alphaCache.set(url, alpha);
    return { tex, alpha };
  }

  private async getOrLoadDepth(url: string): Promise<Float32Array> {
    const cached = this.depthCache.get(url);
    if (cached) return cached;

    const pixels = await sampleDepthMapPixels(url);
    this.depthCache.set(url, pixels);
    return pixels;
  }

  private applyDepthDisplacement(
    geometry: THREE.PlaneGeometry,
    depthPixels: Float32Array,
    scale: number
  ): void {
    const pos = geometry.attributes.position;
    const uvs = geometry.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const u = THREE.MathUtils.clamp(uvs.getX(i), 0, 1);
      const v = THREE.MathUtils.clamp(1 - uvs.getY(i), 0, 1);
      const px = Math.min(DEPTH_TEX_W - 1, Math.round(u * (DEPTH_TEX_W - 1)));
      const py = Math.min(DEPTH_TEX_H - 1, Math.round(v * (DEPTH_TEX_H - 1)));
      const d = depthPixels[py * DEPTH_TEX_W + px] ?? 0;
      pos.setZ(i, d * scale);
    }
    pos.needsUpdate = true;
    geometry.computeVertexNormals();
  }

  private syncLayerNode(layer: CardLayer, orderIndex: number): void {
    const desiredKind = layer.kind === 'model3d' ? 'model3d' : 'image';
    let node = this.layerNodes.get(layer.id);

    if (node && node.kind !== desiredKind) {
      this.layerGroup.remove(node.rootObject);
      node.mesh?.geometry.dispose();
      node.mesh?.material.dispose();
      node.model3d?.dispose();
      this.layerNodes.delete(layer.id);
      node = undefined;
    }

    if (!node && desiredKind === 'model3d') {
      const rootGroup = new THREE.Group();
      const modelKey = `${layer.modelFormat}:${layer.proceduralModelId || layer.modelUrl || 'crystal_gem'}`;

      node = {
        id: layer.id,
        kind: 'model3d',
        rootObject: rootGroup,
        modelKey,
        imageUrl: '',
        depthMapUrl: '',
        depthPixels: null,
        alphaMask: null,
        lastAppliedDisp: 0,
        lastMaterialKey: '',
        tex: null,
      };
      this.layerNodes.set(layer.id, node);
      this.layerGroup.add(rootGroup);

      const load3d = async () => {
        const loaded =
          layer.modelUrl &&
          (layer.modelFormat === 'glb' ||
            layer.modelFormat === 'gltf' ||
            layer.modelFormat === 'obj')
            ? await loadExternalModel3D(layer.modelUrl, layer.modelFormat)
            : buildProceduralModel3D(layer.proceduralModelId || 'crystal_gem');
        if (this.disposed) {
          loaded.dispose();
          return;
        }
        const cur = this.layerNodes.get(layer.id);
        if (!cur || cur.modelKey !== modelKey) {
          loaded.dispose();
          return;
        }
        cur.model3d = loaded;
        cur.rootObject.add(loaded.group);
      };
      load3d().catch(() => {
        // Fallback to procedural crystal if external model URL expired/invalid
        const fallback = buildProceduralModel3D('crystal_gem');
        const cur = this.layerNodes.get(layer.id);
        if (cur && !cur.model3d) {
          cur.model3d = fallback;
          cur.rootObject.add(fallback.group);
        } else {
          fallback.dispose();
        }
      });
    }

    if (!node && desiredKind === 'image') {
      const segX = this.isSoftwareGl ? 64 : 96;
      const segY = this.isSoftwareGl ? 90 : 134;
      const geo = new THREE.PlaneGeometry(CARD_W, CARD_H, segX, segY);

      const placeholderTex = new THREE.DataTexture(
        new Uint8Array([0, 0, 0, 0]),
        1,
        1,
        THREE.RGBAFormat
      );
      placeholderTex.needsUpdate = true;

      const foilUniforms: FoilUniforms = {
        uFoilTime: { value: 0 },
        uFoilStyle: { value: this.foilStyleIndex },
        uFoilIntensity: { value: this.foilIntensity },
        uFoilLayerWeight: { value: layer.foilWeight },
        uFoilColor: { value: new THREE.Color(layer.foilColor || '#ffffff') },
        uFoilScale: { value: layer.foilScale ?? this.foilScale },
        uFoilFresnel: { value: layer.fresnelIntensity ?? this.foilFresnel },
        uFoilSweepSpeed: { value: this.foilSweepSpeed },
      };

      const mat = createCardLayerMaterial(
        placeholderTex,
        layer.opacity,
        foilUniforms,
        layer.role === 'foreground' || layer.role === 'frame'
      );

      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = !this.isSoftwareGl;
      mesh.receiveShadow = !this.isSoftwareGl;

      node = {
        id: layer.id,
        kind: 'image',
        rootObject: mesh,
        mesh,
        foilUniforms,
        imageUrl: '',
        depthMapUrl: '',
        depthPixels: null,
        alphaMask: null,
        lastAppliedDisp: -999,
        lastMaterialKey: '',
        tex: null,
      };
      this.layerNodes.set(layer.id, node);
      this.layerGroup.add(mesh);
    }

    if (!node) return;

    node.rootObject.visible = layer.visible;
    node.rootObject.renderOrder = orderIndex + 1;
    if (!this.isTransformDragging || this.selectedLayerId !== layer.id) {
      node.rootObject.scale.set(
        layer.scale,
        layer.scale,
        node.kind === 'model3d' ? layer.scale : 1
      );
      node.rootObject.position.x = layer.offsetX;
      node.rootObject.position.y = layer.offsetY;
      node.rootObject.rotation.set(
        THREE.MathUtils.degToRad(layer.pitchDeg ?? 0),
        THREE.MathUtils.degToRad(layer.yawDeg ?? 0),
        THREE.MathUtils.degToRad(layer.rotationDeg),
        'YXZ'
      );
    }

    if (node.kind === 'image' && node.mesh && node.foilUniforms) {
      node.mesh.material.opacity = layer.opacity;
      node.mesh.material.blending =
        layer.blendMode === 'additive'
          ? THREE.AdditiveBlending
          : THREE.NormalBlending;

      const matKey = `${layer.materialFinish || 'standard'}:${layer.pbrTextureId || ''}:${layer.blendMode || 'normal'}`;
      if (matKey !== node.lastMaterialKey) {
        node.lastMaterialKey = matKey;
        applyMaterialFinishAndPbr(
          node.mesh.material,
          layer.materialFinish,
          layer.pbrTextureId,
          this.maxAniso,
          layer.role === 'foreground' || layer.role === 'frame'
        );
      }

      node.foilUniforms.uFoilStyle.value = this.foilStyleIndex;
      node.foilUniforms.uFoilIntensity.value = this.foilIntensity;
      node.foilUniforms.uFoilLayerWeight.value = layer.foilWeight;
      node.foilUniforms.uFoilColor.value
        .copy(this.foilTint)
        .multiply(new THREE.Color(layer.foilColor || '#ffffff'));
      node.foilUniforms.uFoilScale.value = (layer.foilScale ?? 1) * this.foilScale;
      node.foilUniforms.uFoilFresnel.value =
        (layer.fresnelIntensity ?? 1) * this.foilFresnel;
      node.foilUniforms.uFoilSweepSpeed.value = this.foilSweepSpeed;

      if (node.imageUrl !== layer.imageUrl) {
        const targetUrl = layer.imageUrl;
        node.imageUrl = targetUrl;

        if (node.gifController) {
          node.gifController.disposed = true;
          clearTimeout(node.gifController.timerId);
          node.gifController.texture.dispose();
          node.gifController = undefined;
        }

        if (layer.isAnimatedGif) {
          createAnimatedGifTexture(targetUrl, this.maxAniso).then((ctrl) => {
            if (this.disposed) {
              if (ctrl) {
                ctrl.disposed = true;
                ctrl.texture.dispose();
              }
              return;
            }
            const cur = this.layerNodes.get(layer.id);
            if (!cur || cur.imageUrl !== targetUrl || !cur.mesh) return;
            if (ctrl) {
              cur.gifController = ctrl;
              cur.mesh.material.map = ctrl.texture;
              cur.mesh.material.needsUpdate = true;
            }
          });
        }

        this.getOrLoadTextureAndAlpha(targetUrl)
          .then(({ tex, alpha }) => {
            if (this.disposed) return;
            const current = this.layerNodes.get(layer.id);
            if (!current || current.imageUrl !== targetUrl || !current.mesh) return;
            current.tex = tex;
            current.alphaMask = alpha;
            if (!current.gifController) {
              current.mesh.material.map = tex;
              current.mesh.material.needsUpdate = true;
            }
          })
          .catch(() => {
            // Ignore failed remote image decode
          });
      }

      if (node.depthMapUrl !== layer.depthMapUrl) {
        const targetDepthUrl = layer.depthMapUrl;
        node.depthMapUrl = targetDepthUrl;
        this.getOrLoadDepth(targetDepthUrl).then((pixels) => {
          if (this.disposed) return;
          const current = this.layerNodes.get(layer.id);
          if (!current || current.depthMapUrl !== targetDepthUrl || !current.mesh) return;
          current.depthPixels = pixels;
          current.lastAppliedDisp = layer.displacementScale;
          this.applyDepthDisplacement(
            current.mesh.geometry,
            pixels,
            layer.displacementScale
          );
        });
      } else if (
        node.depthPixels &&
        Math.abs(node.lastAppliedDisp - layer.displacementScale) > 0.0005
      ) {
        node.lastAppliedDisp = layer.displacementScale;
        this.applyDepthDisplacement(
          node.mesh.geometry,
          node.depthPixels,
          layer.displacementScale
        );
      }
    }
  }

  public updateLayerDepthLive(
    layerId: string,
    depthPixels: Float32Array,
    displacementScale: number
  ): void {
    const node = this.layerNodes.get(layerId);
    if (!node || !node.mesh) return;
    node.depthPixels = depthPixels;
    node.lastAppliedDisp = displacementScale;
    this.applyDepthDisplacement(node.mesh.geometry, depthPixels, displacementScale);
  }

  public capturePng(): string {
    return this.captureExport('png', 'tcg_750');
  }

  public captureExport(
    format: ExportFormat,
    dimension: ExportDimensionPreset
  ): string {
    const prevGizmo = this.gizmo.group.visible;
    const prevGuides = this.gizmo.guideGroup.visible;
    const prevTrans = this.transformHelper.visible;
    const prevShadow = this.contactShadow.visible;
    const prevBg = this.scene.background;
    const prevFog = this.scene.fog;

    const dims =
      dimension === 'slab_1800'
        ? { w: 1800, h: 2400 }
        : dimension === 'print_1500'
          ? { w: 1500, h: 2100 }
          : { w: 750, h: 1050 };

    const curSize = this.renderer.getSize(new THREE.Vector2());
    const curPixelRatio = this.renderer.getPixelRatio();
    const curAspect = this.camera.aspect;

    this.gizmo.group.visible = false;
    this.gizmo.guideGroup.visible = false;
    this.transformHelper.visible = false;

    const transparentBg = format === 'png_transparent';
    if (transparentBg) {
      this.scene.background = null;
      this.scene.fog = null;
      this.contactShadow.visible = false;
      this.renderer.setClearColor(0x000000, 0);
    }

    this.renderer.setPixelRatio(1);
    this.renderer.setSize(dims.w, dims.h, false);
    this.camera.aspect = dims.w / dims.h;
    this.camera.updateProjectionMatrix();

    this.renderer.render(this.scene, this.camera);

    const mime =
      format === 'jpeg'
        ? 'image/jpeg'
        : format === 'webp'
          ? 'image/webp'
          : 'image/png';
    const dataUrl = this.renderer.domElement.toDataURL(mime, 0.94);

    // Restore viewport
    this.renderer.setPixelRatio(curPixelRatio);
    this.renderer.setSize(curSize.x, curSize.y, false);
    this.camera.aspect = curAspect;
    this.camera.updateProjectionMatrix();

    this.scene.background = prevBg;
    this.scene.fog = prevFog;
    this.renderer.setClearColor(this.activeBgHex, 1);
    this.contactShadow.visible = prevShadow;
    this.gizmo.group.visible = prevGizmo;
    this.gizmo.guideGroup.visible = prevGuides;
    this.transformHelper.visible = prevTrans;

    this.renderer.render(this.scene, this.camera);
    return dataUrl;
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (gl && typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.disposed) return;
        const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    } else {
      this.frameId = window.setTimeout(cb, 80);
    }
  }

  private tick = (): void => {
    if (this.disposed) return;
    const delta = Math.min(0.05, this.clock.getDelta());
    const elapsed = this.clock.getElapsedTime();

    if (!this.contextLost) {
      this.currentCenterBias = THREE.MathUtils.damp(
        this.currentCenterBias,
        this.dockCenterBias,
        7,
        delta
      );

      if (this.interactionMode === 'tilt' && !this.viewerMode) {
        this.controls.target.set(0, this.currentCenterBias, 0);
        this.camera.lookAt(this._targetVec.set(0, this.currentCenterBias, 0));

        this.currentTilt.x = THREE.MathUtils.damp(
          this.currentTilt.x,
          this.targetTilt.x,
          9,
          delta
        );
        this.currentTilt.y = THREE.MathUtils.damp(
          this.currentTilt.y,
          this.targetTilt.y,
          9,
          delta
        );
        const idleBreathY = this.floatEnabled ? Math.sin(elapsed * 1.4) * 0.045 : 0;
        const idleBreathRot = this.floatEnabled ? Math.sin(elapsed * 0.9) * 0.04 : 0;
        this.cardRoot.rotation.x = this.currentTilt.x;
        this.cardRoot.rotation.y = this.currentTilt.y + idleBreathRot;
        this.cardRoot.position.y = idleBreathY;
      } else {
        this.controls.update();
        this.cardRoot.rotation.x = THREE.MathUtils.damp(
          this.cardRoot.rotation.x,
          0,
          8,
          delta
        );
        this.cardRoot.rotation.y = THREE.MathUtils.damp(
          this.cardRoot.rotation.y,
          0,
          8,
          delta
        );
        this.cardRoot.position.y =
          this.viewerMode && this.viewerTurntable
            ? Math.sin(elapsed * 1.4) * 0.04
            : this.floatEnabled && this.interactionMode === 'camera'
              ? Math.sin(elapsed * 1.4) * 0.03
              : THREE.MathUtils.damp(this.cardRoot.position.y, 0, 10, delta);
      }

      this.explodeCurrent = THREE.MathUtils.damp(
        this.explodeCurrent,
        this.explodeTarget,
        8,
        delta
      );

      const nLayers = Math.max(1, this.latestLayers.length);
      let selectedZ = 0;
      let selectedLayerObj: CardLayer | undefined;

      this.latestLayers.forEach((layer, idx) => {
        const node = this.layerNodes.get(layer.id);
        if (!node) return;
        const spread = (idx - (nLayers - 1) * 0.5) * 0.55 * this.explodeCurrent;
        const zWorld = layer.zOffset + spread;
        if (!this.isTransformDragging || this.selectedLayerId !== layer.id) {
          node.rootObject.position.z = zWorld;
        }
        if (node.foilUniforms) {
          node.foilUniforms.uFoilTime.value = elapsed * this.foilSpeed;
        }
        if (node.model3d?.mixer) {
          node.model3d.mixer.update(delta);
        } else if (node.kind === 'model3d' && this.viewerMode && this.viewerTurntable) {
          node.rootObject.rotation.y += delta * 0.35;
        }

        if (layer.id === this.selectedLayerId) {
          selectedZ = zWorld;
          selectedLayerObj = layer;
        }
      });

      this.gizmo.syncFromLayer(
        selectedLayerObj,
        selectedZ,
        !this.viewerMode && this.interactionMode === 'object'
      );

      this.particles.update(delta, elapsed);
      this.renderer.render(this.scene, this.camera);
    }

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  public dispose(): void {
    this.disposed = true;
    this.clearLongPress();
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    const dom = this.renderer.domElement;
    window.removeEventListener('resize', this.handleResize);
    dom.removeEventListener('pointerdown', this.handlePointerDown);
    dom.removeEventListener('pointermove', this.handlePointerMove);
    dom.removeEventListener('pointerup', this.handlePointerUp);
    dom.removeEventListener('pointercancel', this.handlePointerUp);
    dom.removeEventListener('pointerleave', this.handlePointerLeave);
    dom.removeEventListener('contextmenu', this.handleContextMenu);
    dom.removeEventListener('webglcontextlost', this.handleContextLost);
    dom.removeEventListener('webglcontextrestored', this.handleContextRestored);

    this.transformControls.detach();
    this.transformControls.disconnect();
    this.scene.remove(this.transformHelper);
    this.transformHelper.traverse((child) => {
      const m = child as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      if (m.material) {
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) mat.dispose();
      }
    });
    this.controls.dispose();
    this.frameAssembly.dispose();
    this.slabAssembly.dispose();
    this.particles.dispose();
    this.gizmo.dispose();

    for (const node of this.layerNodes.values()) {
      if (node.gifController) {
        node.gifController.disposed = true;
        clearTimeout(node.gifController.timerId);
        node.gifController.texture.dispose();
      }
      node.mesh?.geometry.dispose();
      node.mesh?.material.dispose();
      node.model3d?.dispose();
    }
    this.layerNodes.clear();

    for (const tex of this.textureCache.values()) {
      tex.dispose();
    }
    this.textureCache.clear();
    this.alphaCache.clear();
    this.depthCache.clear();

    this.cardCoreMesh.geometry.dispose();
    (this.cardCoreMesh.material as THREE.Material).dispose();
    this.cardBackMesh.geometry.dispose();
    (this.cardBackMesh.material as THREE.Material).dispose();
    this.contactShadow.geometry.dispose();
    (this.contactShadow.material as THREE.Material).dispose();

    this.renderer.dispose();
    if (dom.parentNode === this.container) {
      this.container.removeChild(dom);
    }
  }
}
