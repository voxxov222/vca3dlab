import type { CardProject } from '../types/card';
import { createDefaultFrameConfig } from './frameGenerator';

const AUTOSAVE_KEY = 'vca_card_studio_autosave_v2';
const PROJECTS_INDEX_KEY = 'vca_card_studio_projects_v2';

export interface SavedProjectSummary {
  id: string;
  name: string;
  artist: string;
  updatedAt: number;
  layerCount: number;
  thumbnailUrl?: string;
}

export function normalizeProject(raw: CardProject): CardProject {
  return {
    ...raw,
    schemaVersion: 2,
    updatedAt: raw.updatedAt ?? Date.now(),
    foilSweepSpeed: raw.foilSweepSpeed ?? 1.0,
    foilFresnel: raw.foilFresnel ?? 1.0,
    foilScale: raw.foilScale ?? 1.0,
    foilTint: raw.foilTint ?? '#ffffff',
    frame: raw.frame ? { ...createDefaultFrameConfig(), ...raw.frame } : createDefaultFrameConfig(),
    layers: (raw.layers || []).map((l) => ({
      ...l,
      kind: l.kind ?? 'image',
      locked: l.locked ?? false,
      pitchDeg: l.pitchDeg ?? 0,
      yawDeg: l.yawDeg ?? 0,
      foilScale: l.foilScale ?? 1,
      fresnelIntensity: l.fresnelIntensity ?? 1,
      embossStrength: l.embossStrength ?? 0.5,
      materialFinish: l.materialFinish ?? 'standard',
      blendMode: l.blendMode ?? 'normal',
    })),
  };
}

export function saveAutosave(project: CardProject): boolean {
  try {
    const payload = JSON.stringify({
      ...project,
      schemaVersion: 2,
      updatedAt: Date.now(),
    });
    localStorage.setItem(AUTOSAVE_KEY, payload);
    return true;
  } catch {
    return false;
  }
}

export function loadAutosave(): CardProject | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CardProject;
    if (!parsed || !Array.isArray(parsed.layers) || parsed.layers.length === 0) {
      return null;
    }
    return normalizeProject(parsed);
  } catch {
    return null;
  }
}

export function clearAutosave(): void {
  try {
    localStorage.removeItem(AUTOSAVE_KEY);
  } catch {
    // ignore
  }
}

export function listSavedProjects(): SavedProjectSummary[] {
  try {
    const raw = localStorage.getItem(PROJECTS_INDEX_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as SavedProjectSummary[];
    return Array.isArray(list) ? list.sort((a, b) => b.updatedAt - a.updatedAt) : [];
  } catch {
    return [];
  }
}

export function saveProjectSlot(
  project: CardProject,
  thumbnailUrl?: string
): SavedProjectSummary[] {
  const updated: CardProject = {
    ...project,
    schemaVersion: 2,
    updatedAt: Date.now(),
  };
  try {
    localStorage.setItem(`vca_project_data_${updated.id}`, JSON.stringify(updated));
    const current = listSavedProjects().filter((s) => s.id !== updated.id);
    const entry: SavedProjectSummary = {
      id: updated.id,
      name: updated.name || 'Untitled VCA Card',
      artist: updated.artist || 'VCA Artist',
      updatedAt: updated.updatedAt!,
      layerCount: updated.layers.length,
      thumbnailUrl,
    };
    const next = [entry, ...current].slice(0, 20);
    localStorage.setItem(PROJECTS_INDEX_KEY, JSON.stringify(next));
    return next;
  } catch {
    return listSavedProjects();
  }
}

export function loadProjectSlot(id: string): CardProject | null {
  try {
    const raw = localStorage.getItem(`vca_project_data_${id}`);
    if (!raw) return null;
    return normalizeProject(JSON.parse(raw) as CardProject);
  } catch {
    return null;
  }
}

export function deleteProjectSlot(id: string): SavedProjectSummary[] {
  try {
    localStorage.removeItem(`vca_project_data_${id}`);
    const next = listSavedProjects().filter((s) => s.id !== id);
    localStorage.setItem(PROJECTS_INDEX_KEY, JSON.stringify(next));
    return next;
  } catch {
    return listSavedProjects();
  }
}
