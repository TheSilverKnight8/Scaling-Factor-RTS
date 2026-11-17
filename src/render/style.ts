// In-game colors. The interface keeps the Portal's cream, navy and red; things in the game
// (ground, water, units, structures, resources) use simplified real colors for readability
// (SPEC "Platform and look"), drawn flat with navy outlines like Stickman Arena's figures.

export const CREAM = '#faeeda';
export const NAVY = '#002657';
export const RED = '#fc3f3f';

/** Behind the map. */
export const BACKDROP = '#f3e3c8';
/** The map's outer edge, drawn as a navy slab like Stickman Arena's stages. */
export const EDGE = NAVY;
export const EDGE_DEPTH = 22;

export const GROUND = '#a6c56b';
export const GROUND_DARK = '#93b55c';
export const GROUND_LIGHT = '#b4cf7c';
export const GRASS_MARK = '#6f9446';
export const PEBBLE = '#b9b2a2';

export const WATER = '#5ea6d6';
export const WATER_DEEP = '#4b93c6';
export const WATER_SHORE = '#93c8e8';
export const WAVE = '#e6f3fb';

export const CLIFF_TOP = '#ab9d88';
export const CLIFF_LEFT = '#8f816d';
export const CLIFF_RIGHT = '#76695a';

/** Unexplored tiles: the app's navy, with a slight per-tile change so it is not flat. */
export const FOG = '#0b2a52';
export const FOG_ALT = '#08254a';
/** Explored tiles at the edge of the fog get a light navy wash. */
export const FOG_EDGE = 'rgba(0, 38, 87, 0.28)';

/** Structure metal: light grey with a lit left side and a darker right side. */
export const METAL_TOP = '#e6e0d4';
export const METAL_LEFT = '#cbc3b4';
export const METAL_RIGHT = '#aca393';
export const METAL_DARK = '#6c665d';
export const GLASS = '#8fc6e8';
export const GLOW = '#ff9a3c';
export const SOLAR = '#2e5ea8';

/** Player colors, picked in the lobby (Stage 6). Red is kept for the interface. */
export const PLAYER_COLORS = [
  { name: 'Blue', main: '#2f6fd6', dark: '#1f4f9e' },
  { name: 'Orange', main: '#ef8a1f', dark: '#b8650f' },
  { name: 'Green', main: '#2f9e5a', dark: '#1f7040' },
  { name: 'Purple', main: '#8a4fd0', dark: '#62349b' },
];

/** Each resource's simplified real color: [main, light, dark]. */
export const RESOURCE_COLORS: Record<string, [string, string, string]> = {
  iron: ['#94493d', '#c08479', '#5f2b24'],
  copper: ['#e3893a', '#f7b46e', '#a9601f'],
  gold: ['#e2b232', '#f6d572', '#a8801c'],
  quartz: ['#f1d6e8', '#ffffff', '#c7a3bd'],
  coal: ['#38383d', '#5b5b62', '#1e1e22'],
  oil: ['#1f1d24', '#4a4658', '#0d0c10'],
  sulfur: ['#e4dc55', '#f5f08f', '#b1a92f'],
};

/** Copper ore's green flecks. */
export const COPPER_PATINA = '#2fa38c';

/** Ground under a node: bare soil. */
export const SOIL = '#8c7a5c';
export const SOIL_DARK = '#76664c';

type Rgb = [number, number, number];
const hex = (h: string): Rgb => {
  const v = parseInt(h.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};
/** A color made darker (k < 1) or lighter (k > 1). */
export function shade(h: string, k: number) {
  const [r, g, b] = hex(h);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c * k)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
