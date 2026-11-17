# Scaling Factor

An RTS where the goal is building an automated war machine rather than having the best APM. Gather resources, process them into materials, and set up structures that turn materials into units on their own.

It is an installable web app (PWA) for computers, hosted on GitHub Pages.

The game is built in stages, each tried before the next starts. What the game does is in [`SPEC.md`](SPEC.md) (Caleb's spec); the stage plan and every choice left to the builder are in [`docs/decisions.md`](docs/decisions.md).

## What is in it so far (Stages 1 to 3)

| Area | What it does |
| --- | --- |
| Home | Single-player, plus Multiplayer and Settings marked for later stages. |
| Single-player | Pick a map and start a match. Until the CPU arrives (Stage 5), an idle CPU stands at another start: its Hub and 3 Minutemen only defend themselves. |
| The map | Basin: an island around a lake, 192 × 192 tiles, with water, cliff ridges, 60 resource nodes (seven resources, three purities) and six start locations. Isometric view, with a minimap. |
| Fog of war | Everything starts fogged except around your Hub. Units lift the fog for good as they explore. |
| Units | Click or drag to select; right-click the ground to move or an enemy to attack. Deployers make Minutemen from parts, acting on their own (Aggressive, Hold Point, Patrol, Explore) or waiting for orders at a rally point. Place units by hand from the Hub: made there, they walk to the spot and hold it. Unit limit 200. |
| Combat | Melee and ranged rules from the spec, health, attacking structures, the Hub's pulse. A player whose Hub is destroyed is out, with everything they had. |
| The Hub | Your inventory (2,000 items). Structures are paid from it and refunded into it. Move items into it by hand from any structure's panel. |
| Production | Drills gather ore; Smelters and Constructors run the starting iron and copper recipes (Satisfactory's); Depots store anything. Ports that touch connect directly. |
| Transport | Belts (drag to lay a line), Splitters and Mergers. Belts block ground units and can cross water. |
| Power | Solar Generators, Power Poles and Power Lines. A grid blows when demand goes over supply and must be restarted by hand. |
| Building | Pick from the build menu and place on the grid: never in fog, on water or on cliffs; a Drill goes on a node. Each structure takes a few seconds to build. Demolishing refunds the full cost. |
| Camera | W A S D or the arrow keys; zoom with the mouse wheel, a trackpad pinch, the on-screen buttons or + and -. |
| Minimap | The whole map in the corner, with your units, structures and belts and what the main view shows. Click it to move the camera. |

The full list of controls is in the match menu (Esc).

## Run it on your computer

Needs Node.js 20.19 or newer.

```bash
npm install
```

```bash
npm run dev
```

Open the address it prints (usually http://localhost:5173).

To check the simulation (maps are connected, matches are deterministic, the economy works from the starting inventory, and how fast it is with 800 units and thousands of belt tiles):

```bash
npm run check:sim
```

## Put it online (GitHub Pages)

1. The repository must be **public** (Pages is free for public repositories).
2. **Settings > Pages > Build and deployment > Source**: choose **GitHub Actions**.
3. Push to `main`. [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds and publishes the app to `https://<your-username>.github.io/<repo-name>/`.

To install it, open the site in Chrome or Edge on a computer and use the browser's Install button.

## Project layout

```
src/
  sim/           the simulation: deterministic, whole numbers only, changed only by commands
  sim/content/   resources, items, recipes, structures, transport and units from the spec
  sim/map/       map building and the fixed maps
  sim/economy.ts, belts.ts, power.ts, flow.ts   structures at work, belts, power grids, items passing between them
  render/        drawing: isometric math, terrain chunks, structures, units, belts, power lines, minimap, colors
  game/          running a match: the loop, camera, mouse and keyboard, the match HUD
  pages/         Home, Single-player, the match screen
  components/    page frame, buttons, cards
  graphics/      app icon, Croswell Industries logo
scripts/         check-sim (map, determinism and speed checks)
docs/            the builder's decisions
```

Built with React, TypeScript, Vite, Tailwind CSS and vite-plugin-pwa. Headings use Norwester by Jamie Wilson (SIL Open Font License, `src/assets/fonts/`).
