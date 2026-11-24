import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Heart,
  Plus,
  Search,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import type { AssetAttribution, LayerRole } from '../types/card';
import {
  ASSET_CATALOG,
  getFavoriteAssets,
  getRecentAssets,
  recordRecentAsset,
  renderLibraryAssetUrl,
  synthesizeCustomAsset,
  toggleFavoriteAsset,
  type SavedAssetRef,
} from '../utils/assetLibrary';
import { PBR_CATALOG, renderPbrPreviewDataUrl } from '../utils/pbrTextures';
import {
  CURATED_POKEMON_INDEX,
  buildSpriteUrl,
  fetchPokemonDetails,
  formatPokemonName,
  getPokemonIndex,
  type PokemonDetailResult,
  type PokemonEntry,
  type PokemonVariant,
} from '../utils/pokemonCatalog';
import { ModelPreviewMini } from './ModelPreviewMini';

export interface AddAssetPayload {
  name: string;
  role: LayerRole;
  kind?: 'image' | 'model3d';
  imageUrl: string;
  remoteUrl?: string;
  isAnimatedGif?: boolean;
  proceduralModelId?: string;
  modelFormat?: 'glb' | 'gltf' | 'obj' | 'procedural';
  replaceBackground?: boolean;
  attribution?: AssetAttribution;
}

interface AssetSearchPanelProps {
  selectedLayerName?: string;
  onAddAssetLayer: (asset: AddAssetPayload) => void;
  onApplyPbrToSelected: (pbrId: string, name: string) => void;
  onImportFiles: (files: FileList) => void;
}

type AssetTab =
  | 'all'
  | 'pokemon'
  | 'vca'
  | 'kenney'
  | 'polyhaven'
  | 'opengameart'
  | 'backgrounds'
  | 'models3d'
  | 'favorites'
  | 'recents';

const TAB_ITEMS: Array<{ id: AssetTab; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'pokemon', label: 'Pokémon 1–9' },
  { id: 'vca', label: 'VCA Original' },
  { id: 'kenney', label: 'Kenney FX' },
  { id: 'opengameart', label: 'Elemental FX' },
  { id: 'polyhaven', label: 'Poly Haven PBR' },
  { id: 'backgrounds', label: 'Backgrounds' },
  { id: 'models3d', label: '3D Objects' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'recents', label: 'Recent' },
];

export const AssetSearchPanel: React.FC<AssetSearchPanelProps> = ({
  selectedLayerName,
  onAddAssetLayer,
  onApplyPbrToSelected,
  onImportFiles,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<AssetTab>('all');
  const [pokemonGen, setPokemonGen] = useState<number>(0); // 0 = All Gens
  const [pokemonVariant, setPokemonVariant] = useState<PokemonVariant>('official_png');
  const [pokemonIndex, setPokemonIndex] = useState<PokemonEntry[]>(CURATED_POKEMON_INDEX);
  const [activePokemon, setActivePokemon] = useState<PokemonDetailResult | null>(null);
  const [loadingPokemon, setLoadingPokemon] = useState(false);

  const [preview3D, setPreview3D] = useState<{
    name: string;
    role: LayerRole;
    proceduralModelId: string;
    imageUrl: string;
    attribution: AssetAttribution;
  } | null>(null);

  const [favorites, setFavorites] = useState<SavedAssetRef[]>(() => getFavoriteAssets());
  const [recents, setRecents] = useState<SavedAssetRef[]>(() => getRecentAssets());

  // Load full Gen 1-9 PokéAPI species list when browsing Pokémon or searching
  useEffect(() => {
    if (tab === 'pokemon' || query.trim().length >= 2) {
      getPokemonIndex().then((list) => setPokemonIndex(list));
    }
  }, [tab, query]);

  const pbrPreviews = useMemo(
    () =>
      PBR_CATALOG.map((p) => ({
        ...p,
        previewUrl: renderPbrPreviewDataUrl(p.id),
      })),
    []
  );

  const filteredLocalAssets = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ASSET_CATALOG.filter((asset) => {
      if (tab === 'vca') {
        if (asset.sourceCategory !== 'characters' && asset.sourceCategory !== 'frames' && asset.sourceCategory !== 'foreground') {
          return false;
        }
      } else if (tab === 'kenney' && asset.sourceCategory !== 'kenney_fx') {
        return false;
      } else if (tab === 'opengameart' && asset.sourceCategory !== 'oga_effects') {
        return false;
      } else if (tab === 'backgrounds' && asset.kind !== 'background') {
        return false;
      } else if (tab === 'models3d' && asset.kind !== 'model3d') {
        return false;
      } else if (tab === 'pokemon' || tab === 'polyhaven' || tab === 'favorites' || tab === 'recents') {
        return false;
      }

      if (!q) return true;
      return (
        asset.name.toLowerCase().includes(q) ||
        asset.category.toLowerCase().includes(q) ||
        asset.tags.some((t) => t.toLowerCase().includes(q))
      );
    }).map((asset) => ({
      ...asset,
      url: renderLibraryAssetUrl(asset),
    }));
  }, [query, tab]);

  const filteredPokemon = useMemo(() => {
    if (tab !== 'pokemon' && (tab !== 'all' || query.trim().length < 2)) {
      return [];
    }
    const q = query.trim().toLowerCase();
    return pokemonIndex
      .filter((p) => {
        if (pokemonGen > 0 && p.generation !== pokemonGen) return false;
        if (!q) return true;
        return p.name.includes(q) || String(p.id) === q || `#${p.id}` === q;
      })
      .slice(0, tab === 'pokemon' ? 28 : 8);
  }, [pokemonIndex, pokemonGen, query, tab]);

  const handleAddPayload = (payload: AddAssetPayload, favKey: string) => {
    const updatedRecents = recordRecentAsset({
      key: favKey,
      name: payload.name,
      imageUrl: payload.imageUrl,
      role: payload.role,
      kind: payload.kind === 'model3d' ? 'model3d' : payload.replaceBackground ? 'background' : 'png',
      proceduralModelId: payload.proceduralModelId,
      attribution: payload.attribution,
    });
    setRecents(updatedRecents);
    onAddAssetLayer(payload);
  };

  const handleToggleFav = (refItem: SavedAssetRef) => {
    setFavorites(toggleFavoriteAsset(refItem));
  };

  const isFav = (key: string) => favorites.some((f) => f.key === key);

  const openPokemonInspector = async (entry: PokemonEntry) => {
    setLoadingPokemon(true);
    try {
      const details = await fetchPokemonDetails(entry);
      setActivePokemon(details);
    } finally {
      setLoadingPokemon(false);
    }
  };

  const handleSynthesize = (kind: 'png' | 'background') => {
    const generated = synthesizeCustomAsset(query || 'Astral Prism', kind);
    handleAddPayload(
      {
        ...generated,
        replaceBackground: kind === 'background',
      },
      `synth-${kind}-${query || 'custom'}`
    );
  };

  return (
    <div className="space-y-2.5">
      {/* Top Search & Universal Upload Row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative flex-1 min-w-[210px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Pokémon #1–1025, PNG cutouts, PBR textures, 3D objects, flames..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#0B0D12] border border-white/15 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
          />
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 cursor-pointer whitespace-nowrap shrink-0"
        >
          <Upload className="w-3.5 h-3.5" />
          Import PNG / GIF / GLB / OBJ
        </button>
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

        {query.trim().length > 0 && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleSynthesize('png')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white/10 hover:bg-white/15 text-amber-300 border border-white/10 cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Synth PNG
            </button>
            <button
              type="button"
              onClick={() => handleSynthesize('background')}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 cursor-pointer whitespace-nowrap"
            >
              Synth BG
            </button>
          </div>
        )}
      </div>

      {/* Category Switcher Row */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-0.5">
        <div className="flex items-center gap-1 p-0.5 bg-[#0B0D12] rounded-lg border border-white/10">
          {TAB_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                tab === item.id
                  ? 'bg-amber-400 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === 'pokemon' && (
          <div className="flex items-center gap-1.5 shrink-0">
            <select
              value={pokemonGen}
              onChange={(e) => setPokemonGen(Number(e.target.value))}
              className="bg-[#0B0D12] border border-white/15 rounded-md px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-amber-400"
            >
              <option value={0}>All Gens (1–9)</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((g) => (
                <option key={g} value={g}>
                  Gen {g}
                </option>
              ))}
            </select>
            <select
              value={pokemonVariant}
              onChange={(e) => setPokemonVariant(e.target.value as PokemonVariant)}
              className="bg-[#0B0D12] border border-white/15 rounded-md px-2 py-1 text-[11px] text-amber-300 focus:outline-none focus:border-amber-400"
            >
              <option value="official_png">Official Art PNG</option>
              <option value="home_png">HOME 3D PNG</option>
              <option value="home_shiny_png">HOME Shiny PNG</option>
              <option value="animated_front_gif">Animated Front GIF</option>
              <option value="animated_back_gif">Animated Back GIF</option>
              <option value="animated_shiny_gif">Animated Shiny GIF</option>
            </select>
          </div>
        )}
      </div>

      {/* Pokémon Detailed Forms & Views Inspector Drawer */}
      {activePokemon && (
        <div className="p-3 rounded-lg bg-[#0B0D12] border border-amber-400/40 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-semibold text-white">
                #{activePokemon.id} {activePokemon.name}
                {activePokemon.types.length > 0 && (
                  <span className="ml-2 font-normal text-slate-400">
                    {activePokemon.types.join(' · ')}
                  </span>
                )}
              </h4>
              <p className="text-[10px] text-amber-300/90">
                {activePokemon.attribution.source} · {activePokemon.attribution.license}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActivePokemon(null)}
              className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {activePokemon.forms.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-slate-400">Alternate Forms:</span>
              {activePokemon.forms.map((form) => (
                <button
                  key={form.id}
                  type="button"
                  onClick={() =>
                    openPokemonInspector({
                      id: form.id,
                      name: form.name.toLowerCase().replace(/\s+/g, '-'),
                      generation: activePokemon.generation,
                    })
                  }
                  className={`px-2 py-0.5 text-[10px] rounded border cursor-pointer ${
                    form.id === activePokemon.id
                      ? 'bg-amber-400 text-slate-950 border-amber-400 font-semibold'
                      : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                  }`}
                >
                  {form.name}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {activePokemon.variants.map((v) => (
              <button
                key={v.variant}
                type="button"
                onClick={() =>
                  handleAddPayload(
                    {
                      name: `${activePokemon.name} (${v.label})`,
                      role: 'character',
                      kind: 'image',
                      imageUrl: v.url,
                      remoteUrl: v.url,
                      isAnimatedGif: v.isAnimated,
                      attribution: {
                        ...activePokemon.attribution,
                        format: v.format,
                      },
                    },
                    `poke-${activePokemon.id}-${v.variant}`
                  )
                }
                className="flex flex-col items-center gap-1 p-2 rounded-lg bg-[#141824] border border-white/10 hover:border-amber-400 cursor-pointer"
              >
                <img
                  src={v.url}
                  alt={v.label}
                  className="w-12 h-12 object-contain"
                />
                <span className="text-[10px] font-medium text-slate-200 text-center leading-tight">
                  {v.label}
                </span>
                <span className="text-[9px] font-mono-num text-amber-400">
                  {v.format} · {v.view}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Interactive 3D Object Preview Drawer */}
      {preview3D && (
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-3 rounded-lg bg-[#0B0D12] border border-amber-400/40 items-center">
          <div className="sm:col-span-5">
            <ModelPreviewMini proceduralModelId={preview3D.proceduralModelId} />
          </div>
          <div className="sm:col-span-7 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold text-white">{preview3D.name}</h4>
                <p className="text-[11px] text-slate-400">
                  {preview3D.attribution.source} · {preview3D.attribution.license}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreview3D(null)}
                className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-300">
              Genuine multi-part 3D collectible mesh rendered inside Three.js with real perspective, lighting, and transform gizmos.
            </p>
            <button
              type="button"
              onClick={() => {
                handleAddPayload(
                  {
                    name: preview3D.name,
                    role: preview3D.role,
                    kind: 'model3d',
                    imageUrl: preview3D.imageUrl,
                    proceduralModelId: preview3D.proceduralModelId,
                    modelFormat: 'procedural',
                    attribution: preview3D.attribution,
                  },
                  `3d-${preview3D.proceduralModelId}`
                );
                setPreview3D(null);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-amber-400 hover:bg-amber-300 text-slate-950 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add 3D Object to Card
            </button>
          </div>
        </div>
      )}

      {/* Pokémon Attribution Notice */}
      {tab === 'pokemon' && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 px-1">
          <span>
            PokéAPI Gen 1–9 Reference Catalogue (Official PNGs &amp; Showdown Animated GIFs — distinct from downloadable GLB/OBJ meshes).
          </span>
          <span className="text-amber-300/90">
            Third-Party IP · Non-Commercial Reference Only
          </span>
        </div>
      )}

      {/* Poly Haven PBR Materials Grid */}
      {tab === 'polyhaven' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
            <span>
              Poly Haven CC0 Procedural PBR Normal &amp; Roughness Maps — click to apply surface relief to{' '}
              <strong className="text-slate-200">{selectedLayerName || 'selected layer'}</strong>.
            </span>
            <span className="text-emerald-400">CC0 Public Domain · Commercial OK</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
            {pbrPreviews.map((pbr) => (
              <div
                key={pbr.id}
                className="flex flex-col rounded-lg border border-white/10 bg-[#0B0D12]/90 overflow-hidden hover:border-amber-400/60"
              >
                <div className="h-20 relative overflow-hidden bg-black">
                  <img
                    src={pbr.previewUrl}
                    alt={pbr.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-2 space-y-1.5 flex-1 flex flex-col justify-between">
                  <div>
                    <p className="text-[11px] font-semibold text-slate-100 truncate">
                      {pbr.name}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {pbr.license}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onApplyPbrToSelected(pbr.id, pbr.name)}
                    className="w-full py-1 px-2 text-[11px] font-semibold rounded bg-white/10 hover:bg-amber-400 text-slate-100 hover:text-slate-950 transition-colors cursor-pointer"
                  >
                    Apply PBR Map
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Favorites & Recents Views */}
      {(tab === 'favorites' || tab === 'recents') && (
        <div>
          {(tab === 'favorites' ? favorites : recents).length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400 border border-white/10 rounded-lg bg-[#0B0D12]/60">
              {tab === 'favorites'
                ? 'No favorited assets yet — click the heart icon on any card to bookmark it.'
                : 'Recently added characters, effects, and 3D assets will appear here.'}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-2.5">
              {(tab === 'favorites' ? favorites : recents).map((item) => (
                <div
                  key={item.key}
                  className="flex flex-col rounded-lg border border-white/10 bg-[#0B0D12]/90 overflow-hidden hover:border-amber-400/60"
                >
                  <div className="h-20 flex items-center justify-center p-1.5 bg-[#0d1017]">
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <div className="p-2 border-t border-white/10 space-y-1">
                    <p className="text-[11px] font-medium text-slate-100 truncate">
                      {item.name}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        handleAddPayload(
                          {
                            name: item.name,
                            role: item.role,
                            kind: item.kind === 'model3d' ? 'model3d' : 'image',
                            imageUrl: item.imageUrl,
                            proceduralModelId: item.proceduralModelId,
                            replaceBackground: item.kind === 'background',
                            attribution: item.attribution,
                          },
                          item.key
                        )
                      }
                      className="w-full py-1 text-[11px] font-semibold rounded bg-white/10 hover:bg-amber-400 text-slate-100 hover:text-slate-950 cursor-pointer"
                    >
                      Add Again
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Combined Asset Grid (Pokémon + Local VCA/Kenney/OGA/3D Objects) */}
      {tab !== 'polyhaven' && tab !== 'favorites' && tab !== 'recents' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7 gap-2.5">
          {/* Pokémon Search Results */}
          {filteredPokemon.map((entry) => {
            const url = buildSpriteUrl(entry.id, pokemonVariant);
            const displayName = formatPokemonName(entry.name);
            const favKey = `poke-${entry.id}-${pokemonVariant}`;
            const attribution: AssetAttribution = {
              source: 'PokéAPI Sprites & Project Pokémon Index',
              license: 'Third-Party IP (Non-Commercial Reference Only)',
              url: 'https://github.com/PokeAPI/sprites',
              commercialOk: false,
              format: pokemonVariant.includes('gif') ? 'GIF' : 'PNG',
            };
            const dragData = JSON.stringify({
              name: displayName,
              role: 'character',
              kind: 'image',
              imageUrl: url,
              remoteUrl: url,
              isAnimatedGif: pokemonVariant.includes('gif'),
              attribution,
            });
            return (
              <div
                key={favKey}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('application/x-vca-asset', dragData)}
                className="group relative flex flex-col rounded-lg border border-white/10 bg-[#0B0D12]/90 overflow-hidden hover:border-amber-400/60"
              >
                <button
                  type="button"
                  title="Bookmark Asset"
                  onClick={() =>
                    handleToggleFav({
                      key: favKey,
                      name: displayName,
                      imageUrl: url,
                      role: 'character',
                      kind: 'png',
                      attribution,
                    })
                  }
                  className="absolute top-1.5 right-1.5 z-10 p-1 rounded bg-black/60 text-slate-300 hover:text-rose-400 cursor-pointer"
                >
                  <Heart
                    className={`w-3 h-3 ${isFav(favKey) ? 'fill-rose-500 text-rose-500' : ''}`}
                  />
                </button>

                <div
                  onClick={() => openPokemonInspector(entry)}
                  className="relative h-20 flex items-center justify-center p-1.5 bg-[#0d1017] cursor-pointer"
                  title="Inspect alternate forms & animated GIF views"
                >
                  <img
                    src={url}
                    alt={displayName}
                    loading="lazy"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>

                <div className="p-2 flex flex-col gap-1 border-t border-white/10">
                  <p className="text-[11px] font-medium text-slate-100 truncate">
                    #{entry.id} {displayName}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">
                    Gen {entry.generation || 'Var'} · {pokemonVariant.includes('gif') ? 'GIF' : 'PNG'} · Non-Comm
                  </p>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        handleAddPayload(
                          {
                            name: displayName,
                            role: 'character',
                            kind: 'image',
                            imageUrl: url,
                            remoteUrl: url,
                            isAnimatedGif: pokemonVariant.includes('gif'),
                            attribution,
                          },
                          favKey
                        )
                      }
                      className="flex-1 inline-flex items-center justify-center gap-1 py-1 px-1.5 text-[10px] font-semibold rounded bg-white/10 hover:bg-amber-400 text-slate-100 hover:text-slate-950 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      Add
                    </button>
                    <button
                      type="button"
                      disabled={loadingPokemon}
                      onClick={() => openPokemonInspector(entry)}
                      className="px-2 py-1 text-[10px] rounded bg-white/5 hover:bg-white/15 text-slate-300 cursor-pointer"
                    >
                      Views
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Local Library Items (VCA, Kenney CC0, OpenGameArt CC0, Backgrounds, 3D Objects) */}
          {filteredLocalAssets.map((asset) => {
            const favKey = `lib-${asset.id}`;
            const payload: AddAssetPayload = {
              name: asset.name,
              role: asset.role,
              kind: asset.kind === 'model3d' ? 'model3d' : 'image',
              imageUrl: asset.url,
              proceduralModelId: asset.proceduralModelId,
              modelFormat: asset.kind === 'model3d' ? 'procedural' : undefined,
              replaceBackground: asset.kind === 'background',
              attribution: asset.attribution,
            };
            return (
              <div
                key={asset.id}
                draggable
                onDragStart={(e) =>
                  e.dataTransfer.setData('application/x-vca-asset', JSON.stringify(payload))
                }
                className="group relative flex flex-col rounded-lg border border-white/10 bg-[#0B0D12]/90 overflow-hidden hover:border-amber-400/60 transition-colors"
              >
                <button
                  type="button"
                  title="Favorite Asset"
                  onClick={() =>
                    handleToggleFav({
                      key: favKey,
                      name: asset.name,
                      imageUrl: asset.url,
                      role: asset.role,
                      kind: asset.kind,
                      proceduralModelId: asset.proceduralModelId,
                      attribution: asset.attribution,
                    })
                  }
                  className="absolute top-1.5 right-1.5 z-10 p-1 rounded bg-black/60 text-slate-300 hover:text-rose-400 cursor-pointer"
                >
                  <Heart
                    className={`w-3 h-3 ${isFav(favKey) ? 'fill-rose-500 text-rose-500' : ''}`}
                  />
                </button>

                <div
                  className="relative h-20 flex items-center justify-center p-1.5"
                  style={{
                    backgroundImage:
                      asset.kind !== 'background'
                        ? 'linear-gradient(45deg, #161b26 25%, transparent 25%), linear-gradient(-45deg, #161b26 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #161b26 75%), linear-gradient(-45deg, transparent 75%, #161b26 75%)'
                        : undefined,
                    backgroundSize: asset.kind !== 'background' ? '12px 12px' : undefined,
                    backgroundPosition:
                      asset.kind !== 'background'
                        ? '0 0, 0 6px, 6px -6px, -6px 0px'
                        : undefined,
                    backgroundColor:
                      asset.kind !== 'background' ? '#0d1017' : asset.previewBg,
                  }}
                >
                  <img
                    src={asset.url}
                    alt={asset.name}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>

                <div className="p-2 flex flex-col gap-1 border-t border-white/10">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-slate-100 truncate">
                      {asset.name}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {asset.attribution.format} ·{' '}
                      {asset.attribution.commercialOk ? 'CC0' : 'Ref'}
                    </p>
                  </div>

                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => handleAddPayload(payload, favKey)}
                      className="flex-1 inline-flex items-center justify-center gap-1 py-1 px-1.5 text-[10px] font-semibold rounded bg-white/10 hover:bg-amber-400 text-slate-100 hover:text-slate-950 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Plus className="w-3 h-3" />
                      {asset.kind === 'background' ? 'Set BG' : 'Add'}
                    </button>
                    {asset.kind === 'model3d' && asset.proceduralModelId && (
                      <button
                        type="button"
                        title="Interactive 3D Orbit Preview"
                        onClick={() =>
                          setPreview3D({
                            name: asset.name,
                            role: asset.role,
                            proceduralModelId: asset.proceduralModelId!,
                            imageUrl: asset.url,
                            attribution: asset.attribution,
                          })
                        }
                        className="px-2 py-1 text-[10px] rounded bg-white/5 hover:bg-white/15 text-amber-300 cursor-pointer"
                      >
                        <Box className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab !== 'polyhaven' &&
        tab !== 'favorites' &&
        tab !== 'recents' &&
        filteredLocalAssets.length === 0 &&
        filteredPokemon.length === 0 && (
          <div className="py-5 text-center text-xs text-slate-400 border border-white/10 rounded-lg bg-[#0B0D12]/60">
            No library match for &ldquo;{query}&rdquo; — click{' '}
            <strong className="text-amber-300">Synth PNG</strong> or{' '}
            <strong className="text-slate-200">Synth BG</strong> above, or switch to{' '}
            <button
              type="button"
              onClick={() => setTab('pokemon')}
              className="text-amber-400 underline cursor-pointer"
            >
              Pokémon 1–9
            </button>
            .
          </div>
        )}
    </div>
  );
};
