import React from 'react';
import type { DockTab } from '../types/card';

interface TopBarProps {
  activeTab: DockTab;
  dockOpen: boolean;
  onSelectTab: (tab: DockTab) => void;
  onExportPng: () => void;
}

const NAV_TABS: Array<{ id: DockTab; label: string }> = [
  { id: 'layers', label: 'Layers & Depth' },
  { id: 'assets', label: 'Asset Library' },
  { id: 'frames', label: 'Frame Studio' },
  { id: 'foil', label: 'Foil & FX' },
  { id: 'slab', label: 'Slab & Export' },
];

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  dockOpen,
  onSelectTab,
  onExportPng,
}) => {
  return (
    <header className="fixed top-0 left-0 right-0 z-20 flex items-center justify-between gap-8 px-6 h-14 bg-[#0D1017]/95 border-b border-white/10">
      {/* Zone 1: Single-element Brand Wordmark */}
      <a
        href="#top"
        onClick={(e) => {
          e.preventDefault();
          onSelectTab('layers');
        }}
        className="font-display text-lg font-bold tracking-tight text-slate-50 whitespace-nowrap shrink-0"
      >
        VCA 3D Card Lab
      </a>

      {/* Zone 2: Clean single-line navigation tabs (5 items) */}
      <nav className="hidden md:flex items-center gap-6" aria-label="Studio Sections">
        {NAV_TABS.map((tab) => {
          const isActive = dockOpen && activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={`relative py-1.5 text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                isActive
                  ? 'text-amber-400'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              {tab.label}
              {isActive && (
                <span className="absolute left-0 right-0 -bottom-[1px] h-0.5 bg-amber-400" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: Primary Action */}
      <div className="flex items-center shrink-0">
        <button
          type="button"
          onClick={onExportPng}
          className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          Export PNG
        </button>
      </div>
    </header>
  );
};
