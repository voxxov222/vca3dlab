import type { AssetAttribution } from '../types/card';

export type PokemonVariant =
  | 'official_png'
  | 'home_png'
  | 'home_shiny_png'
  | 'animated_front_gif'
  | 'animated_back_gif'
  | 'animated_shiny_gif';

export interface PokemonEntry {
  id: number;
  name: string;
  generation: number;
  form?: string;
}

export interface PokemonDetailResult {
  id: number;
  name: string;
  generation: number;
  types: string[];
  forms: Array<{ name: string; id: number }>;
  variants: Array<{
    variant: PokemonVariant;
    label: string;
    format: 'PNG' | 'GIF';
    url: string;
    view: 'Front' | 'Back' | 'Artwork' | 'Animated';
    isAnimated: boolean;
  }>;
  attribution: AssetAttribution;
}

const GEN_RANGES: Array<[number, number, number]> = [
  [1, 1, 151],
  [2, 152, 251],
  [3, 252, 386],
  [4, 387, 493],
  [5, 494, 649],
  [6, 650, 721],
  [7, 722, 809],
  [8, 810, 905],
  [9, 906, 1025],
];

export function getGenerationForDex(id: number): number {
  for (const [gen, min, max] of GEN_RANGES) {
    if (id >= min && id <= max) return gen;
  }
  return id > 10000 ? 0 : 9;
}

/**
 * Instant curated starter index across Generations 1-9 so search works immediately
 * while the full 1,025-species PokéAPI index loads and caches in the background.
 */
export const CURATED_POKEMON_INDEX: PokemonEntry[] = [
  { id: 1, name: 'bulbasaur', generation: 1 },
  { id: 4, name: 'charmander', generation: 1 },
  { id: 6, name: 'charizard', generation: 1 },
  { id: 7, name: 'squirtle', generation: 1 },
  { id: 9, name: 'blastoise', generation: 1 },
  { id: 25, name: 'pikachu', generation: 1 },
  { id: 38, name: 'ninetales', generation: 1 },
  { id: 59, name: 'arcanine', generation: 1 },
  { id: 94, name: 'gengar', generation: 1 },
  { id: 130, name: 'gyarados', generation: 1 },
  { id: 131, name: 'lapras', generation: 1 },
  { id: 133, name: 'eevee', generation: 1 },
  { id: 143, name: 'snorlax', generation: 1 },
  { id: 149, name: 'dragonite', generation: 1 },
  { id: 150, name: 'mewtwo', generation: 1 },
  { id: 151, name: 'mew', generation: 1 },
  { id: 196, name: 'espeon', generation: 2 },
  { id: 197, name: 'umbreon', generation: 2 },
  { id: 248, name: 'tyranitar', generation: 2 },
  { id: 249, name: 'lugia', generation: 2 },
  { id: 250, name: 'ho-oh', generation: 2 },
  { id: 257, name: 'blaziken', generation: 3 },
  { id: 282, name: 'gardevoir', generation: 3 },
  { id: 376, name: 'metagross', generation: 3 },
  { id: 384, name: 'rayquaza', generation: 3 },
  { id: 445, name: 'garchomp', generation: 4 },
  { id: 448, name: 'lucario', generation: 4 },
  { id: 487, name: 'giratina', generation: 4 },
  { id: 493, name: 'arceus', generation: 4 },
  { id: 609, name: 'chandelure', generation: 5 },
  { id: 635, name: 'hydreigon', generation: 5 },
  { id: 643, name: 'reshiram', generation: 5 },
  { id: 644, name: 'zekrom', generation: 5 },
  { id: 658, name: 'greninja', generation: 6 },
  { id: 700, name: 'sylveon', generation: 6 },
  { id: 717, name: 'yveltal', generation: 6 },
  { id: 778, name: 'mimikyu', generation: 7 },
  { id: 791, name: 'solgaleo', generation: 7 },
  { id: 800, name: 'necrozma', generation: 7 },
  { id: 887, name: 'dragapult', generation: 8 },
  { id: 888, name: 'zacian', generation: 8 },
  { id: 937, name: 'ceruledge', generation: 9 },
  { id: 980, name: 'clodsire', generation: 9 },
  { id: 1007, name: 'koraidon', generation: 9 },
  { id: 1008, name: 'miraidon', generation: 9 },
];

const SPECIES_CACHE_KEY = 'vca_pokeapi_species_index_v1';
let memoryIndex: PokemonEntry[] | null = null;
const detailCache = new Map<number, PokemonDetailResult>();

export function buildSpriteUrl(id: number, variant: PokemonVariant): string {
  const base = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';
  switch (variant) {
    case 'official_png':
      return `${base}/other/official-artwork/${id}.png`;
    case 'home_png':
      return `${base}/other/home/${id}.png`;
    case 'home_shiny_png':
      return `${base}/other/home/shiny/${id}.png`;
    case 'animated_front_gif':
      return `${base}/other/showdown/${id}.gif`;
    case 'animated_back_gif':
      return `${base}/other/showdown/back/${id}.gif`;
    case 'animated_shiny_gif':
      return `${base}/other/showdown/shiny/${id}.gif`;
  }
}

export function formatPokemonName(raw: string): string {
  return raw
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export async function getPokemonIndex(): Promise<PokemonEntry[]> {
  if (memoryIndex) return memoryIndex;

  try {
    const cachedRaw = localStorage.getItem(SPECIES_CACHE_KEY);
    if (cachedRaw) {
      const parsed = JSON.parse(cachedRaw) as PokemonEntry[];
      if (Array.isArray(parsed) && parsed.length > 500) {
        memoryIndex = parsed;
        return parsed;
      }
    }
  } catch {
    // Ignore storage read errors
  }

  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 5000);
    const res = await fetch('https://pokeapi.co/api/v2/pokemon?limit=1025', {
      signal: controller.signal,
    });
    window.clearTimeout(timer);
    if (res.ok) {
      const json = (await res.json()) as {
        results: Array<{ name: string; url: string }>;
      };
      const entries: PokemonEntry[] = json.results
        .map((r) => {
          const match = r.url.match(/\/pokemon\/(\d+)\/?$/);
          const id = match ? Number(match[1]) : 0;
          return {
            id,
            name: r.name,
            generation: getGenerationForDex(id),
          };
        })
        .filter((e) => e.id > 0);
      memoryIndex = entries;
      try {
        localStorage.setItem(SPECIES_CACHE_KEY, JSON.stringify(entries));
      } catch {
        // Ignore quota errors
      }
      return entries;
    }
  } catch {
    // Fallback cleanly to curated index if offline/blocked
  }

  memoryIndex = CURATED_POKEMON_INDEX;
  return CURATED_POKEMON_INDEX;
}

export function buildVariantsForPokemon(id: number): PokemonDetailResult['variants'] {
  return [
    {
      variant: 'official_png',
      label: 'Official Artwork',
      format: 'PNG',
      url: buildSpriteUrl(id, 'official_png'),
      view: 'Artwork',
      isAnimated: false,
    },
    {
      variant: 'home_png',
      label: 'HOME 3D Render',
      format: 'PNG',
      url: buildSpriteUrl(id, 'home_png'),
      view: 'Front',
      isAnimated: false,
    },
    {
      variant: 'home_shiny_png',
      label: 'HOME Shiny Form',
      format: 'PNG',
      url: buildSpriteUrl(id, 'home_shiny_png'),
      view: 'Front',
      isAnimated: false,
    },
    {
      variant: 'animated_front_gif',
      label: 'Animated Front GIF',
      format: 'GIF',
      url: buildSpriteUrl(id, 'animated_front_gif'),
      view: 'Animated',
      isAnimated: true,
    },
    {
      variant: 'animated_back_gif',
      label: 'Animated Back GIF',
      format: 'GIF',
      url: buildSpriteUrl(id, 'animated_back_gif'),
      view: 'Back',
      isAnimated: true,
    },
    {
      variant: 'animated_shiny_gif',
      label: 'Animated Shiny GIF',
      format: 'GIF',
      url: buildSpriteUrl(id, 'animated_shiny_gif'),
      view: 'Animated',
      isAnimated: true,
    },
  ];
}

export async function fetchPokemonDetails(entry: PokemonEntry): Promise<PokemonDetailResult> {
  const existing = detailCache.get(entry.id);
  if (existing) return existing;

  const fallback: PokemonDetailResult = {
    id: entry.id,
    name: formatPokemonName(entry.name),
    generation: entry.generation,
    types: [],
    forms: [{ name: formatPokemonName(entry.name), id: entry.id }],
    variants: buildVariantsForPokemon(entry.id),
    attribution: {
      source: 'PokéAPI Sprites & Project Pokémon Animated Index',
      license: 'Third-Party IP (Non-Commercial Reference Only)',
      url: `https://github.com/PokeAPI/sprites`,
      commercialOk: false,
      format: 'PNG',
    },
  };

  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 3500);
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${entry.id}`, {
      signal: controller.signal,
    });
    window.clearTimeout(timer);
    if (res.ok) {
      const data = (await res.json()) as {
        types?: Array<{ type: { name: string } }>;
      };
      fallback.types = (data.types || []).map((t) => formatPokemonName(t.type.name));
    }
    // Also check species varieties (alternate forms like Mega / Regional / Gmax)
    const sRes = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${entry.id}`);
    if (sRes.ok) {
      const sData = (await sRes.json()) as {
        varieties?: Array<{ pokemon: { name: string; url: string } }>;
      };
      if (Array.isArray(sData.varieties) && sData.varieties.length > 0) {
        fallback.forms = sData.varieties
          .map((v) => {
            const m = v.pokemon.url.match(/\/pokemon\/(\d+)\/?$/);
            return {
              name: formatPokemonName(v.pokemon.name),
              id: m ? Number(m[1]) : entry.id,
            };
          })
          .filter((f) => f.id > 0);
      }
    }
  } catch {
    // Keep immediate fallback sprites if PokéAPI JSON endpoint is unreachable
  }

  detailCache.set(entry.id, fallback);
  return fallback;
}
