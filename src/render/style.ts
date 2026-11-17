// In-game colors. The interface keeps the Portal's cream, navy and red; things in the game
// (ground, water, units, structures, resources) use simplified real colors for readability
// (SPEC "Platform and look"), drawn flat with navy outlines like Stickman Arena's figures.
// Caleb after Stage 1: slightly darker and grittier, like StarCraft: muted, dusty tones, with
// specks, dirt and cracks on the ground and grime on structures.

export const CREAM = '#faeeda';
export const NAVY = '#002657';
export const RED = '#fc3f3f';

/** Behind the map: dark, as in StarCraft. */
export const BACKDROP = '#0b1220';
/** The map's outer edge: a slab of dark earth under its two front sides. */
export const EDGE = '#2b2620';
export const EDGE_DEPTH = 22;

// Ground: a dusty olive green, with darker and lighter patches and bare dirt.
export const GROUND = '#7c8a52';
export const GROUND_DARK = '#6d7a48';
export const GROUND_LIGHT = '#899658';
export const DIRT = '#7a6c52';
export const DIRT_DARK = '#685b45';
export const GRASS_MARK = '#55603a';
export const PEBBLE = '#958d7e';
/** Grit: tiny specks over ground and rock. */
export const GRIT_DARK = 'rgba(28, 24, 16, 0.28)';
export const GRIT_LIGHT = 'rgba(240, 232, 200, 0.12)';
export const CRACK = 'rgba(30, 26, 18, 0.35)';

export const WATER = '#386b8f';
export const WATER_DEEP = '#2c587a';
export const WATER_SHORE = '#5687a6';
export const WAVE = '#93b8cd';

export const CLIFF_TOP = '#837767';
export const CLIFF_LEFT = '#665c50';
export const CLIFF_RIGHT = '#50473e';

/** Unexplored tiles: a very dark navy, with a slight per-tile change so it is not flat. */
export const FOG = '#071a33';
export const FOG_ALT = '#06162c';
/** Explored tiles at the edge of the fog get a dark wash. */
export const FOG_EDGE = 'rgba(3, 14, 32, 0.4)';

/** Structure metal: worn grey with a lit left side and a darker right side. */
export const METAL_TOP = '#b7b2a7';
export const METAL_LEFT = '#9a948a';
export const METAL_RIGHT = '#7b766e';
export const METAL_DARK = '#4e4b46';
/** Grime toward the bottom of a structure's walls, and panel seams. */
export const GRIME = 'rgba(38, 32, 24, 0.32)';
export const SEAM = 'rgba(30, 28, 24, 0.35)';
export const GLASS = '#5f93b5';
export const GLOW = '#f08a2c';
export const SOLAR = '#1f4275';
export const SOLAR_LINE = '#4f78b0';
export const CRATE = ['#9c7a4b', '#85663c', '#6c5230'] as const;
/** Foundation slab under a structure being built. */
export const CONCRETE_TOP = '#8d8a83';
export const CONCRETE_LEFT = '#76736c';
export const CONCRETE_RIGHT = '#625f59';

/** Player colors, picked in the lobby (Stage 6). Red is kept for the interface. */
export const PLAYER_COLORS = [
  { name: 'Blue', main: '#2b63c2', dark: '#1c4688' },
  { name: 'Orange', main: '#de7c1c', dark: '#a85b10' },
  { name: 'Green', main: '#2a8a50', dark: '#1c6338' },
  { name: 'Purple', main: '#7a46bb', dark: '#57318a' },
];

/** Each resource's simplified real color: [main, light, dark]. */
export const RESOURCE_COLORS: Record<string, [string, string, string]> = {
  iron: ['#85443a', '#ab7468', '#582a23'],
  copper: ['#cc7a34', '#e5a160', '#975620'],
  gold: ['#d2a42c', '#ecc865', '#9c7718'],
  quartz: ['#e1c5d8', '#f8ecf3', '#b494aa'],
  coal: ['#2f2f34', '#4f4f56', '#1a1a1e'],
  oil: ['#19181d', '#3f3b4b', '#0b0a0d'],
  sulfur: ['#d3ca48', '#ebe384', '#a29a2a'],
};

/** Copper ore's green flecks. */
export const COPPER_PATINA = '#2b9580';

/** Ground under a node: bare soil. */
export const SOIL = '#6c5f49';
export const SOIL_DARK = '#594e3c';

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
