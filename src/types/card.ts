export type LayerRole =
  | 'background'
  | 'atmosphere'
  | 'secondary'
  | 'character'
  | 'foreground'
  | 'fx'
  | 'energy'
  | 'frame'
  | 'text';

export type LayerKind = 'image' | 'model3d' | 'frame';

export type LayerMaterialFinish =
  | 'standard'
  | 'metallic'
  | 'matte'
  | 'glossy'
  | 'holographic';

export type FoilStyle =
  | 'none'
  | 'prism'
  | 'cosmos'
  | 'etched_gold'
  | 'cracked_ice'
  | 'starlight';

export type ParticlePreset =
  | 'none'
  | 'embers'
  | 'lightning'
  | 'astral_dust'
  | 'sakura_wisps';

export type LightingPreset =
  | 'studio_gold'
  | 'moonlit_indigo'
  | 'crimson_forge'
  | 'gallery_daylight';

export type InteractionMode = 'camera' | 'object' | 'precision' | 'tilt';

export type TransformGizmoMode = 'translate' | 'rotate' | 'scale';

export type DockTab = 'layers' | 'assets' | 'frames' | 'foil' | 'slab';

export type RotationSnapStep = 0 | 5 | 15 | 45 | 90;

export interface SnapConfig {
  enabled: boolean;
  snapToCenter: boolean;
  snapToEdges: boolean;
  snapToGrid: boolean;
  snapToLayers: boolean;
  gridStep: number;
  tolerance: number;
  rotationStep: RotationSnapStep;
  scaleStep: number; // 0 = off, 0.05 or 0.1
}

export interface AssetAttribution {
  source: string;
  license: string;
  author?: string;
  url?: string;
  commercialOk: boolean;
  format: 'PNG' | 'GIF' | 'WebP' | 'GLB' | 'GLTF' | 'OBJ' | 'PBR';
}

export interface CardLayer {
  id: string;
  name: string;
  kind?: LayerKind;
  role: LayerRole;
  visible: boolean;
  locked?: boolean;
  groupId?: string;
  opacity: number;
  imageUrl: string;
  originalImageUrl: string;
  depthMapUrl: string;
  zOffset: number;
  displacementScale: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  rotationDeg: number;
  pitchDeg: number;
  yawDeg: number;
  foilWeight: number;
  foilColor?: string;
  foilScale?: number;
  fresnelIntensity?: number;
  embossStrength?: number;
  materialFinish?: LayerMaterialFinish;
  pbrTextureId?: string;
  blendMode?: 'normal' | 'additive';
  modelUrl?: string;
  modelFormat?: 'glb' | 'gltf' | 'obj' | 'procedural';
  proceduralModelId?: string;
  isAnimatedGif?: boolean;
  attribution?: AssetAttribution;
}

export type FrameStylePreset =
  | 'classic_vca'
  | 'full_art'
  | 'extended_art'
  | 'gold_metallic'
  | 'silver_metallic'
  | 'rainbow_holo'
  | 'obsidian'
  | 'electric_neon'
  | 'elemental_flame'
  | 'collector_crest';

export type CardProportionPreset = 'standard_tcg' | 'tall_showcase' | 'square_relic';

export interface FrameConfig {
  enabled: boolean;
  preset: FrameStylePreset;
  proportion: CardProportionPreset;
  borderThickness: number; // 10 - 48 px equivalent
  frameDepth: number; // 0.01 - 0.14 3D extrusion depth
  cornerRadius: number; // 4 - 44 px equivalent
  materialFinish: 'matte' | 'metallic' | 'holo' | 'obsidian' | 'neon';
  metallicIntensity: number; // 0 - 1
  holoIntensity: number; // 0 - 1
  innerFrameVisible: boolean;
  showTextPanels: boolean;
  windowOpacity: number; // 0 = transparent window, 0.2 = tinted glass
  borderColor: string;
  innerBorderColor: string;
  accentColor: string;
  title: string;
  powerLabel: string;
  subtitle: string;
  serial: string;
}

export interface SlabConfig {
  enabled: boolean;
  title: string;
  subtitle: string;
  grade: string;
  serial: string;
  accentColor: string;
}

export interface CardProject {
  schemaVersion?: number;
  id: string;
  name: string;
  artist: string;
  updatedAt?: number;
  layers: CardLayer[];
  foilStyle: FoilStyle;
  foilIntensity: number;
  foilSpeed: number;
  foilSweepSpeed?: number;
  foilFresnel?: number;
  foilScale?: number;
  foilTint?: string;
  particlePreset: ParticlePreset;
  particleIntensity: number;
  lightingPreset: LightingPreset;
  frame?: FrameConfig;
  slab: SlabConfig;
}

export type ExportFormat = 'png' | 'png_transparent' | 'jpeg' | 'webp';

export type ExportDimensionPreset = 'tcg_750' | 'print_1500' | 'slab_1800';
