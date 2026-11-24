import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, RotateCcw, Eye, EyeOff } from 'lucide-react';
import type { CardLayer } from '../types/card';
import {
  DEPTH_TEX_H,
  DEPTH_TEX_W,
  loadImageElement,
} from '../utils/imageProcessing';

type BrushMode = 'raise' | 'carve' | 'smooth';

interface DepthPainterProps {
  layer: CardLayer | undefined;
  onLiveDepthPixels: (layerId: string, pixels: Float32Array) => void;
  onCommitDepthUrl: (layerId: string, depthMapUrl: string) => void;
  onAutoDepth: (layerId: string) => void;
  onUpdateLayer: (layerId: string, patch: Partial<CardLayer>) => void;
}

export const DepthPainter: React.FC<DepthPainterProps> = ({
  layer,
  onLiveDepthPixels,
  onCommitDepthUrl,
  onAutoDepth,
  onUpdateLayer,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const depthBufRef = useRef<Float32Array>(new Float32Array(DEPTH_TEX_W * DEPTH_TEX_H));
  const artCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const paintingRef = useRef(false);
  const lastPtRef = useRef<{ x: number; y: number } | null>(null);

  const [brushMode, setBrushMode] = useState<BrushMode>('raise');
  const [brushSize, setBrushSize] = useState(26);
  const [brushStrength, setBrushStrength] = useState(0.35);
  const [showArtOverlay, setShowArtOverlay] = useState(true);

  // Sync depth buffer and artwork ghost overlay whenever active layer changes
  useEffect(() => {
    if (!layer) return;
    let cancelled = false;

    const loadData = async () => {
      try {
        const [depthImg, artImg] = await Promise.all([
          loadImageElement(layer.depthMapUrl),
          loadImageElement(layer.imageUrl),
        ]);
        if (cancelled) return;

        // Load depth grayscale into Float32Array
        const dCan = document.createElement('canvas');
        dCan.width = DEPTH_TEX_W;
        dCan.height = DEPTH_TEX_H;
        const dCtx = dCan.getContext('2d')!;
        dCtx.drawImage(depthImg, 0, 0, DEPTH_TEX_W, DEPTH_TEX_H);
        const raw = dCtx.getImageData(0, 0, DEPTH_TEX_W, DEPTH_TEX_H).data;
        const buf = depthBufRef.current;
        for (let i = 0; i < buf.length; i++) {
          buf[i] = raw[i * 4] / 255;
        }

        // Cache artwork ghost at 256x358
        const aCan = document.createElement('canvas');
        aCan.width = DEPTH_TEX_W;
        aCan.height = DEPTH_TEX_H;
        const aCtx = aCan.getContext('2d')!;
        aCtx.drawImage(artImg, 0, 0, DEPTH_TEX_W, DEPTH_TEX_H);
        artCanvasRef.current = aCan;

        redrawDisplayCanvas();
      } catch {
        // Ignore transient image decode error
      }
    };

    loadData();
    return () => {
      cancelled = true;
    };
  }, [layer?.id, layer?.depthMapUrl, layer?.imageUrl]);

  useEffect(() => {
    redrawDisplayCanvas();
  }, [showArtOverlay]);

  const redrawDisplayCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const buf = depthBufRef.current;
    const imgData = ctx.createImageData(DEPTH_TEX_W, DEPTH_TEX_H);
    for (let i = 0; i < buf.length; i++) {
      const v = Math.round(Math.min(1, Math.max(0, buf[i])) * 255);
      const idx = i * 4;
      imgData.data[idx] = v;
      imgData.data[idx + 1] = v;
      imgData.data[idx + 2] = v;
      imgData.data[idx + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);

    if (showArtOverlay && artCanvasRef.current) {
      ctx.save();
      ctx.globalAlpha = 0.34;
      ctx.drawImage(artCanvasRef.current, 0, 0);
      ctx.restore();
    }
  };

  const applyBrushAt = (cx: number, cy: number) => {
    if (!layer) return;
    const buf = depthBufRef.current;
    const r = brushSize;
    const r2 = r * r;
    const minX = Math.max(0, Math.floor(cx - r));
    const maxX = Math.min(DEPTH_TEX_W - 1, Math.ceil(cx + r));
    const minY = Math.max(0, Math.floor(cy - r));
    const maxY = Math.min(DEPTH_TEX_H - 1, Math.ceil(cy + r));

    if (brushMode === 'smooth') {
      const copy = new Float32Array(buf);
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const dx = x - cx;
          const dy = y - cy;
          const d2 = dx * dx + dy * dy;
          if (d2 > r2) continue;
          const falloff = 1 - Math.sqrt(d2) / r;
          let sum = 0;
          let cnt = 0;
          for (let ky = -2; ky <= 2; ky++) {
            for (let kx = -2; kx <= 2; kx++) {
              const sx = Math.min(DEPTH_TEX_W - 1, Math.max(0, x + kx));
              const sy = Math.min(DEPTH_TEX_H - 1, Math.max(0, y + ky));
              sum += copy[sy * DEPTH_TEX_W + sx];
              cnt++;
            }
          }
          const avg = sum / cnt;
          const idx = y * DEPTH_TEX_W + x;
          buf[idx] = buf[idx] + (avg - buf[idx]) * falloff * brushStrength;
        }
      }
    } else {
      const target = brushMode === 'raise' ? 1 : 0;
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const dx = x - cx;
          const dy = y - cy;
          const d2 = dx * dx + dy * dy;
          if (d2 > r2) continue;
          const falloff = 1 - Math.sqrt(d2) / r;
          const smoothFalloff = falloff * falloff * (3 - 2 * falloff);
          const idx = y * DEPTH_TEX_W + x;
          buf[idx] = buf[idx] + (target - buf[idx]) * smoothFalloff * brushStrength * 0.45;
        }
      }
    }

    redrawDisplayCanvas();
    onLiveDepthPixels(layer.id, buf.slice());
  };

  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * DEPTH_TEX_W,
      y: ((e.clientY - rect.top) / rect.height) * DEPTH_TEX_H,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!layer) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    paintingRef.current = true;
    const pt = getCanvasCoords(e);
    lastPtRef.current = pt;
    applyBrushAt(pt.x, pt.y);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!paintingRef.current || !layer) return;
    const pt = getCanvasCoords(e);
    const prev = lastPtRef.current || pt;
    const dist = Math.hypot(pt.x - prev.x, pt.y - prev.y);
    const steps = Math.max(1, Math.ceil(dist / Math.max(2, brushSize * 0.25)));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      applyBrushAt(prev.x + (pt.x - prev.x) * t, prev.y + (pt.y - prev.y) * t);
    }
    lastPtRef.current = pt;
  };

  const commitDepthBuffer = () => {
    if (!layer) return;
    const outCan = document.createElement('canvas');
    outCan.width = DEPTH_TEX_W;
    outCan.height = DEPTH_TEX_H;
    const ctx = outCan.getContext('2d')!;
    const buf = depthBufRef.current;
    const imgData = ctx.createImageData(DEPTH_TEX_W, DEPTH_TEX_H);
    for (let i = 0; i < buf.length; i++) {
      const v = Math.round(Math.min(1, Math.max(0, buf[i])) * 255);
      const idx = i * 4;
      imgData.data[idx] = v;
      imgData.data[idx + 1] = v;
      imgData.data[idx + 2] = v;
      imgData.data[idx + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
    onCommitDepthUrl(layer.id, outCan.toDataURL('image/png'));
  };

  const handlePointerUp = () => {
    if (!paintingRef.current) return;
    paintingRef.current = false;
    lastPtRef.current = null;
    commitDepthBuffer();
  };

  const handleFlatten = () => {
    if (!layer) return;
    depthBufRef.current.fill(0.5);
    redrawDisplayCanvas();
    onLiveDepthPixels(layer.id, depthBufRef.current.slice());
    commitDepthBuffer();
  };

  if (!layer) {
    return (
      <div className="text-sm text-slate-400 py-6 text-center">
        Select a layer to paint its 3D depth relief map.
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row items-start gap-5">
      {/* Interactive Paintable Canvas */}
      <div className="flex items-center gap-4 shrink-0">
        <div className="relative rounded-lg overflow-hidden border border-white/15 bg-black">
          <canvas
            ref={canvasRef}
            width={DEPTH_TEX_W}
            height={DEPTH_TEX_H}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="w-[128px] h-[179px] cursor-crosshair touch-none block"
          />
        </div>
        <div className="text-xs text-slate-400 max-w-[140px] space-y-1.5">
          <p className="font-medium text-slate-200 truncate">{layer.name}</p>
          <p>White strokes push 3D geometry forward; black recesses inward.</p>
          <button
            type="button"
            onClick={() => setShowArtOverlay((v) => !v)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 cursor-pointer"
          >
            {showArtOverlay ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>{showArtOverlay ? 'Art Guide On' : 'Art Guide Off'}</span>
          </button>
        </div>
      </div>

      {/* Brush Controls */}
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 w-full">
        <div>
          <span className="block text-xs text-slate-400 mb-1.5">Sculpt Brush Mode</span>
          <div className="flex items-center gap-1 p-1 bg-[#0B0D12] rounded-lg border border-white/10">
            {(
              [
                { id: 'raise', label: 'Raise (+)' },
                { id: 'carve', label: 'Carve (-)' },
                { id: 'smooth', label: 'Smooth' },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setBrushMode(m.id)}
                className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  brushMode === m.id
                    ? 'bg-amber-400 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => onAutoDepth(layer.id)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium rounded-lg bg-white/10 hover:bg-white/15 text-slate-100 border border-white/10 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Auto-Depth
          </button>
          <button
            type="button"
            onClick={handleFlatten}
            className="inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Flat
          </button>
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400">Brush Size</span>
            <span className="font-mono-num text-slate-200">{brushSize}px</span>
          </div>
          <input
            type="range"
            min={8}
            max={64}
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="w-full studio-slider"
          />
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400">Brush Strength</span>
            <span className="font-mono-num text-slate-200">{Math.round(brushStrength * 100)}%</span>
          </div>
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={brushStrength}
            onChange={(e) => setBrushStrength(Number(e.target.value))}
            className="w-full studio-slider"
          />
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400">3D Mesh Pop-Out Relief</span>
            <span className="font-mono-num text-amber-400">
              {layer.displacementScale.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={0.45}
            step={0.01}
            value={layer.displacementScale}
            onChange={(e) =>
              onUpdateLayer(layer.id, { displacementScale: Number(e.target.value) })
            }
            className="w-full studio-slider"
          />
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400">Layer Z-Plane Position</span>
            <span className="font-mono-num text-slate-200">
              {layer.zOffset >= 0 ? '+' : ''}
              {layer.zOffset.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min={-0.15}
            max={0.35}
            step={0.01}
            value={layer.zOffset}
            onChange={(e) =>
              onUpdateLayer(layer.id, { zOffset: Number(e.target.value) })
            }
            className="w-full studio-slider"
          />
        </div>
      </div>
    </div>
  );
};
