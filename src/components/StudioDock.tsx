import React, { useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Brush,
  Camera,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Eye,
  EyeOff,
  FolderOpen,
  Layers,
  Lock,
  Magnet,
  Merge,
  Move,
  Redo2,
  RotateCcw,
  Save,
  Scissors,
  Search,
  Sliders,
  Sparkles,
  Trash2,
  Undo2,
  Unlock,
  Upload,
} from 'lucide-react';
import type {
  CardLayer,
  CardProject,
  DockTab,
  ExportDimensionPreset,
  ExportFormat,
  FoilStyle,
  FrameConfig,
  InteractionMode,
  LayerMaterialFinish,
  LayerRole,
  LightingPreset,
  ParticlePreset,
  RotationSnapStep,
  SnapConfig,
  TransformGizmoMode,
} from '../types/card';
import { PRESET_DECKS } from '../utils/artworkGenerators';
import { createDefaultFrameConfig } from '../utils/frameGenerator';
import { PBR_CATALOG } from '../utils/pbrTextures';
import type { SavedProjectSummary } from '../utils/projectStorage';
import { AssetSearchPanel, type AddAssetPayload } from './AssetSearchPanel';
import { DepthPainter } from './DepthPainter';
import { FrameBuilderPanel } from './FrameBuilderPanel';

interface StudioDockProps {
  project: CardProject;
  activeTab: DockTab;
  dockOpen: boolean;
  selectedLayerId: string;
  multiSelectedIds: string[];
  interactionMode: InteractionMode;
  gizmoMode: TransformGizmoMode;
  snapConfig: SnapConfig;
  viewerMode: boolean;
  viewerTurntable: boolean;
  cameraSensitivity: number;
  canUndo: boolean;
  canRedo: boolean;
  explodedFactor: number;
  floatEnabled: boolean;
  processingLabel: string | null;
  savedProjects: SavedProjectSummary[];
  exportFormat: ExportFormat;
  exportDimension: ExportDimensionPreset;
  layersSubView: 'inspector' | 'depth';
  onSetLayersSubView: (v: 'inspector' | 'depth') => void;
  onToggleDock: () => void;
  onSelectTab: (tab: DockTab) => void;
  onSelectLayer: (id: string) => void;
  onToggleMultiSelect: (id: string) => void;
  onGroupSelected: () => void;
  onUngroupLayer: (id: string) => void;
  onMergeSelected: () => void;
  onSelectPreset: (presetId: string) => void;
  onSetInteractionMode: (mode: InteractionMode) => void;
  onSetGizmoMode: (mode: TransformGizmoMode) => void;
  onUpdateSnapConfig: (patch: Partial<SnapConfig>) => void;
  onSetViewerMode: (enabled: boolean, turntable?: boolean) => void;
  onSetCameraSensitivity: (sens: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSetExplodedFactor: (factor: number) => void;
  onSetFloatEnabled: (enabled: boolean) => void;
  onResetCamera: () => void;
  onCameraPreset: (preset: 'front' | 'angle' | 'side' | 'back') => void;
  onImportFiles: (files: FileList) => void;
  onAddAssetLayer: (asset: AddAssetPayload) => void;
  onUpdateLayer: (id: string, patch: Partial<CardLayer>) => void;
  onMoveLayer: (id: string, dir: -1 | 1) => void;
  onDuplicateLayer: (id: string) => void;
  onDeleteLayer: (id: string) => void;
  onRemoveBg: (id: string, tolerance: number) => void;
  onRestoreOriginalBg: (id: string) => void;
  onAutoDepth: (id: string) => void;
  onLiveDepthPixels: (id: string, pixels: Float32Array) => void;
  onUpdateProject: (patch: Partial<CardProject>) => void;
  onUpdateFrame: (patch: Partial<FrameConfig>) => void;
  onAddFrameAsLayer: (framePngUrl: string, name: string) => void;
  onUpdateSlab: (patch: Partial<CardProject['slab']>) => void;
  onSetExportFormat: (fmt: ExportFormat) => void;
  onSetExportDimension: (dim: ExportDimensionPreset) => void;
  onTriggerExport: () => void;
  onSaveProjectSlot: () => void;
  onLoadProjectSlot: (id: string) => void;
  onDeleteProjectSlot: (id: string) => void;
  onExportProjectJson: () => void;
  onImportProjectJson: (file: File) => void;
}

const FOIL_OPTIONS: Array<{ id: FoilStyle; label: string; desc: string }> = [
  { id: 'none', label: 'Matte Print', desc: 'No holographic diffraction' },
  { id: 'prism', label: 'Prism Holo', desc: 'Diagonal rainbow spectrum' },
  { id: 'cosmos', label: 'Cosmos Galaxy', desc: 'Nebula sheen & star glints' },
  { id: 'etched_gold', label: 'Etched Gold', desc: 'Anisotropic gold line foil' },
  { id: 'cracked_ice', label: 'Cracked Ice', desc: 'Voronoi crystal facets' },
  { id: 'starlight', label: 'Starlight', desc: 'Fine micro-glitter sparkle' },
];

const LIGHTING_OPTIONS: Array<{ id: LightingPreset; label: string }> = [
  { id: 'studio_gold', label: 'Studio Gold' },
  { id: 'moonlit_indigo', label: 'Moonlit Indigo' },
  { id: 'crimson_forge', label: 'Crimson Forge' },
  { id: 'gallery_daylight', label: 'Gallery Daylight' },
];

const PARTICLE_OPTIONS: Array<{ id: ParticlePreset; label: string }> = [
  { id: 'none', label: 'None' },
  { id: 'astral_dust', label: 'Astral Dust' },
  { id: 'lightning', label: '3D Lightning' },
  { id: 'embers', label: 'Rising Embers' },
  { id: 'sakura_wisps', label: 'Sakura Wisps' },
];

const ROLE_OPTIONS: Array<{ id: LayerRole; label: string }> = [
  { id: 'background', label: 'Background' },
  { id: 'atmosphere', label: 'Atmosphere' },
  { id: 'secondary', label: 'Secondary' },
  { id: 'character', label: 'Character' },
  { id: 'foreground', label: 'Foreground' },
  { id: 'fx', label: 'FX / Aura' },
  { id: 'energy', label: 'Energy' },
  { id: 'frame', label: 'Frame' },
  { id: 'text', label: 'Text Plate' },
];

const MATERIAL_FINISHES: Array<{ id: LayerMaterialFinish; label: string }> = [
  { id: 'standard', label: 'Standard' },
  { id: 'metallic', label: 'Metallic Foil' },
  { id: 'glossy', label: 'High Gloss' },
  { id: 'matte', label: 'Matte Ink' },
  { id: 'holographic', label: 'Holographic' },
];

export const StudioDock: React.FC<StudioDockProps> = ({
  project,
  activeTab,
  dockOpen,
  selectedLayerId,
  multiSelectedIds,
  interactionMode,
  gizmoMode,
  snapConfig,
  viewerMode,
  viewerTurntable,
  cameraSensitivity,
  canUndo,
  canRedo,
  explodedFactor,
  floatEnabled,
  processingLabel,
  savedProjects,
  exportFormat,
  exportDimension,
  layersSubView,
  onSetLayersSubView,
  onToggleDock,
  onSelectTab,
  onSelectLayer,
  onToggleMultiSelect,
  onGroupSelected,
  onUngroupLayer,
  onMergeSelected,
  onSelectPreset,
  onSetInteractionMode,
  onSetGizmoMode,
  onUpdateSnapConfig,
  onSetViewerMode,
  onSetCameraSensitivity,
  onUndo,
  onRedo,
  onSetExplodedFactor,
  onSetFloatEnabled,
  onResetCamera,
  onCameraPreset,
  onImportFiles,
  onAddAssetLayer,
  onUpdateLayer,
  onMoveLayer,
  onDuplicateLayer,
  onDeleteLayer,
  onRemoveBg,
  onRestoreOriginalBg,
  onAutoDepth,
  onLiveDepthPixels,
  onUpdateProject,
  onUpdateFrame,
  onAddFrameAsLayer,
  onUpdateSlab,
  onSetExportFormat,
  onSetExportDimension,
  onTriggerExport,
  onSaveProjectSlot,
  onLoadProjectSlot,
  onDeleteProjectSlot,
  onExportProjectJson,
  onImportProjectJson,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const jsonInputRef = useRef<HTMLInputElement | null>(null);
  const [cutoutTolerance, setCutoutTolerance] = useState(38);
  const [snapMenuOpen, setSnapMenuOpen] = useState(false);

  const selectedLayer =
    project.layers.find((l) => l.id === selectedLayerId) || project.layers[0];

  const activeFrame = project.frame || createDefaultFrameConfig();

  return (
    <div
      className={`fixed left-1/2 -translate-x-1/2 bottom-4 z-20 w-[min(1160px,96vw)] transition-transform duration-200 ease-out ${
        dockOpen ? 'translate-y-0' : 'translate-y-[calc(100%-46px)]'
      }`}
    >
      {/* Snap Settings Floating Popover */}
      {snapMenuOpen && (
        <div className="absolute right-12 bottom-[calc(100%+8px)] z-40 w-72 rounded-xl bg-[#141824] border border-white/15 shadow-2xl p-3 space-y-2.5">
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
            <span className="text-xs font-semibold text-white">Magnetic Snapping</span>
            <button
              type="button"
              onClick={() => onUpdateSnapConfig({ enabled: !snapConfig.enabled })}
              className={`px-2 py-0.5 text-[10px] font-semibold rounded cursor-pointer ${
                snapConfig.enabled
                  ? 'bg-amber-400 text-slate-950'
                  : 'bg-white/10 text-slate-300'
              }`}
            >
              {snapConfig.enabled ? 'Enabled' : 'Off'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5 text-[11px]">
            {(
              [
                ['snapToCenter', 'Card Center'],
                ['snapToEdges', 'Card Edges'],
                ['snapToLayers', 'Other Layers'],
                ['snapToGrid', 'Show & Snap Grid'],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                className="flex items-center gap-1.5 text-slate-300 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={snapConfig[key]}
                  onChange={(e) => onUpdateSnapConfig({ [key]: e.target.checked })}
                  className="accent-amber-400"
                />
                <span>{label}</span>
              </label>
            ))}
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-slate-400">Snap Tolerance</span>
              <span className="font-mono-num text-amber-400">
                {snapConfig.tolerance.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min={0.03}
              max={0.2}
              step={0.01}
              value={snapConfig.tolerance}
              onChange={(e) =>
                onUpdateSnapConfig({ tolerance: Number(e.target.value) })
              }
              className="w-full studio-slider"
            />
          </div>

          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="text-slate-400">Angle Snap</span>
            <div className="flex items-center gap-1">
              {([0, 5, 15, 45, 90] as RotationSnapStep[]).map((deg) => (
                <button
                  key={deg}
                  type="button"
                  onClick={() => onUpdateSnapConfig({ rotationStep: deg })}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono-num cursor-pointer ${
                    snapConfig.rotationStep === deg
                      ? 'bg-amber-400 text-slate-950 font-semibold'
                      : 'bg-white/5 text-slate-300'
                  }`}
                >
                  {deg === 0 ? 'Off' : `${deg}°`}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Top Edge Strip: Deck Presets, Touch/Camera Modes, Undo/Redo, Snap, Viewer, Explode */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-t-xl bg-[#111520] border border-b-0 border-white/10">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {PRESET_DECKS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelectPreset(preset.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                project.id === preset.id
                  ? 'bg-amber-400 text-slate-950'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {/* Separated Touch / Mouse Modes: Camera vs Object vs Precision vs Tilt */}
          <div className="flex items-center p-0.5 bg-[#0B0D12] rounded-md border border-white/10">
            {(
              [
                ['camera', 'Camera'],
                ['object', 'Object'],
                ['precision', 'Precision'],
                ['tilt', 'Tilt'],
              ] as const
            ).map(([modeId, label]) => (
              <button
                key={modeId}
                type="button"
                onClick={() => {
                  if (viewerMode) onSetViewerMode(false);
                  onSetInteractionMode(modeId);
                }}
                className={`px-2 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                  !viewerMode && interactionMode === modeId
                    ? modeId === 'camera'
                      ? 'bg-sky-400 text-slate-950 font-semibold'
                      : 'bg-amber-400 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Undo / Redo */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              disabled={!canUndo}
              onClick={onUndo}
              title="Undo (Ctrl+Z)"
              className="p-1.5 rounded-md bg-white/5 hover:bg-white/10 text-slate-200 disabled:opacity-35 border border-white/10 cursor-pointer disabled:cursor-default"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={!canRedo}
              onClick={onRedo}
              title="Redo (Ctrl+Shift+Z)"
              className="p-1.5 rounded-md bg-white/5 hover:bg-white/10 text-slate-200 disabled:opacity-35 border border-white/10 cursor-pointer disabled:cursor-default"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Snap Toggle & Settings */}
          <button
            type="button"
            onClick={() => setSnapMenuOpen((v) => !v)}
            title="Magnetic Snapping & Grid Settings"
            className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md border cursor-pointer whitespace-nowrap ${
              snapConfig.enabled
                ? 'bg-amber-400/15 border-amber-400/50 text-amber-300'
                : 'bg-white/5 border-white/10 text-slate-400'
            }`}
          >
            <Magnet className="w-3 h-3" />
            Snap
          </button>

          {/* 3D Viewer Showcase Toggle */}
          <button
            type="button"
            onClick={() => onSetViewerMode(!viewerMode, !viewerMode)}
            className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md border cursor-pointer whitespace-nowrap ${
              viewerMode
                ? 'bg-emerald-400/20 border-emerald-400/60 text-emerald-300'
                : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
            }`}
          >
            <Camera className="w-3 h-3" />
            {viewerMode ? 'Exit Viewer' : '3D Viewer'}
          </button>

          <button
            type="button"
            onClick={() => onSetExplodedFactor(explodedFactor > 0.1 ? 0 : 0.75)}
            className={`px-2 py-1 text-[11px] font-medium rounded-md border transition-colors cursor-pointer whitespace-nowrap ${
              explodedFactor > 0.1
                ? 'bg-amber-400/20 border-amber-400/60 text-amber-300'
                : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
            }`}
          >
            Explode
          </button>

          <button
            type="button"
            onClick={onResetCamera}
            title="Reset Camera (R)"
            className="p-1.5 text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-md border border-white/10 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onToggleDock}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md bg-white/10 hover:bg-white/15 text-slate-100 border border-white/10 cursor-pointer whitespace-nowrap"
          >
            {dockOpen ? (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Hide</span>
              </>
            ) : (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Studio</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Dock Panel */}
      <div className="rounded-b-xl bg-[#121622] border border-white/10 shadow-2xl overflow-hidden">
        {/* Mobile Tab Strip */}
        <div className="flex md:hidden items-center gap-1 px-3 py-2 border-b border-white/10 overflow-x-auto">
          {(
            [
              ['layers', 'Layers'],
              ['assets', 'Assets'],
              ['frames', 'Frames'],
              ['foil', 'Foil & FX'],
              ['slab', 'Slab & Export'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => onSelectTab(id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap cursor-pointer ${
                activeTab === id
                  ? 'bg-amber-400 text-slate-950'
                  : 'text-slate-300 bg-white/5'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Context Mode Strip: Precision Gizmo Switcher / Viewer Turntable / Object Lock & Reset */}
        {viewerMode ? (
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-1.5 bg-[#0D1018] border-b border-white/10 text-[11px] text-slate-300">
            <span>3D Collectible Showcase Mode · Drag to inspect lighting &amp; foil reflections</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onSetViewerMode(true, !viewerTurntable)}
                className={`px-2 py-0.5 rounded border cursor-pointer ${
                  viewerTurntable
                    ? 'bg-emerald-400 text-slate-950 border-emerald-400 font-semibold'
                    : 'bg-white/5 text-slate-300 border-white/10'
                }`}
              >
                {viewerTurntable ? 'Turntable On' : 'Turntable Off'}
              </button>
              <button
                type="button"
                onClick={() => onSetViewerMode(false)}
                className="text-amber-400 hover:text-amber-300 font-medium cursor-pointer"
              >
                Return to Editor
              </button>
            </div>
          </div>
        ) : interactionMode === 'precision' && selectedLayer ? (
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-1.5 bg-[#0D1018] border-b border-white/10 text-[11px] text-slate-300">
            <div className="flex items-center gap-2">
              <Move className="w-3.5 h-3.5 text-amber-400" />
              <span>
                Precision Gizmo: <strong className="text-white">{selectedLayer.name}</strong>
              </span>
              <div className="flex items-center gap-1 ml-1 bg-[#141824] p-0.5 rounded border border-white/10">
                {(
                  [
                    ['translate', 'Move'],
                    ['rotate', 'Rotate'],
                    ['scale', 'Scale'],
                  ] as const
                ).map(([gm, label]) => (
                  <button
                    key={gm}
                    type="button"
                    onClick={() => onSetGizmoMode(gm)}
                    className={`px-2 py-0.5 rounded text-[10px] cursor-pointer ${
                      gizmoMode === gm
                        ? 'bg-amber-400 text-slate-950 font-semibold'
                        : 'text-slate-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                onUpdateLayer(selectedLayer.id, {
                  offsetX: 0,
                  offsetY: 0,
                  scale: 1,
                  rotationDeg: 0,
                  pitchDeg: 0,
                  yawDeg: 0,
                })
              }
              className="text-amber-400 hover:text-amber-300 font-medium cursor-pointer"
            >
              Reset Transform
            </button>
          </div>
        ) : interactionMode === 'object' && selectedLayer ? (
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-1.5 bg-[#0D1018] border-b border-white/10 text-[11px] text-slate-400">
            <span>
              Object Edit:{' '}
              <strong className="text-slate-200">{selectedLayer.name}</strong>
              {selectedLayer.locked ? ' (Locked)' : ' · Empty canvas orbits camera · Object drags with magnetic snap · Long-press for menu'}
            </span>
            <button
              type="button"
              onClick={() =>
                onUpdateLayer(selectedLayer.id, {
                  offsetX: 0,
                  offsetY: 0,
                  scale: 1,
                  rotationDeg: 0,
                  pitchDeg: 0,
                  yawDeg: 0,
                })
              }
              className="text-amber-400 hover:text-amber-300 font-medium cursor-pointer whitespace-nowrap"
            >
              Reset Transform
            </button>
          </div>
        ) : null}

        <div className="p-4 max-h-[296px] overflow-y-auto studio-scroll">
          {processingLabel && (
            <div className="mb-3 px-3 py-1.5 text-xs text-amber-300 bg-amber-500/10 border border-amber-400/25 rounded-lg">
              {processingLabel}
            </div>
          )}

          {/* TAB 1: LAYERS & DEPTH PAINT */}
          {activeTab === 'layers' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/10">
                <div className="flex items-center gap-1 p-0.5 bg-[#0B0D12] rounded-lg border border-white/10">
                  <button
                    type="button"
                    onClick={() => onSetLayersSubView('inspector')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md cursor-pointer ${
                      layersSubView === 'inspector'
                        ? 'bg-amber-400 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    Layers &amp; Transform
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetLayersSubView('depth')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md cursor-pointer ${
                      layersSubView === 'depth'
                        ? 'bg-amber-400 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Brush className="w-3.5 h-3.5" />
                    Sculpt Depth Map
                  </button>
                </div>

                {multiSelectedIds.length >= 2 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-amber-300">
                      {multiSelectedIds.length} selected:
                    </span>
                    <button
                      type="button"
                      onClick={onGroupSelected}
                      className="px-2.5 py-1 text-[11px] font-medium rounded bg-white/10 hover:bg-white/15 text-white border border-white/10 cursor-pointer"
                    >
                      Group Layers
                    </button>
                    <button
                      type="button"
                      onClick={onMergeSelected}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded bg-amber-400 text-slate-950 cursor-pointer"
                    >
                      <Merge className="w-3 h-3" />
                      Merge PNG
                    </button>
                  </div>
                )}
              </div>

              {layersSubView === 'depth' ? (
                <DepthPainter
                  layer={selectedLayer}
                  onLiveDepthPixels={onLiveDepthPixels}
                  onCommitDepthUrl={(id, url) =>
                    onUpdateLayer(id, { depthMapUrl: url })
                  }
                  onAutoDepth={onAutoDepth}
                  onUpdateLayer={onUpdateLayer}
                />
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  {/* Layer Hierarchy List */}
                  <div className="lg:col-span-5 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-300 inline-flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-amber-400" />
                        Layer Hierarchy ({project.layers.length})
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onSelectTab('assets')}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md bg-white/10 hover:bg-white/15 text-slate-100 border border-white/10 cursor-pointer whitespace-nowrap"
                        >
                          <Search className="w-3 h-3 text-amber-400" />
                          Assets
                        </button>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md bg-amber-400 hover:bg-amber-300 text-slate-950 cursor-pointer whitespace-nowrap"
                        >
                          <Upload className="w-3 h-3" />
                          Import
                        </button>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,.gif,.webp,.glb,.gltf,.obj"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            onImportFiles(e.target.files);
                            e.target.value = '';
                          }
                        }}
                      />
                    </div>

                    <div className="space-y-1.5 max-h-[192px] overflow-y-auto studio-scroll pr-1">
                      {[...project.layers].reverse().map((layer) => {
                        const isSelected = selectedLayer?.id === layer.id;
                        const isMulti = multiSelectedIds.includes(layer.id);
                        return (
                          <div
                            key={layer.id}
                            onClick={() => onSelectLayer(layer.id)}
                            className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg border cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-white/10 border-amber-400/60'
                                : 'bg-[#0B0D12]/80 border-white/8 hover:border-white/20'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <input
                                type="checkbox"
                                checked={isMulti}
                                title="Select for Group or Merge"
                                onClick={(e) => e.stopPropagation()}
                                onChange={() => onToggleMultiSelect(layer.id)}
                                className="accent-amber-400 shrink-0 cursor-pointer"
                              />
                              <img
                                src={layer.imageUrl}
                                alt={layer.name}
                                className="w-6 h-9 object-contain rounded bg-black/50 border border-white/10 shrink-0"
                              />
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-slate-100 truncate">
                                  {layer.name}
                                </p>
                                <p className="text-[10px] text-slate-400 font-mono-num truncate">
                                  {layer.kind === 'model3d' ? '3D' : layer.role} · Z{' '}
                                  {layer.zOffset >= 0 ? '+' : ''}
                                  {layer.zOffset.toFixed(2)}
                                  {layer.groupId ? ' · Grouped' : ''}
                                  {layer.locked ? ' · Locked' : ''}
                                </p>
                              </div>
                            </div>

                            <div
                              className="flex items-center gap-0.5 shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                title={layer.locked ? 'Unlock Layer' : 'Lock Layer'}
                                onClick={() =>
                                  onUpdateLayer(layer.id, { locked: !layer.locked })
                                }
                                className={`p-1 rounded hover:bg-white/10 cursor-pointer ${
                                  layer.locked ? 'text-amber-400' : 'text-slate-500'
                                }`}
                              >
                                {layer.locked ? (
                                  <Lock className="w-3 h-3" />
                                ) : (
                                  <Unlock className="w-3 h-3" />
                                )}
                              </button>
                              <button
                                type="button"
                                title="Toggle Visibility"
                                onClick={() =>
                                  onUpdateLayer(layer.id, { visible: !layer.visible })
                                }
                                className="p-1 rounded hover:bg-white/10 text-slate-300 cursor-pointer"
                              >
                                {layer.visible ? (
                                  <Eye className="w-3.5 h-3.5" />
                                ) : (
                                  <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                                )}
                              </button>
                              <button
                                type="button"
                                title="Move Forward"
                                onClick={() => onMoveLayer(layer.id, 1)}
                                className="p-1 rounded hover:bg-white/10 text-slate-300 cursor-pointer"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                title="Move Backward"
                                onClick={() => onMoveLayer(layer.id, -1)}
                                className="p-1 rounded hover:bg-white/10 text-slate-300 cursor-pointer"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                title="Duplicate Layer"
                                onClick={() => onDuplicateLayer(layer.id)}
                                className="p-1 rounded hover:bg-white/10 text-slate-300 cursor-pointer"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              {project.layers.length > 1 && (
                                <button
                                  type="button"
                                  title="Delete Layer"
                                  onClick={() => onDeleteLayer(layer.id)}
                                  className="p-1 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-300 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Selected Layer Inspector */}
                  {selectedLayer && (
                    <div className="lg:col-span-7 bg-[#0B0D12]/60 border border-white/10 rounded-lg p-3 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                          <input
                            type="text"
                            value={selectedLayer.name}
                            onChange={(e) =>
                              onUpdateLayer(selectedLayer.id, { name: e.target.value })
                            }
                            className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs font-medium text-slate-100 w-32 focus:outline-none focus:border-amber-400"
                          />
                          <select
                            value={selectedLayer.role}
                            onChange={(e) =>
                              onUpdateLayer(selectedLayer.id, {
                                role: e.target.value as LayerRole,
                              })
                            }
                            className="bg-[#161A26] border border-white/10 rounded px-1.5 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-amber-400"
                          >
                            {ROLE_OPTIONS.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.label}
                              </option>
                            ))}
                          </select>

                          {(!selectedLayer.kind || selectedLayer.kind === 'image') && (
                            <>
                              <select
                                value={selectedLayer.materialFinish || 'standard'}
                                onChange={(e) =>
                                  onUpdateLayer(selectedLayer.id, {
                                    materialFinish: e.target.value as LayerMaterialFinish,
                                  })
                                }
                                title="Material Surface Finish"
                                className="bg-[#161A26] border border-white/10 rounded px-1.5 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-amber-400"
                              >
                                {MATERIAL_FINISHES.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.label}
                                  </option>
                                ))}
                              </select>
                              <select
                                value={selectedLayer.pbrTextureId || ''}
                                onChange={(e) =>
                                  onUpdateLayer(selectedLayer.id, {
                                    pbrTextureId: e.target.value || undefined,
                                  })
                                }
                                title="Poly Haven PBR Surface Map"
                                className="bg-[#161A26] border border-white/10 rounded px-1.5 py-1 text-[11px] text-amber-300 focus:outline-none focus:border-amber-400 max-w-[110px]"
                              >
                                <option value="">No PBR Map</option>
                                {PBR_CATALOG.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name}
                                  </option>
                                ))}
                              </select>
                            </>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          {selectedLayer.groupId && (
                            <button
                              type="button"
                              onClick={() => onUngroupLayer(selectedLayer.id)}
                              className="px-2 py-1 text-[11px] rounded bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 cursor-pointer"
                            >
                              Ungroup
                            </button>
                          )}
                          {(!selectedLayer.kind || selectedLayer.kind === 'image') && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateLayer(selectedLayer.id, {
                                    blendMode:
                                      selectedLayer.blendMode === 'additive'
                                        ? 'normal'
                                        : 'additive',
                                  })
                                }
                                title="Toggle Additive Light Blend"
                                className={`px-2 py-1 text-[11px] rounded border cursor-pointer ${
                                  selectedLayer.blendMode === 'additive'
                                    ? 'bg-amber-400/20 border-amber-400/60 text-amber-300'
                                    : 'bg-white/5 border-white/10 text-slate-300'
                                }`}
                              >
                                {selectedLayer.blendMode === 'additive' ? 'Add' : 'Norm'}
                              </button>
                              <button
                                type="button"
                                onClick={() => onRemoveBg(selectedLayer.id, cutoutTolerance)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded bg-white/10 hover:bg-white/15 text-slate-100 border border-white/10 cursor-pointer whitespace-nowrap"
                              >
                                <Scissors className="w-3 h-3 text-amber-400" />
                                Cutout
                              </button>
                              {selectedLayer.imageUrl !== selectedLayer.originalImageUrl && (
                                <button
                                  type="button"
                                  onClick={() => onRestoreOriginalBg(selectedLayer.id)}
                                  className="px-2 py-1 text-[11px] rounded bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 cursor-pointer"
                                >
                                  Orig
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => onAutoDepth(selectedLayer.id)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded bg-white/10 hover:bg-white/15 text-slate-100 border border-white/10 cursor-pointer whitespace-nowrap"
                              >
                                <Sparkles className="w-3 h-3 text-amber-400" />
                                Depth
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-x-3 gap-y-2">
                        <div>
                          <div className="flex justify-between text-[11px] mb-1">
                            <span className="text-slate-400">Z-Depth</span>
                            <span className="font-mono-num text-slate-200">
                              {selectedLayer.zOffset.toFixed(2)}
                            </span>
                          </div>
                          <input
                            type="range"
                            min={-0.18}
                            max={0.45}
                            step={0.01}
                            value={selectedLayer.zOffset}
                            onChange={(e) =>
                              onUpdateLayer(selectedLayer.id, {
                                zOffset: Number(e.target.value),
                              })
                            }
                            className="w-full studio-slider"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between text-[11px] mb-1">
                            <span className="text-slate-400">3D Pop-Out</span>
                            <span className="font-mono-num text-amber-400">
                              {selectedLayer.displacementScale.toFixed(2)}
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={0.45}
                            step={0.01}
                            value={selectedLayer.displacementScale}
                            onChange={(e) =>
                              onUpdateLayer(selectedLayer.id, {
                                displacementScale: Number(e.target.value),
                              })
                            }
                            className="w-full studio-slider"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between text-[11px] mb-1">
                            <span className="text-slate-400">Scale</span>
                            <span className="font-mono-num text-slate-200">
                              {Math.round(selectedLayer.scale * 100)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0.2}
                            max={2.4}
                            step={0.02}
                            value={selectedLayer.scale}
                            onChange={(e) =>
                              onUpdateLayer(selectedLayer.id, {
                                scale: Number(e.target.value),
                              })
                            }
                            className="w-full studio-slider"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between text-[11px] mb-1">
                            <span className="text-slate-400">Pitch (X)</span>
                            <span className="font-mono-num text-violet-300">
                              {selectedLayer.pitchDeg ?? 0}°
                            </span>
                          </div>
                          <input
                            type="range"
                            min={-65}
                            max={65}
                            step={1}
                            value={selectedLayer.pitchDeg ?? 0}
                            onChange={(e) =>
                              onUpdateLayer(selectedLayer.id, {
                                pitchDeg: Number(e.target.value),
                              })
                            }
                            className="w-full studio-slider"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between text-[11px] mb-1">
                            <span className="text-slate-400">Yaw (Y)</span>
                            <span className="font-mono-num text-violet-300">
                              {selectedLayer.yawDeg ?? 0}°
                            </span>
                          </div>
                          <input
                            type="range"
                            min={-65}
                            max={65}
                            step={1}
                            value={selectedLayer.yawDeg ?? 0}
                            onChange={(e) =>
                              onUpdateLayer(selectedLayer.id, {
                                yawDeg: Number(e.target.value),
                              })
                            }
                            className="w-full studio-slider"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between text-[11px] mb-1">
                            <span className="text-slate-400">Offset X</span>
                            <span className="font-mono-num text-slate-200">
                              {selectedLayer.offsetX.toFixed(2)}
                            </span>
                          </div>
                          <input
                            type="range"
                            min={-1.8}
                            max={1.8}
                            step={0.02}
                            value={selectedLayer.offsetX}
                            onChange={(e) =>
                              onUpdateLayer(selectedLayer.id, {
                                offsetX: Number(e.target.value),
                              })
                            }
                            className="w-full studio-slider"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between text-[11px] mb-1">
                            <span className="text-slate-400">Offset Y</span>
                            <span className="font-mono-num text-slate-200">
                              {selectedLayer.offsetY.toFixed(2)}
                            </span>
                          </div>
                          <input
                            type="range"
                            min={-2.2}
                            max={2.2}
                            step={0.02}
                            value={selectedLayer.offsetY}
                            onChange={(e) =>
                              onUpdateLayer(selectedLayer.id, {
                                offsetY: Number(e.target.value),
                              })
                            }
                            className="w-full studio-slider"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between text-[11px] mb-1">
                            <span className="text-slate-400">Roll (Z)</span>
                            <span className="font-mono-num text-slate-200">
                              {selectedLayer.rotationDeg}°
                            </span>
                          </div>
                          <input
                            type="range"
                            min={-180}
                            max={180}
                            step={1}
                            value={selectedLayer.rotationDeg}
                            onChange={(e) =>
                              onUpdateLayer(selectedLayer.id, {
                                rotationDeg: Number(e.target.value),
                              })
                            }
                            className="w-full studio-slider"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between text-[11px] mb-1">
                            <span className="text-slate-400">Opacity</span>
                            <span className="font-mono-num text-slate-200">
                              {Math.round(selectedLayer.opacity * 100)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.02}
                            value={selectedLayer.opacity}
                            onChange={(e) =>
                              onUpdateLayer(selectedLayer.id, {
                                opacity: Number(e.target.value),
                              })
                            }
                            className="w-full studio-slider"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between text-[11px] mb-1">
                            <span className="text-slate-400">Tol / Foil / Tint</span>
                            <span className="font-mono-num text-slate-200">
                              {cutoutTolerance}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <input
                              type="range"
                              title="BG Cutout Tolerance"
                              min={10}
                              max={95}
                              value={cutoutTolerance}
                              onChange={(e) => setCutoutTolerance(Number(e.target.value))}
                              className="w-1/2 studio-slider"
                            />
                            <input
                              type="range"
                              title="Layer Foil Weight"
                              min={0}
                              max={1.5}
                              step={0.05}
                              value={selectedLayer.foilWeight}
                              onChange={(e) =>
                                onUpdateLayer(selectedLayer.id, {
                                  foilWeight: Number(e.target.value),
                                })
                              }
                              className="w-1/2 studio-slider"
                            />
                            <input
                              type="color"
                              title="Layer Foil Tint"
                              value={selectedLayer.foilColor || '#ffffff'}
                              onChange={(e) =>
                                onUpdateLayer(selectedLayer.id, {
                                  foilColor: e.target.value,
                                })
                              }
                              className="w-5 h-5 rounded border border-white/15 bg-transparent cursor-pointer shrink-0"
                            />
                          </div>
                        </div>
                      </div>

                      {selectedLayer.attribution && (
                        <div className="text-[10px] text-slate-400 pt-0.5 truncate">
                          Source: {selectedLayer.attribution.source} · {selectedLayer.attribution.license} · {selectedLayer.attribution.format}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SEARCHABLE MULTI-SOURCE ASSET & POKEMON LIBRARY */}
          {activeTab === 'assets' && (
            <AssetSearchPanel
              selectedLayerName={selectedLayer?.name}
              onAddAssetLayer={onAddAssetLayer}
              onApplyPbrToSelected={(pbrId, pbrName) => {
                if (selectedLayer) {
                  onUpdateLayer(selectedLayer.id, {
                    pbrTextureId: pbrId,
                    materialFinish: 'metallic',
                    foilWeight: Math.max(0.8, selectedLayer.foilWeight),
                  });
                }
                void pbrName;
              }}
              onImportFiles={onImportFiles}
            />
          )}

          {/* TAB 3: ORIGINAL VCA 3D CARD FRAME STUDIO */}
          {activeTab === 'frames' && (
            <FrameBuilderPanel
              frame={activeFrame}
              onUpdateFrame={onUpdateFrame}
              onAddFrameAsLayer={onAddFrameAsLayer}
            />
          )}

          {/* TAB 4: FOIL, HOLOGRAPHIC SHADERS, LIGHTING & PARTICLES */}
          {activeTab === 'foil' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-5">
                <span className="block text-xs font-semibold text-slate-300 mb-2">
                  Holographic Foil Shader
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {FOIL_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onUpdateProject({ foilStyle: opt.id })}
                      className={`text-left px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                        project.foilStyle === opt.id
                          ? 'bg-amber-400/15 border-amber-400 text-white'
                          : 'bg-[#0B0D12]/80 border-white/10 text-slate-300 hover:border-white/25'
                      }`}
                    >
                      <div className="text-[11px] font-semibold truncate">{opt.label}</div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {opt.desc}
                      </div>
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2.5 mt-2.5">
                  <div>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-slate-400">Foil Power</span>
                      <span className="font-mono-num text-amber-400">
                        {Math.round(project.foilIntensity * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1.4}
                      step={0.05}
                      value={project.foilIntensity}
                      onChange={(e) =>
                        onUpdateProject({ foilIntensity: Number(e.target.value) })
                      }
                      className="w-full studio-slider"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-slate-400">Shimmer</span>
                      <span className="font-mono-num text-slate-200">
                        {project.foilSpeed.toFixed(1)}x
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={2.5}
                      step={0.1}
                      value={project.foilSpeed}
                      onChange={(e) =>
                        onUpdateProject({ foilSpeed: Number(e.target.value) })
                      }
                      className="w-full studio-slider"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-slate-400">Fresnel Rim</span>
                      <span className="font-mono-num text-slate-200">
                        {(project.foilFresnel ?? 1).toFixed(1)}x
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={2.2}
                      step={0.1}
                      value={project.foilFresnel ?? 1}
                      onChange={(e) =>
                        onUpdateProject({ foilFresnel: Number(e.target.value) })
                      }
                      className="w-full studio-slider"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-slate-400">Sweep Beam</span>
                      <span className="font-mono-num text-slate-200">
                        {(project.foilSweepSpeed ?? 1).toFixed(1)}x
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={2.5}
                      step={0.1}
                      value={project.foilSweepSpeed ?? 1}
                      onChange={(e) =>
                        onUpdateProject({ foilSweepSpeed: Number(e.target.value) })
                      }
                      className="w-full studio-slider"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-slate-400">Foil Scale</span>
                      <span className="font-mono-num text-slate-200">
                        {(project.foilScale ?? 1).toFixed(1)}x
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.4}
                      max={2.4}
                      step={0.1}
                      value={project.foilScale ?? 1}
                      onChange={(e) =>
                        onUpdateProject({ foilScale: Number(e.target.value) })
                      }
                      className="w-full studio-slider"
                    />
                  </div>
                  <div className="flex items-end justify-between gap-2">
                    <span className="text-[10px] text-slate-400 pb-1">Foil Tint</span>
                    <input
                      type="color"
                      value={project.foilTint || '#ffffff'}
                      onChange={(e) => onUpdateProject({ foilTint: e.target.value })}
                      className="w-8 h-6 rounded border border-white/15 bg-transparent cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <div className="lg:col-span-3 space-y-2">
                <span className="block text-xs font-semibold text-slate-300">
                  Studio Lighting &amp; Camera
                </span>
                <div className="grid grid-cols-1 gap-1.5">
                  {LIGHTING_OPTIONS.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => onUpdateProject({ lightingPreset: l.id })}
                      className={`px-2.5 py-1.5 text-xs font-medium rounded-md border text-left transition-colors cursor-pointer whitespace-nowrap ${
                        project.lightingPreset === l.id
                          ? 'bg-white/15 border-amber-400/70 text-white'
                          : 'bg-[#0B0D12]/80 border-white/10 text-slate-300 hover:border-white/25'
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
                <div className="pt-1">
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-slate-400">Camera Sensitivity</span>
                    <span className="font-mono-num text-slate-200">
                      {cameraSensitivity.toFixed(1)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.4}
                    max={2.0}
                    step={0.1}
                    value={cameraSensitivity}
                    onChange={(e) => onSetCameraSensitivity(Number(e.target.value))}
                    className="w-full studio-slider"
                  />
                </div>
              </div>

              <div className="lg:col-span-4 space-y-2.5">
                <span className="block text-xs font-semibold text-slate-300">
                  3D Particles &amp; Energy Field
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {PARTICLE_OPTIONS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onUpdateProject({ particlePreset: p.id })}
                      className={`px-2 py-1.5 text-[11px] font-medium rounded-md border transition-colors cursor-pointer whitespace-nowrap truncate ${
                        project.particlePreset === p.id
                          ? 'bg-amber-400/15 border-amber-400 text-white'
                          : 'bg-[#0B0D12]/80 border-white/10 text-slate-300 hover:border-white/25'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-slate-400">FX Density</span>
                      <span className="font-mono-num text-amber-400">
                        {Math.round(project.particleIntensity * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1.2}
                      step={0.05}
                      value={project.particleIntensity}
                      onChange={(e) =>
                        onUpdateProject({ particleIntensity: Number(e.target.value) })
                      }
                      className="w-full studio-slider"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-slate-400">Exploded Z</span>
                      <span className="font-mono-num text-slate-200">
                        {Math.round(explodedFactor * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.02}
                      value={explodedFactor}
                      onChange={(e) => onSetExplodedFactor(Number(e.target.value))}
                      className="w-full studio-slider"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-0.5">
                  <span className="text-xs text-slate-300">Hover Levitation</span>
                  <button
                    type="button"
                    onClick={() => onSetFloatEnabled(!floatEnabled)}
                    className={`px-3 py-1 text-xs font-medium rounded-md border cursor-pointer ${
                      floatEnabled
                        ? 'bg-amber-400 text-slate-950 border-amber-400'
                        : 'bg-white/5 text-slate-300 border-white/10'
                    }`}
                  >
                    {floatEnabled ? 'Active' : 'Locked'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: VCA SLAB, MULTI-FORMAT EXPORTER & SAVED PROJECTS MANAGER */}
          {activeTab === 'slab' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* VCA Slab Configuration */}
              <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="flex items-center justify-between sm:col-span-2 pb-1 border-b border-white/10">
                  <div>
                    <span className="text-xs font-semibold text-slate-200">
                      VCA Graded Slab Case
                    </span>
                    <span className="ml-2 text-[10px] text-slate-400">
                      Acrylic housing &amp; label
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onUpdateSlab({ enabled: !project.slab.enabled })}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-md cursor-pointer ${
                      project.slab.enabled
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-white/10 text-slate-200'
                    }`}
                  >
                    {project.slab.enabled ? 'Slab Enabled' : 'Raw Card Only'}
                  </button>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">
                    Slab Header Title
                  </label>
                  <input
                    type="text"
                    value={project.slab.title}
                    onChange={(e) => onUpdateSlab({ title: e.target.value })}
                    className="w-full bg-[#0B0D12] border border-white/10 rounded-md px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">
                    Edition Subtitle
                  </label>
                  <input
                    type="text"
                    value={project.slab.subtitle}
                    onChange={(e) => onUpdateSlab({ subtitle: e.target.value })}
                    className="w-full bg-[#0B0D12] border border-white/10 rounded-md px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">
                    Grade Label
                  </label>
                  <input
                    type="text"
                    value={project.slab.grade}
                    onChange={(e) => onUpdateSlab({ grade: e.target.value })}
                    className="w-full bg-[#0B0D12] border border-white/10 rounded-md px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="flex gap-1.5">
                  <div className="flex-1">
                    <label className="block text-[10px] text-slate-400 mb-1">
                      Serial / NFC ID
                    </label>
                    <input
                      type="text"
                      value={project.slab.serial}
                      onChange={(e) => onUpdateSlab({ serial: e.target.value })}
                      className="w-full bg-[#0B0D12] border border-white/10 rounded-md px-2 py-1 text-xs font-mono-num text-slate-100 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Trim</label>
                    <input
                      type="color"
                      value={project.slab.accentColor}
                      onChange={(e) => onUpdateSlab({ accentColor: e.target.value })}
                      className="w-8 h-[28px] rounded border border-white/15 bg-transparent cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Multi-Format Render Exporter & Inspection Angles */}
              <div className="lg:col-span-3 flex flex-col justify-between gap-2.5 bg-[#0B0D12]/60 border border-white/10 rounded-lg p-3">
                <div>
                  <span className="block text-xs font-semibold text-slate-200 mb-1.5">
                    3D Camera Angles
                  </span>
                  <div className="grid grid-cols-4 gap-1">
                    {(
                      [
                        ['front', 'Front'],
                        ['angle', '3/4'],
                        ['side', 'Side'],
                        ['back', 'Back'],
                      ] as const
                    ).map(([preset, label]) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => onCameraPreset(preset)}
                        className="py-1 text-[11px] font-medium rounded bg-white/5 hover:bg-white/15 text-slate-200 border border-white/10 cursor-pointer"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="block text-xs font-semibold text-slate-200">
                    High-Res Card Exporter
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <select
                      value={exportFormat}
                      onChange={(e) => onSetExportFormat(e.target.value as ExportFormat)}
                      className="bg-[#141824] border border-white/15 rounded px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:border-amber-400"
                    >
                      <option value="png">Studio PNG</option>
                      <option value="png_transparent">Transparent PNG</option>
                      <option value="webp">WebP (94%)</option>
                      <option value="jpeg">JPEG (Print)</option>
                    </select>
                    <select
                      value={exportDimension}
                      onChange={(e) =>
                        onSetExportDimension(e.target.value as ExportDimensionPreset)
                      }
                      className="bg-[#141824] border border-white/15 rounded px-2 py-1 text-[11px] font-mono-num text-amber-300 focus:outline-none focus:border-amber-400"
                    >
                      <option value="tcg_750">750×1050</option>
                      <option value="print_1500">1500×2100</option>
                      <option value="slab_1800">1800×2400</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={onTriggerExport}
                    className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-semibold rounded-md bg-amber-400 hover:bg-amber-300 text-slate-950 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export Render
                  </button>
                </div>
              </div>

              {/* Saved Projects & .vcacard.json Manager */}
              <div className="lg:col-span-4 flex flex-col justify-between gap-2 bg-[#0B0D12]/60 border border-white/10 rounded-lg p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-200">
                    Saved Projects ({savedProjects.length})
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={onSaveProjectSlot}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 border border-amber-400/40 cursor-pointer"
                    >
                      <Save className="w-3 h-3" />
                      Save Slot
                    </button>
                    <button
                      type="button"
                      onClick={onExportProjectJson}
                      title="Download .vcacard.json"
                      className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => jsonInputRef.current?.click()}
                      title="Load .vcacard.json"
                      className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 cursor-pointer"
                    >
                      <FolderOpen className="w-3 h-3" />
                    </button>
                    <input
                      ref={jsonInputRef}
                      type="file"
                      accept=".json,.vcacard.json"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          onImportProjectJson(f);
                          e.target.value = '';
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-1 max-h-[120px] overflow-y-auto studio-scroll pr-1">
                  {savedProjects.length === 0 ? (
                    <p className="text-[11px] text-slate-400 py-4 text-center">
                      Auto-save active. Click &ldquo;Save Slot&rdquo; to store snapshots here.
                    </p>
                  ) : (
                    savedProjects.map((slot) => (
                      <div
                        key={slot.id}
                        className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-[#141824] border border-white/10"
                      >
                        <button
                          type="button"
                          onClick={() => onLoadProjectSlot(slot.id)}
                          className="flex-1 text-left min-w-0 cursor-pointer"
                        >
                          <p className="text-[11px] font-medium text-slate-100 truncate">
                            {slot.name}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono-num">
                            {slot.layerCount} layers ·{' '}
                            {new Date(slot.updatedAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteProjectSlot(slot.id)}
                          className="p-1 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-300 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
