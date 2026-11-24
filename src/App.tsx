import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { AddAssetPayload } from './components/AssetSearchPanel';
import { ContextMenuFloating } from './components/ContextMenuFloating';
import { StudioDock } from './components/StudioDock';
import { TopBar } from './components/TopBar';
import { CardLabScene } from './engine/CardLabScene';
import { DEFAULT_SNAP_CONFIG } from './engine/SnapEngine';
import type {
  CardLayer,
  CardProject,
  DockTab,
  ExportDimensionPreset,
  ExportFormat,
  FrameConfig,
  InteractionMode,
  SnapConfig,
  TransformGizmoMode,
} from './types/card';
import { PRESET_DECKS } from './utils/artworkGenerators';
import { createDefaultFrameConfig } from './utils/frameGenerator';
import {
  createFlatDepthMapUrl,
  generateAutoDepthMap,
  importRemoteImageToSafeUrl,
  importUniversalAssetFile,
  mergeImageLayersToPng,
  removeBackgroundSmart,
} from './utils/imageProcessing';
import {
  deleteProjectSlot,
  listSavedProjects,
  loadAutosave,
  loadProjectSlot,
  normalizeProject,
  saveAutosave,
  saveProjectSlot,
  type SavedProjectSummary,
} from './utils/projectStorage';

const MAX_HISTORY = 36;

export const App: React.FC = () => {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<CardLabScene | null>(null);
  const projectRef = useRef<CardProject | null>(null);

  const [project, setProject] = useState<CardProject | null>(null);
  const [undoStack, setUndoStack] = useState<CardProject[]>([]);
  const [redoStack, setRedoStack] = useState<CardProject[]>([]);

  const [selectedLayerId, setSelectedLayerId] = useState<string>('');
  const [multiSelectedIds, setMultiSelectedIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<DockTab>('layers');
  const [layersSubView, setLayersSubView] = useState<'inspector' | 'depth'>('inspector');
  const [dockOpen, setDockOpen] = useState<boolean>(true);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('object');
  const [gizmoMode, setGizmoMode] = useState<TransformGizmoMode>('translate');
  const [snapConfig, setSnapConfig] = useState<SnapConfig>(DEFAULT_SNAP_CONFIG);
  const [viewerMode, setViewerMode] = useState<boolean>(false);
  const [viewerTurntable, setViewerTurntable] = useState<boolean>(false);
  const [cameraSensitivity, setCameraSensitivity] = useState<number>(1.0);

  const [explodedFactor, setExplodedFactor] = useState<number>(0);
  const [floatEnabled, setFloatEnabled] = useState<boolean>(true);
  const [processingLabel, setProcessingLabel] = useState<string | null>(null);
  const [contextLost, setContextLost] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [exportFormat, setExportFormat] = useState<ExportFormat>('png');
  const [exportDimension, setExportDimension] = useState<ExportDimensionPreset>('tcg_750');
  const [savedProjects, setSavedProjects] = useState<SavedProjectSummary[]>(() =>
    listSavedProjects()
  );

  const [contextMenu, setContextMenu] = useState<{
    layerId: string;
    x: number;
    y: number;
  } | null>(null);

  projectRef.current = project;

  const showNotice = useCallback((msg: string) => {
    setNotice(msg);
    window.setTimeout(() => {
      setNotice((curr) => (curr === msg ? null : curr));
    }, 2600);
  }, []);

  const commitProjectChange = useCallback(
    (updater: (prev: CardProject) => CardProject, recordHistory = true) => {
      setProject((prev) => {
        if (!prev) return prev;
        if (recordHistory) {
          setUndoStack((hist) => [...hist.slice(-(MAX_HISTORY - 1)), prev]);
          setRedoStack([]);
        }
        return updater(prev);
      });
    },
    []
  );

  const pushSnapshotBeforeDrag = useCallback(() => {
    const cur = projectRef.current;
    if (!cur) return;
    setUndoStack((hist) => {
      const last = hist[hist.length - 1];
      if (last === cur) return hist;
      return [...hist.slice(-(MAX_HISTORY - 1)), cur];
    });
    setRedoStack([]);
  }, []);

  const handleUndo = useCallback(() => {
    setUndoStack((hist) => {
      if (hist.length === 0 || !projectRef.current) return hist;
      const previous = hist[hist.length - 1];
      setRedoStack((r) => [...r, projectRef.current!]);
      setProject(previous);
      if (!previous.layers.some((l) => l.id === selectedLayerId)) {
        setSelectedLayerId(previous.layers[previous.layers.length - 1]?.id || '');
      }
      return hist.slice(0, -1);
    });
  }, [selectedLayerId]);

  const handleRedo = useCallback(() => {
    setRedoStack((r) => {
      if (r.length === 0 || !projectRef.current) return r;
      const next = r[r.length - 1];
      setUndoStack((hist) => [...hist, projectRef.current!]);
      setProject(next);
      if (!next.layers.some((l) => l.id === selectedLayerId)) {
        setSelectedLayerId(next.layers[next.layers.length - 1]?.id || '');
      }
      return r.slice(0, -1);
    });
  }, [selectedLayerId]);

  const handleUpdateLayer = useCallback(
    (id: string, patch: Partial<CardLayer>, recordHistory = false) => {
      setProject((prev) => {
        if (!prev) return prev;
        if (recordHistory) {
          setUndoStack((hist) => [...hist.slice(-(MAX_HISTORY - 1)), prev]);
          setRedoStack([]);
        }
        return {
          ...prev,
          layers: prev.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)),
        };
      });
    },
    []
  );

  // Boot initial preset or autosaved project & mount Three.js scene
  useEffect(() => {
    let mounted = true;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      setFloatEnabled(false);
    }

    const initBoot = async () => {
      const autosaved = loadAutosave();
      const initial = autosaved || normalizeProject(await PRESET_DECKS[0].build());
      if (!mounted) return;

      setProject(initial);
      const charLayer =
        initial.layers.find((l) => l.role === 'character') || initial.layers[0];
      const initialSelId = charLayer?.id ?? '';
      setSelectedLayerId(initialSelId);

      if (canvasMountRef.current && !sceneRef.current) {
        const scene = new CardLabScene(canvasMountRef.current, initial, {
          onContextLost: (lost) => setContextLost(lost),
          onSelectLayer: (layerId) => setSelectedLayerId(layerId),
          onDoubleTapLayer: (layerId) => {
            setSelectedLayerId(layerId);
            setActiveTab('layers');
            setLayersSubView('inspector');
            setDockOpen(true);
          },
          onLongPressLayer: (layerId, x, y) => {
            setSelectedLayerId(layerId);
            setContextMenu({ layerId, x, y });
          },
          onUpdateLayerTransform: (layerId, patch) =>
            handleUpdateLayer(layerId, patch, false),
          onCommitTransform: () => pushSnapshotBeforeDrag(),
        });
        scene.setSelectedLayerId(initialSelId);
        scene.setInteractionMode('object');
        scene.setFloatEnabled(!reducedMotion);
        scene.setSnapConfig(DEFAULT_SNAP_CONFIG);
        sceneRef.current = scene;
      }
      if (autosaved) {
        showNotice(`Restored autosave: ${autosaved.name}`);
      }
    };

    initBoot();

    return () => {
      mounted = false;
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, [handleUpdateLayer, pushSnapshotBeforeDrag, showNotice]);

  // Sync project -> Three.js & debounced autosave
  useEffect(() => {
    if (!project) return;
    sceneRef.current?.syncProject(project);
    const timer = window.setTimeout(() => {
      saveAutosave(project);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [project]);

  useEffect(() => {
    sceneRef.current?.setSelectedLayerId(selectedLayerId);
  }, [selectedLayerId]);

  useEffect(() => {
    sceneRef.current?.setDockOpen(dockOpen);
  }, [dockOpen]);

  useEffect(() => {
    sceneRef.current?.setInteractionMode(interactionMode);
  }, [interactionMode]);

  useEffect(() => {
    sceneRef.current?.setTransformGizmoMode(gizmoMode);
  }, [gizmoMode]);

  useEffect(() => {
    sceneRef.current?.setSnapConfig(snapConfig);
  }, [snapConfig]);

  useEffect(() => {
    sceneRef.current?.setViewerMode(viewerMode, viewerTurntable);
  }, [viewerMode, viewerTurntable]);

  useEffect(() => {
    sceneRef.current?.setCameraSensitivity(cameraSensitivity);
  }, [cameraSensitivity]);

  useEffect(() => {
    sceneRef.current?.setExplodeFactor(explodedFactor);
  }, [explodedFactor]);

  useEffect(() => {
    sceneRef.current?.setFloatEnabled(floatEnabled);
  }, [floatEnabled]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }

      if (e.key === 'h' || e.key === 'H') {
        setDockOpen((v) => !v);
      } else if (e.key === 'r' || e.key === 'R') {
        sceneRef.current?.resetCamera();
      } else if (e.key === 'e' || e.key === 'E') {
        setExplodedFactor((v) => (v > 0.1 ? 0 : 0.75));
      } else if (e.key === 'v' || e.key === 'V') {
        setViewerMode((v) => !v);
        setViewerTurntable((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, handleRedo]);

  const handleSelectTab = (tab: DockTab) => {
    setActiveTab(tab);
    setDockOpen(true);
  };

  const handleSelectPreset = async (presetId: string) => {
    const found = PRESET_DECKS.find((p) => p.id === presetId);
    if (!found) return;
    setProcessingLabel(`Loading ${found.label}...`);
    try {
      const next = normalizeProject(await found.build());
      commitProjectChange(() => next);
      const charLayer =
        next.layers.find((l) => l.role === 'character') || next.layers[0];
      setSelectedLayerId(charLayer?.id ?? '');
      setMultiSelectedIds([]);
      setExplodedFactor(0);
      setViewerMode(false);
    } finally {
      setProcessingLabel(null);
    }
  };

  const handleAddAssetLayer = async (asset: AddAssetPayload) => {
    if (!project) return;
    setProcessingLabel(`Preparing ${asset.name}...`);
    try {
      if (asset.kind === 'model3d') {
        const newId = `layer-${Date.now()}`;
        const newLayer: CardLayer = {
          id: newId,
          name: asset.name,
          kind: 'model3d',
          role: asset.role,
          visible: true,
          locked: false,
          opacity: 1,
          imageUrl: asset.imageUrl,
          originalImageUrl: asset.imageUrl,
          depthMapUrl: createFlatDepthMapUrl(128),
          zOffset: 0.18,
          displacementScale: 0,
          scale: 0.75,
          offsetX: 0,
          offsetY: 0,
          rotationDeg: 0,
          pitchDeg: 0,
          yawDeg: 0,
          foilWeight: 0.8,
          proceduralModelId: asset.proceduralModelId,
          modelFormat: asset.modelFormat || 'procedural',
          attribution: asset.attribution,
        };
        commitProjectChange((prev) => ({
          ...prev,
          layers: [...prev.layers, newLayer],
        }));
        setSelectedLayerId(newId);
        setInteractionMode('object');
        showNotice(`Added 3D Object: ${asset.name}`);
        return;
      }

      let safeUrl = asset.imageUrl;
      let isGif = Boolean(asset.isAnimatedGif);

      if (asset.remoteUrl && /^https?:/i.test(asset.remoteUrl)) {
        try {
          const imported = await importRemoteImageToSafeUrl(
            asset.remoteUrl,
            asset.isAnimatedGif
          );
          safeUrl = imported.url;
          isGif = imported.isAnimatedGif;
        } catch {
          showNotice(`Could not fetch remote sprite directly — trying fallback`);
        }
      }

      const depthUrl = await generateAutoDepthMap(safeUrl, asset.role);

      if (asset.replaceBackground) {
        const existingBg = project.layers.find((l) => l.role === 'background');
        if (existingBg) {
          commitProjectChange((prev) => ({
            ...prev,
            layers: prev.layers.map((l) =>
              l.id === existingBg.id
                ? {
                    ...l,
                    name: asset.name,
                    imageUrl: safeUrl,
                    originalImageUrl: safeUrl,
                    depthMapUrl: depthUrl,
                    attribution: asset.attribution,
                  }
                : l
            ),
          }));
          setSelectedLayerId(existingBg.id);
          showNotice(`Updated background: ${asset.name}`);
          return;
        }
      }

      const newId = `layer-${Date.now()}`;
      const topZ =
        asset.role === 'background'
          ? -0.09
          : project.layers.length > 0
            ? Math.min(0.35, project.layers[project.layers.length - 1].zOffset + 0.04)
            : 0.12;

      const newLayer: CardLayer = {
        id: newId,
        name: asset.name,
        kind: 'image',
        role: asset.role,
        visible: true,
        locked: false,
        opacity: 1,
        imageUrl: safeUrl,
        originalImageUrl: safeUrl,
        depthMapUrl: depthUrl,
        zOffset: Number(topZ.toFixed(2)),
        displacementScale: asset.role === 'background' ? 0.06 : 0.16,
        scale: 1,
        offsetX: 0,
        offsetY: 0,
        rotationDeg: 0,
        pitchDeg: 0,
        yawDeg: 0,
        foilWeight: asset.role === 'background' ? 0.3 : 0.75,
        isAnimatedGif: isGif,
        materialFinish: 'standard',
        attribution: asset.attribution,
      };

      commitProjectChange((prev) => ({
        ...prev,
        layers:
          asset.role === 'background'
            ? [newLayer, ...prev.layers]
            : [...prev.layers, newLayer],
      }));
      setSelectedLayerId(newId);
      setInteractionMode('object');
      showNotice(`Added ${asset.name} — switch to Object or Precision to position`);
    } finally {
      setProcessingLabel(null);
    }
  };

  const handleImportFiles = async (files: FileList) => {
    if (!project) return;
    setProcessingLabel('Importing assets (PNG / GIF / 3D Models)...');
    try {
      const created: CardLayer[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.name.toLowerCase().endsWith('.json')) {
          await handleImportProjectJson(file);
          continue;
        }

        const parsed = await importUniversalAssetFile(file);
        if (!parsed) continue;

        const id = `layer-${Date.now()}-${i}`;
        const baseZ =
          project.layers.length > 0
            ? Math.min(0.35, project.layers[project.layers.length - 1].zOffset + 0.05)
            : 0.1;

        if (parsed.type === 'model3d') {
          created.push({
            id,
            name: parsed.name,
            kind: 'model3d',
            role: 'character',
            visible: true,
            locked: false,
            opacity: 1,
            imageUrl: createFlatDepthMapUrl(180),
            originalImageUrl: createFlatDepthMapUrl(180),
            depthMapUrl: createFlatDepthMapUrl(128),
            zOffset: Number((baseZ + i * 0.04).toFixed(2)),
            displacementScale: 0,
            scale: 0.85,
            offsetX: 0,
            offsetY: 0,
            rotationDeg: 0,
            pitchDeg: 0,
            yawDeg: 0,
            foilWeight: 0.7,
            modelUrl: parsed.modelUrl,
            modelFormat: parsed.format.toLowerCase() as 'glb' | 'gltf' | 'obj',
            attribution: {
              source: 'User Uploaded 3D Model',
              license: 'User Asset',
              commercialOk: true,
              format: parsed.format,
            },
          });
        } else {
          const depthUrl = await generateAutoDepthMap(parsed.imageUrl, 'character');
          created.push({
            id,
            name: parsed.name,
            kind: 'image',
            role: 'character',
            visible: true,
            locked: false,
            opacity: 1,
            imageUrl: parsed.imageUrl,
            originalImageUrl: parsed.imageUrl,
            depthMapUrl: depthUrl,
            zOffset: Number((baseZ + i * 0.04).toFixed(2)),
            displacementScale: 0.18,
            scale: 1,
            offsetX: 0,
            offsetY: 0,
            rotationDeg: 0,
            pitchDeg: 0,
            yawDeg: 0,
            foilWeight: 0.75,
            isAnimatedGif: parsed.isAnimatedGif,
            attribution: {
              source: 'User Uploaded Artwork',
              license: 'User Asset',
              commercialOk: true,
              format: parsed.format,
            },
          });
        }
      }

      if (created.length > 0) {
        commitProjectChange((prev) => ({
          ...prev,
          layers: [...prev.layers, ...created],
        }));
        setSelectedLayerId(created[created.length - 1].id);
        setInteractionMode('object');
        showNotice(`Imported ${created.length} layer${created.length > 1 ? 's' : ''}`);
      }
    } finally {
      setProcessingLabel(null);
    }
  };

  const handleMoveLayer = (id: string, dir: -1 | 1) => {
    commitProjectChange((prev) => {
      const idx = prev.layers.findIndex((l) => l.id === id);
      if (idx < 0) return prev;
      const nextIdx = idx + dir;
      if (nextIdx < 0 || nextIdx >= prev.layers.length) return prev;
      const copy = [...prev.layers];
      const [item] = copy.splice(idx, 1);
      copy.splice(nextIdx, 0, item);
      return { ...prev, layers: copy };
    });
  };

  const handleDuplicateLayer = (id: string) => {
    commitProjectChange((prev) => {
      const idx = prev.layers.findIndex((l) => l.id === id);
      if (idx < 0) return prev;
      const src = prev.layers[idx];
      const dup: CardLayer = {
        ...src,
        id: `layer-${Date.now()}`,
        name: `${src.name} Copy`,
        locked: false,
        zOffset: Number(Math.min(0.42, src.zOffset + 0.03).toFixed(2)),
      };
      const copy = [...prev.layers];
      copy.splice(idx + 1, 0, dup);
      setSelectedLayerId(dup.id);
      return { ...prev, layers: copy };
    });
  };

  const handleDeleteLayer = (id: string) => {
    commitProjectChange((prev) => {
      if (prev.layers.length <= 1) return prev;
      const remaining = prev.layers.filter((l) => l.id !== id);
      if (selectedLayerId === id) {
        setSelectedLayerId(remaining[remaining.length - 1].id);
      }
      setMultiSelectedIds((m) => m.filter((x) => x !== id));
      return { ...prev, layers: remaining };
    });
  };

  const handleToggleMultiSelect = (id: string) => {
    setMultiSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleGroupSelected = () => {
    if (multiSelectedIds.length < 2) return;
    const gid = `grp-${Date.now()}`;
    const setIds = new Set(multiSelectedIds);
    commitProjectChange((prev) => ({
      ...prev,
      layers: prev.layers.map((l) => (setIds.has(l.id) ? { ...l, groupId: gid } : l)),
    }));
    setMultiSelectedIds([]);
    showNotice('Grouped selected layers (drag moves group together)');
  };

  const handleUngroupLayer = (id: string) => {
    commitProjectChange((prev) => ({
      ...prev,
      layers: prev.layers.map((l) =>
        l.id === id ? { ...l, groupId: undefined } : l
      ),
    }));
  };

  const handleMergeSelected = async () => {
    if (!project || multiSelectedIds.length < 2) return;
    const setIds = new Set(multiSelectedIds);
    const toMerge = project.layers.filter((l) => setIds.has(l.id));
    const imageCount = toMerge.filter((l) => !l.kind || l.kind === 'image').length;
    if (imageCount < 2) {
      showNotice('Select at least 2 image layers to merge');
      return;
    }

    setProcessingLabel('Merging selected layers into composite PNG...');
    try {
      const mergedUrl = await mergeImageLayersToPng(toMerge);
      const depthUrl = await generateAutoDepthMap(mergedUrl, 'character');
      const topZ = Math.max(...toMerge.map((l) => l.zOffset));
      const newId = `layer-merged-${Date.now()}`;

      const mergedLayer: CardLayer = {
        id: newId,
        name: `Merged (${imageCount} layers)`,
        kind: 'image',
        role: 'character',
        visible: true,
        locked: false,
        opacity: 1,
        imageUrl: mergedUrl,
        originalImageUrl: mergedUrl,
        depthMapUrl: depthUrl,
        zOffset: topZ,
        displacementScale: 0.16,
        scale: 1,
        offsetX: 0,
        offsetY: 0,
        rotationDeg: 0,
        pitchDeg: 0,
        yawDeg: 0,
        foilWeight: 0.75,
      };

      commitProjectChange((prev) => {
        const remaining = prev.layers.filter((l) => !setIds.has(l.id));
        return { ...prev, layers: [...remaining, mergedLayer] };
      });
      setSelectedLayerId(newId);
      setMultiSelectedIds([]);
      showNotice('Merged layers into clean composite PNG');
    } finally {
      setProcessingLabel(null);
    }
  };

  const handleRemoveBg = async (id: string, tolerance: number) => {
    if (!project) return;
    const layer = project.layers.find((l) => l.id === id);
    if (!layer) return;
    setProcessingLabel('Segmenting subject & removing background...');
    try {
      const cutoutUrl = await removeBackgroundSmart(layer.originalImageUrl, {
        tolerance,
        feather: 14,
        mode: 'edge_flood',
      });
      const depthMapUrl = await generateAutoDepthMap(cutoutUrl, layer.role);
      handleUpdateLayer(id, { imageUrl: cutoutUrl, depthMapUrl }, true);
      showNotice('Background segmented & depth map updated');
    } finally {
      setProcessingLabel(null);
    }
  };

  const handleRestoreOriginalBg = async (id: string) => {
    if (!project) return;
    const layer = project.layers.find((l) => l.id === id);
    if (!layer) return;
    const depthMapUrl = await generateAutoDepthMap(layer.originalImageUrl, layer.role);
    handleUpdateLayer(id, { imageUrl: layer.originalImageUrl, depthMapUrl }, true);
  };

  const handleAutoDepth = async (id: string) => {
    if (!project) return;
    const layer = project.layers.find((l) => l.id === id);
    if (!layer) return;
    setProcessingLabel('Generating sculpted 3D depth map...');
    try {
      const depthMapUrl = await generateAutoDepthMap(layer.imageUrl, layer.role);
      handleUpdateLayer(id, { depthMapUrl }, true);
      showNotice('Auto-depth relief map generated');
    } finally {
      setProcessingLabel(null);
    }
  };

  const handleLiveDepthPixels = (id: string, pixels: Float32Array) => {
    if (!project) return;
    const layer = project.layers.find((l) => l.id === id);
    if (!layer) return;
    sceneRef.current?.updateLayerDepthLive(id, pixels, layer.displacementScale);
  };

  const handleUpdateFrame = (patch: Partial<FrameConfig>) => {
    commitProjectChange((prev) => ({
      ...prev,
      frame: {
        ...(prev.frame || createDefaultFrameConfig()),
        ...patch,
      },
    }), false);
  };

  const handleAddFrameAsLayer = async (framePngUrl: string, name: string) => {
    await handleAddAssetLayer({
      name,
      role: 'frame',
      kind: 'image',
      imageUrl: framePngUrl,
      attribution: {
        source: 'VCA Original Frame Generator',
        license: 'VCA CC0 / Commercial OK',
        commercialOk: true,
        format: 'PNG',
      },
    });
    setActiveTab('layers');
  };

  const handleTriggerExport = (
    overrideFormat?: ExportFormat,
    overrideDim?: ExportDimensionPreset
  ) => {
    if (!sceneRef.current || !project) return;
    const fmt = overrideFormat || exportFormat;
    const dim = overrideDim || exportDimension;
    const dataUrl = sceneRef.current.captureExport(fmt, dim);
    const ext = fmt === 'jpeg' ? 'jpg' : fmt === 'webp' ? 'webp' : 'png';
    const base =
      project.slab.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'vca-card';
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${base}-${dim}.${ext}`;
    a.click();
    showNotice(`Exported ${fmt.replace('_', ' ').toUpperCase()} render`);
  };

  const handleSaveProjectSlot = () => {
    if (!project) return;
    const thumb = sceneRef.current?.captureExport('jpeg', 'tcg_750');
    const updated = saveProjectSlot(project, thumb);
    setSavedProjects(updated);
    showNotice(`Saved "${project.slab.title || project.name}" to local workspace`);
  };

  const handleLoadProjectSlot = (id: string) => {
    const loaded = loadProjectSlot(id);
    if (!loaded) {
      showNotice('Saved project could not be loaded');
      return;
    }
    commitProjectChange(() => loaded);
    setSelectedLayerId(loaded.layers[0]?.id || '');
    setMultiSelectedIds([]);
    showNotice(`Loaded ${loaded.name}`);
  };

  const handleDeleteProjectSlot = (id: string) => {
    setSavedProjects(deleteProjectSlot(id));
  };

  const handleExportProjectJson = () => {
    if (!project) return;
    const blob = new Blob([JSON.stringify(project, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.slab.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'vca-card'}.vcacard.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotice('Saved .vcacard.json project');
  };

  const handleImportProjectJson = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as CardProject;
      if (!parsed || !Array.isArray(parsed.layers) || parsed.layers.length === 0) {
        showNotice('Invalid VCA card project file');
        return;
      }
      const norm = normalizeProject(parsed);
      commitProjectChange(() => norm);
      setSelectedLayerId(norm.layers[0].id);
      setMultiSelectedIds([]);
      showNotice(`Loaded ${norm.name}`);
    } catch {
      showNotice('Could not parse project file');
    }
  };

  const contextMenuLayer = contextMenu
    ? project?.layers.find((l) => l.id === contextMenu.layerId)
    : undefined;

  return (
    <div
      className="relative w-full h-full overflow-hidden bg-[#0B0D12]"
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragActive(false);
        const assetJson = e.dataTransfer.getData('application/x-vca-asset');
        if (assetJson) {
          try {
            const payload = JSON.parse(assetJson) as AddAssetPayload;
            handleAddAssetLayer(payload);
            return;
          } catch {
            // Fall through to file drop
          }
        }
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          handleImportFiles(e.dataTransfer.files);
        }
      }}
    >
      {/* Dedicated WebGL Mount Container (touch-action: none enforced on canvas) */}
      <div
        ref={canvasMountRef}
        className="fixed inset-0 w-full h-full z-0"
        aria-label="Interactive 3D Card Viewport"
      />

      {contextLost && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#0B0D12]/90">
          <div className="max-w-sm p-6 rounded-xl bg-[#141824] border border-white/15 text-center space-y-2">
            <h2 className="font-display text-lg font-semibold text-white">
              3D Viewport Paused
            </h2>
            <p className="text-sm text-slate-300">
              WebGL rendering context was interrupted. Reload or switch tabs to resume.
            </p>
          </div>
        </div>
      )}

      {dragActive && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-amber-500/10 border-2 border-dashed border-amber-400 pointer-events-none">
          <div className="px-5 py-3 rounded-lg bg-[#111520] border border-amber-400/50 text-sm font-medium text-amber-300">
            Drop PNG / GIF / GLB / OBJ / VCA asset to add to 3D card
          </div>
        </div>
      )}

      <TopBar
        activeTab={activeTab}
        dockOpen={dockOpen}
        onSelectTab={handleSelectTab}
        onExportPng={() => handleTriggerExport()}
      />

      {notice && (
        <div className="fixed top-18 left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 rounded-lg bg-[#151926] border border-white/15 text-xs font-medium text-slate-100 shadow-lg pointer-events-none">
          {notice}
        </div>
      )}

      {contextMenu && contextMenuLayer && (
        <ContextMenuFloating
          layer={contextMenuLayer}
          x={contextMenu.x}
          y={contextMenu.y}
          canDelete={(project?.layers.length ?? 0) > 1}
          onClose={() => setContextMenu(null)}
          onDuplicate={handleDuplicateLayer}
          onToggleLock={(id) =>
            handleUpdateLayer(id, { locked: !contextMenuLayer.locked }, true)
          }
          onMove={handleMoveLayer}
          onOpenDepthPaint={(id) => {
            setSelectedLayerId(id);
            setActiveTab('layers');
            setLayersSubView('depth');
            setDockOpen(true);
          }}
          onResetTransform={(id) =>
            handleUpdateLayer(
              id,
              {
                offsetX: 0,
                offsetY: 0,
                scale: 1,
                rotationDeg: 0,
                pitchDeg: 0,
                yawDeg: 0,
              },
              true
            )
          }
          onDelete={handleDeleteLayer}
        />
      )}

      {project && (
        <StudioDock
          project={project}
          activeTab={activeTab}
          dockOpen={dockOpen}
          selectedLayerId={selectedLayerId}
          multiSelectedIds={multiSelectedIds}
          interactionMode={interactionMode}
          gizmoMode={gizmoMode}
          snapConfig={snapConfig}
          viewerMode={viewerMode}
          viewerTurntable={viewerTurntable}
          cameraSensitivity={cameraSensitivity}
          canUndo={undoStack.length > 0}
          canRedo={redoStack.length > 0}
          explodedFactor={explodedFactor}
          floatEnabled={floatEnabled}
          processingLabel={processingLabel}
          savedProjects={savedProjects}
          exportFormat={exportFormat}
          exportDimension={exportDimension}
          layersSubView={layersSubView}
          onSetLayersSubView={setLayersSubView}
          onToggleDock={() => setDockOpen((v) => !v)}
          onSelectTab={handleSelectTab}
          onSelectLayer={setSelectedLayerId}
          onToggleMultiSelect={handleToggleMultiSelect}
          onGroupSelected={handleGroupSelected}
          onUngroupLayer={handleUngroupLayer}
          onMergeSelected={handleMergeSelected}
          onSelectPreset={handleSelectPreset}
          onSetInteractionMode={setInteractionMode}
          onSetGizmoMode={setGizmoMode}
          onUpdateSnapConfig={(patch) =>
            setSnapConfig((prev) => ({ ...prev, ...patch }))
          }
          onSetViewerMode={(enabled, turntable) => {
            setViewerMode(enabled);
            setViewerTurntable(Boolean(turntable));
          }}
          onSetCameraSensitivity={setCameraSensitivity}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onSetExplodedFactor={setExplodedFactor}
          onSetFloatEnabled={setFloatEnabled}
          onResetCamera={() => sceneRef.current?.resetCamera()}
          onCameraPreset={(preset) => {
            setInteractionMode('camera');
            sceneRef.current?.setCameraPreset(preset);
          }}
          onImportFiles={handleImportFiles}
          onAddAssetLayer={handleAddAssetLayer}
          onUpdateLayer={(id, patch) => handleUpdateLayer(id, patch, false)}
          onMoveLayer={handleMoveLayer}
          onDuplicateLayer={handleDuplicateLayer}
          onDeleteLayer={handleDeleteLayer}
          onRemoveBg={handleRemoveBg}
          onRestoreOriginalBg={handleRestoreOriginalBg}
          onAutoDepth={handleAutoDepth}
          onLiveDepthPixels={handleLiveDepthPixels}
          onUpdateProject={(patch) =>
            commitProjectChange((prev) => ({ ...prev, ...patch }), false)
          }
          onUpdateFrame={handleUpdateFrame}
          onAddFrameAsLayer={handleAddFrameAsLayer}
          onUpdateSlab={(patch) =>
            commitProjectChange(
              (prev) => ({ ...prev, slab: { ...prev.slab, ...patch } }),
              false
            )
          }
          onSetExportFormat={setExportFormat}
          onSetExportDimension={setExportDimension}
          onTriggerExport={() => handleTriggerExport()}
          onSaveProjectSlot={handleSaveProjectSlot}
          onLoadProjectSlot={handleLoadProjectSlot}
          onDeleteProjectSlot={handleDeleteProjectSlot}
          onExportProjectJson={handleExportProjectJson}
          onImportProjectJson={handleImportProjectJson}
        />
      )}
    </div>
  );
};

export default App;
