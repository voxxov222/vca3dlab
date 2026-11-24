import React, { useEffect, useRef } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Brush,
  Copy,
  Lock,
  RotateCcw,
  Trash2,
  Unlock,
} from 'lucide-react';
import type { CardLayer } from '../types/card';

interface ContextMenuFloatingProps {
  layer: CardLayer | undefined;
  x: number;
  y: number;
  canDelete: boolean;
  onClose: () => void;
  onDuplicate: (id: string) => void;
  onToggleLock: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onOpenDepthPaint: (id: string) => void;
  onResetTransform: (id: string) => void;
  onDelete: (id: string) => void;
}

export const ContextMenuFloating: React.FC<ContextMenuFloatingProps> = ({
  layer,
  x,
  y,
  canDelete,
  onClose,
  onDuplicate,
  onToggleLock,
  onMove,
  onOpenDepthPaint,
  onResetTransform,
  onDelete,
}) => {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutside = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('pointerdown', handleOutside);
    return () => window.removeEventListener('pointerdown', handleOutside);
  }, [onClose]);

  if (!layer) return null;

  const clampedLeft = Math.min(Math.max(12, x), Math.max(12, window.innerWidth - 220));
  const clampedTop = Math.min(Math.max(64, y), Math.max(64, window.innerHeight - 280));

  return (
    <div
      ref={menuRef}
      style={{ left: clampedLeft, top: clampedTop }}
      className="fixed z-40 w-52 rounded-xl bg-[#141824] border border-white/15 shadow-2xl p-1.5 space-y-0.5"
    >
      <div className="px-2.5 py-1 border-b border-white/10 mb-1 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-slate-200 truncate">{layer.name}</span>
        <span className="text-[10px] font-mono-num text-amber-400 uppercase">{layer.role}</span>
      </div>

      <button
        type="button"
        onClick={() => {
          onToggleLock(layer.id);
          onClose();
        }}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/10 rounded-lg cursor-pointer"
      >
        {layer.locked ? (
          <>
            <Unlock className="w-3.5 h-3.5 text-amber-400" />
            <span>Unlock Layer</span>
          </>
        ) : (
          <>
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>Lock Layer</span>
          </>
        )}
      </button>

      <button
        type="button"
        onClick={() => {
          onDuplicate(layer.id);
          onClose();
        }}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/10 rounded-lg cursor-pointer"
      >
        <Copy className="w-3.5 h-3.5 text-slate-400" />
        <span>Duplicate Layer</span>
      </button>

      <button
        type="button"
        onClick={() => {
          onMove(layer.id, 1);
          onClose();
        }}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/10 rounded-lg cursor-pointer"
      >
        <ArrowUp className="w-3.5 h-3.5 text-slate-400" />
        <span>Bring Forward</span>
      </button>

      <button
        type="button"
        onClick={() => {
          onMove(layer.id, -1);
          onClose();
        }}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/10 rounded-lg cursor-pointer"
      >
        <ArrowDown className="w-3.5 h-3.5 text-slate-400" />
        <span>Send Backward</span>
      </button>

      {(!layer.kind || layer.kind === 'image') && (
        <button
          type="button"
          onClick={() => {
            onOpenDepthPaint(layer.id);
            onClose();
          }}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/10 rounded-lg cursor-pointer"
        >
          <Brush className="w-3.5 h-3.5 text-amber-400" />
          <span>Paint 3D Depth Map</span>
        </button>
      )}

      <button
        type="button"
        onClick={() => {
          onResetTransform(layer.id);
          onClose();
        }}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/10 rounded-lg cursor-pointer"
      >
        <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
        <span>Reset Transform</span>
      </button>

      {canDelete && (
        <button
          type="button"
          onClick={() => {
            onDelete(layer.id);
            onClose();
          }}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-red-300 hover:bg-red-500/20 rounded-lg cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete Layer</span>
        </button>
      )}
    </div>
  );
};
