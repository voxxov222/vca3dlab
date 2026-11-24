import type { CardLayer, SnapConfig } from '../types/card';

export interface SnapGuideLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface SnapResult {
  offsetX: number;
  offsetY: number;
  snappedX: boolean;
  snappedY: boolean;
  guides: SnapGuideLine[];
}

export const DEFAULT_SNAP_CONFIG: SnapConfig = {
  enabled: true,
  snapToCenter: true,
  snapToEdges: true,
  snapToGrid: false,
  snapToLayers: true,
  gridStep: 0.25,
  tolerance: 0.08,
  rotationStep: 15,
  scaleStep: 0.05,
};

export function snapPosition(
  rawX: number,
  rawY: number,
  activeLayerId: string,
  allLayers: CardLayer[],
  snap: SnapConfig,
  cardHalfW = 1.25,
  cardHalfH = 1.75
): SnapResult {
  if (!snap.enabled) {
    return {
      offsetX: rawX,
      offsetY: rawY,
      snappedX: false,
      snappedY: false,
      guides: [],
    };
  }

  const tol = Math.max(0.02, snap.tolerance);
  const candidatesX: number[] = [];
  const candidatesY: number[] = [];

  if (snap.snapToCenter) {
    candidatesX.push(0);
    candidatesY.push(0);
  }

  if (snap.snapToEdges) {
    candidatesX.push(-cardHalfW * 0.5, cardHalfW * 0.5, -cardHalfW, cardHalfW);
    candidatesY.push(-cardHalfH * 0.5, cardHalfH * 0.5, -cardHalfH, cardHalfH);
  }

  if (snap.snapToLayers) {
    for (const l of allLayers) {
      if (l.id === activeLayerId || !l.visible) continue;
      candidatesX.push(l.offsetX);
      candidatesY.push(l.offsetY);
    }
  }

  if (snap.snapToGrid && snap.gridStep > 0.01) {
    const gx = Math.round(rawX / snap.gridStep) * snap.gridStep;
    const gy = Math.round(rawY / snap.gridStep) * snap.gridStep;
    candidatesX.push(gx);
    candidatesY.push(gy);
  }

  let bestX = rawX;
  let bestDistX = tol;
  let snappedX = false;
  for (const cx of candidatesX) {
    const d = Math.abs(rawX - cx);
    if (d <= bestDistX) {
      bestDistX = d;
      bestX = cx;
      snappedX = true;
    }
  }

  let bestY = rawY;
  let bestDistY = tol;
  let snappedY = false;
  for (const cy of candidatesY) {
    const d = Math.abs(rawY - cy);
    if (d <= bestDistY) {
      bestDistY = d;
      bestY = cy;
      snappedY = true;
    }
  }

  const guides: SnapGuideLine[] = [];
  if (snappedX) {
    guides.push({
      x1: bestX,
      y1: -cardHalfH - 0.3,
      x2: bestX,
      y2: cardHalfH + 0.3,
    });
  }
  if (snappedY) {
    guides.push({
      x1: -cardHalfW - 0.3,
      y1: bestY,
      x2: cardHalfW + 0.3,
      y2: bestY,
    });
  }

  return {
    offsetX: Number(bestX.toFixed(2)),
    offsetY: Number(bestY.toFixed(2)),
    snappedX,
    snappedY,
    guides,
  };
}

export function snapAngleDeg(rawDeg: number, snap: SnapConfig): number {
  const norm = ((Math.round(rawDeg) + 180) % 360 + 360) % 360 - 180;
  if (!snap.enabled || snap.rotationStep <= 0) return norm;
  const step = snap.rotationStep;
  const snapped = Math.round(norm / step) * step;
  const tol = Math.min(step * 0.4, 6);
  if (Math.abs(norm - snapped) <= tol) {
    return ((snapped + 180) % 360 + 360) % 360 - 180;
  }
  return norm;
}

export function snapScaleValue(rawScale: number, snap: SnapConfig): number {
  if (!snap.enabled || snap.scaleStep <= 0) {
    return Number(rawScale.toFixed(2));
  }
  const snapped = Math.round(rawScale / snap.scaleStep) * snap.scaleStep;
  if (Math.abs(rawScale - snapped) <= snap.scaleStep * 0.45) {
    return Number(snapped.toFixed(2));
  }
  return Number(rawScale.toFixed(2));
}
