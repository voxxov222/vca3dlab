import React, { useMemo } from 'react';
import { Download, RotateCcw } from 'lucide-react';
import type { CardProportionPreset, FrameConfig } from '../types/card';
import {
  FRAME_PRESETS,
  createDefaultFrameConfig,
  renderVcaFramePng,
} from '../utils/frameGenerator';

interface FrameBuilderPanelProps {
  frame: FrameConfig;
  onUpdateFrame: (patch: Partial<FrameConfig>) => void;
  onAddFrameAsLayer: (framePngUrl: string, name: string) => void;
}

const PROPORTION_OPTIONS: Array<{ id: CardProportionPreset; label: string; ratio: string }> = [
  { id: 'standard_tcg', label: 'Standard TCG', ratio: '5:7' },
  { id: 'tall_showcase', label: 'Tall Showcase', ratio: '2:3' },
  { id: 'square_relic', label: 'Square Relic', ratio: '1:1' },
];

export const FrameBuilderPanel: React.FC<FrameBuilderPanelProps> = ({
  frame,
  onUpdateFrame,
  onAddFrameAsLayer,
}) => {
  const previewPng = useMemo(() => renderVcaFramePng(frame), [frame]);

  const handleSelectPreset = (presetId: FrameConfig['preset']) => {
    const found = FRAME_PRESETS.find((p) => p.id === presetId);
    if (!found) return;
    onUpdateFrame({
      enabled: true,
      preset: presetId,
      ...found.defaults,
    });
  };

  const handleDownloadFramePng = () => {
    const a = document.createElement('a');
    a.href = previewPng;
    a.download = `vca-frame-${frame.preset}.png`;
    a.click();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Left Column: Live Transparent PNG Preview + Presets */}
      <div className="lg:col-span-4 flex gap-3 items-start">
        <div
          className="w-[116px] h-[162px] rounded-lg border border-white/15 shrink-0 flex items-center justify-center p-1 overflow-hidden"
          style={{
            backgroundImage:
              'linear-gradient(45deg, #161b26 25%, transparent 25%), linear-gradient(-45deg, #161b26 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #161b26 75%), linear-gradient(-45deg, transparent 75%, #161b26 75%)',
            backgroundSize: '12px 12px',
            backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0px',
            backgroundColor: '#0b0f17',
          }}
        >
          <img
            src={previewPng}
            alt="Original VCA Frame Preview"
            className="max-w-full max-h-full object-contain"
          />
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-200">3D Card Frame</span>
            <button
              type="button"
              onClick={() => onUpdateFrame({ enabled: !frame.enabled })}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded cursor-pointer whitespace-nowrap ${
                frame.enabled
                  ? 'bg-amber-400 text-slate-950'
                  : 'bg-white/10 text-slate-300 hover:text-white'
              }`}
            >
              {frame.enabled ? 'Frame Active' : 'Enable Frame'}
            </button>
          </div>

          <p className="text-[11px] text-slate-400 leading-snug">
            Original VCA procedural frame with extruded 3D bezel and alpha-transparent art window.
          </p>

          <div className="flex flex-wrap gap-1.5 pt-1">
            <button
              type="button"
              onClick={handleDownloadFramePng}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-md bg-white/10 hover:bg-white/15 text-slate-100 border border-white/10 cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3 h-3 text-amber-400" />
              Frame PNG
            </button>
            <button
              type="button"
              onClick={() => onAddFrameAsLayer(previewPng, `${frame.preset.replace(/_/g, ' ')} Frame`)}
              className="px-2.5 py-1.5 text-[11px] font-medium rounded-md bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 cursor-pointer whitespace-nowrap"
            >
              Add as Layer
            </button>
            <button
              type="button"
              onClick={() => onUpdateFrame({ ...createDefaultFrameConfig(), enabled: true })}
              title="Reset Frame Settings"
              className="p-1.5 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Middle Column: 10 Original Frame Presets + Card Proportions */}
      <div className="lg:col-span-4 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-300">VCA Frame Styles (10)</span>
          <div className="flex items-center gap-1 bg-[#0B0D12] p-0.5 rounded border border-white/10">
            {PROPORTION_OPTIONS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onUpdateFrame({ proportion: p.id, enabled: true })}
                title={p.label}
                className={`px-2 py-0.5 text-[10px] font-mono-num rounded cursor-pointer whitespace-nowrap ${
                  frame.proportion === p.id
                    ? 'bg-amber-400 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {p.ratio}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5 max-h-[168px] overflow-y-auto studio-scroll pr-1">
          {FRAME_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleSelectPreset(p.id)}
              className={`text-left px-2.5 py-1.5 rounded-md border transition-colors cursor-pointer ${
                frame.preset === p.id && frame.enabled
                  ? 'bg-amber-400/15 border-amber-400 text-white'
                  : 'bg-[#0B0D12]/80 border-white/10 text-slate-300 hover:border-white/25'
              }`}
            >
              <div className="text-[11px] font-semibold truncate">{p.label}</div>
              <div className="text-[10px] text-slate-400 truncate">{p.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Right Column: Geometry, Material & Text Plate Customization */}
      <div className="lg:col-span-4 bg-[#0B0D12]/60 border border-white/10 rounded-lg p-3 space-y-2.5">
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-slate-400">Border Width</span>
              <span className="font-mono-num text-slate-200">{frame.borderThickness}px</span>
            </div>
            <input
              type="range"
              min={10}
              max={48}
              step={1}
              value={frame.borderThickness}
              onChange={(e) =>
                onUpdateFrame({ borderThickness: Number(e.target.value), enabled: true })
              }
              className="w-full studio-slider"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-slate-400">3D Bevel Depth</span>
              <span className="font-mono-num text-amber-400">
                {frame.frameDepth.toFixed(3)}
              </span>
            </div>
            <input
              type="range"
              min={0.01}
              max={0.14}
              step={0.005}
              value={frame.frameDepth}
              onChange={(e) =>
                onUpdateFrame({ frameDepth: Number(e.target.value), enabled: true })
              }
              className="w-full studio-slider"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-slate-400">Corner Radius</span>
              <span className="font-mono-num text-slate-200">{frame.cornerRadius}px</span>
            </div>
            <input
              type="range"
              min={4}
              max={44}
              step={1}
              value={frame.cornerRadius}
              onChange={(e) =>
                onUpdateFrame({ cornerRadius: Number(e.target.value), enabled: true })
              }
              className="w-full studio-slider"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-slate-400">Metal / Holo</span>
              <span className="font-mono-num text-slate-200">
                {Math.round(frame.metallicIntensity * 100)}%
              </span>
            </div>
            <div className="flex gap-1.5">
              <input
                type="range"
                title="Metallic Intensity"
                min={0}
                max={1}
                step={0.05}
                value={frame.metallicIntensity}
                onChange={(e) =>
                  onUpdateFrame({ metallicIntensity: Number(e.target.value), enabled: true })
                }
                className="w-1/2 studio-slider"
              />
              <input
                type="range"
                title="Holo Intensity"
                min={0}
                max={1}
                step={0.05}
                value={frame.holoIntensity}
                onChange={(e) =>
                  onUpdateFrame({ holoIntensity: Number(e.target.value), enabled: true })
                }
                className="w-1/2 studio-slider"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            value={frame.title}
            placeholder="Title Plate"
            onChange={(e) => onUpdateFrame({ title: e.target.value, enabled: true })}
            className="bg-[#121622] border border-white/10 rounded px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:border-amber-400"
          />
          <input
            type="text"
            value={frame.powerLabel}
            placeholder="Power / Stat"
            onChange={(e) => onUpdateFrame({ powerLabel: e.target.value, enabled: true })}
            className="bg-[#121622] border border-white/10 rounded px-2 py-1 text-[11px] font-mono-num text-amber-300 focus:outline-none focus:border-amber-400"
          />
          <input
            type="text"
            value={frame.subtitle}
            placeholder="Edition Subtitle"
            onChange={(e) => onUpdateFrame({ subtitle: e.target.value, enabled: true })}
            className="bg-[#121622] border border-white/10 rounded px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-amber-400"
          />
          <div className="flex items-center gap-1.5">
            <input
              type="color"
              title="Border Color"
              value={frame.borderColor}
              onChange={(e) => onUpdateFrame({ borderColor: e.target.value, enabled: true })}
              className="w-7 h-7 rounded border border-white/15 bg-transparent cursor-pointer shrink-0"
            />
            <input
              type="color"
              title="Accent Color"
              value={frame.accentColor}
              onChange={(e) => onUpdateFrame({ accentColor: e.target.value, enabled: true })}
              className="w-7 h-7 rounded border border-white/15 bg-transparent cursor-pointer shrink-0"
            />
            <button
              type="button"
              onClick={() => onUpdateFrame({ showTextPanels: !frame.showTextPanels })}
              className={`flex-1 py-1 text-[10px] font-medium rounded border cursor-pointer whitespace-nowrap ${
                frame.showTextPanels
                  ? 'bg-white/15 border-amber-400/60 text-white'
                  : 'bg-white/5 border-white/10 text-slate-400'
              }`}
            >
              {frame.showTextPanels ? 'Text On' : 'Textless'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
