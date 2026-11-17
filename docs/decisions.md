# Decisions made by Claude Code

The spec leaves implementation to Claude Code (SPEC "Working agreement": framework, file structure, libraries, netcode, performance and balance numbers; SPEC "Left to Claude Code": the main menu and lobby screens, room codes, recipes following Satisfactory, exact costs, AI). Each choice is written down here so Caleb can read it, test it and change it. Anything about *what* the game does that is not here or in `SPEC.md` is asked first.

## Build stages (proposed by Claude Code; Caleb: "the plan is good")

Macro to micro, with a test checkpoint at the end of each stage. Keyboard shortcuts are added in the stage that builds what they control.

1. **Foundation and the map:** the app shell and main menu; one of the three maps (ground, water, cliffs, nodes with purity, about 6 start locations); the isometric view; the camera (WASD/arrow keys, zoom buttons); fog of war; the Hub and the 3 starting Minutemen with drag-to-select and move orders; placing structures on the grid with the fog, water and cliff rules. **(this stage)**
2. **The starting economy:** the Hub inventory and its capacity; build costs and full-refund demolition; moving items into the Hub by hand; Drill, Smelter, Constructor and Depot; Belt, Splitter and Merger; Solar Generator, power lines, grids blowing and manual restart; choosing target buildings for nodes; the starting iron and copper recipes.
3. **Units and combat:** Deployer production (one unit type at a time, pausing at the unit limit); hand-placed units from the Hub; units acting on their own or waiting for orders, and the four imperatives; the melee, ranged and air targeting rules; attacking structures; health; the Hub's pulse.
4. **Research and the full content**, in three steps:
   - 4a. The Laboratory and the semi-random tree (different per player, always completable); all materials and the remaining processors; Pump and Pipe; Coal and Fuel Generators, fueled by hand or automatically.
   - 4b. The Garage and Haulers; Rail and Rail Station; the Command Post.
   - 4c. The full unit roster, Mechanic repair, and the three defenses.
5. **The CPU and match flow:** the Easy, Normal and Hard CPU; single-player matches and pause; the other two maps; elimination and surrender; time limit, sudden death, stalemate and tiebreaker; the match summary screen.
6. **Multiplayer:** room codes for 2–4 players mixing humans and CPUs; the lobby (names, colors, alliances, map choice, CPU difficulties); map pings and shared vision between allies; a CPU takes over when a player disconnects; no pausing.
7. **Story mode:** Perceval and Palamedes (including their comments in regular matches); the 10 levels; story progress saved in the browser.
8. **Audio and finishing:** music, sound effects and audio settings; an art pass; tuning from Caleb's playtests.

## Caleb's answers

| Question | Answer |
| --- | --- |
| Workflow | The same as Caleb's other projects, except Noachis. |
| Visual reference (the spec links the old shop manual; the other apps use the newer Portal look) | The Engineering Management Portal. |
| Stage plan | Approved as proposed. |
| Mouse wheel zoom (spec: on-screen buttons) | Yes, and pinch / spread on a trackpad. |
| How far zoom goes out | Not too far (the farthest Stage 1 zoom showed the whole map). |
| Minimap | Yes (Caleb first wrote "no minimap" and "minimap will be good"; asked, he chose to add one). |
| Build time | A bit of build time, scaling with the structure. Placing is instant: no unit has to go and build it (Caleb first wrote "instant building" and "a bit of build time"; asked, he chose this). |
| What explored areas show | Everything: once explored, a place stays fully visible, enemy units included (from Stage 3). |
| Look | Slightly darker and grittier in-game colors, like StarCraft. |
| Dark mode | Not necessary. Light only. |

Nothing is waiting on Caleb.

## Builder's additions in Stage 1 (not named in the spec; easy to remove)

- **H centers the camera on your Hub.** The map is large and the camera only moves by keys.
- **A list of controls in the pause menu.**
- **"Stage N" tags** on menu entries that are not built yet (Multiplayer, Settings, Story mode, the other two maps, the CPU). They go away as the stages land.
- Until Stage 5, **Match vs CPU starts a match with only you on the map**, so the map, camera, fog, units and placement can be tried.

## Platform

| Item | Choice | Why |
| --- | --- | --- |
| Stack | React, TypeScript, Vite, Tailwind CSS, vite-plugin-pwa, react-router, at the same versions as Society Sandbox. | Same family as Caleb's other apps. React draws the menus and the panels over the map; the map itself is drawn on a canvas by plain TypeScript. |
| Hosting | GitHub Pages, published by `.github/workflows/deploy.yml` on every push to `main`. One-time setup: repository Settings > Pages > Source: GitHub Actions. | Spec (free plans). |
| Drawing | The browser's 2D canvas, no game engine or WebGL library. | Measured fast enough (see Performance) and keeps the build small: the Stage 1 site is about 0.84 MB, 0.36 MB of it the app's code. |
| Installable | PWA, landscape, works offline once opened (single-player). | Spec. |
| Multiplayer plan (Stage 6) | Lockstep: every computer runs the same simulation and only player commands are sent, through the free PeerJS signaling server and direct WebRTC connections (as in Stickman Arena). The host relays for 3–4 players. | An RTS with hundreds of units cannot send the whole state many times a second on free services; commands are tiny. This only works if the simulation is exactly the same everywhere, so Stage 1 already follows the rules below. |

## Simulation (Stage 1)

| Item | Choice |
| --- | --- |
| Rate | 20 ticks a second, fixed. Drawing runs at the screen's rate and moves units smoothly between ticks. |
| Numbers | Whole numbers only. A position is in 1/1024 of a tile. No floating-point functions whose last digits can differ between browsers (sine, cosine, powers, Math.random). Maps are laid out with written-out sine and cosine values for multiples of 15 degrees. |
| Changes | Only `step()` changes the match. Every player action is a command (move, build, demolish so far), applied at the start of the next tick and checked there. |
| Random numbers | One seeded generator in the match state. The seed picks start locations; in multiplayer the host will choose it. |
| Fingerprint | `stateHash()` sums up the match each tick; multiplayer will compare it between computers to catch a mismatch early. |
| Check | `npm run check:sim` builds every map and checks that every start reaches every other start and every node on foot, runs the same 4-player match twice and compares fingerprints every tick, and runs the load test below. |

## Map (Stage 1)

| Item | Choice |
| --- | --- |
| Size | 192 × 192 tiles. "StarCraft-sized" checked against listed map sizes: StarCraft II 4-player ladder maps on Liquipedia such as [Zerus Prime](https://liquipedia.net/starcraft2/Zerus_Prime) (172×156), [Star Station](https://liquipedia.net/starcraft2/Star_Station) (180×152) and [Invader](https://liquipedia.net/starcraft2/Invader_LE) (200×164); Brood War's most common sizes in the [Battle.net map archive](https://classic.battle.net/scc/maps.shtml) are 192×192 and 128×128. These figures come from web search results (November 2026); liquipedia.net and classic.battle.net are not reachable from the build environment, so the pages themselves were not opened. One tile is one grid square, the width of a belt (Stage 2). |
| Tiles | Ground, water and cliffs. Water and cliffs block placement and all ground units (air units arrive in Stage 4c). Cliffs are raised rock ridges; there is no high ground (not in the spec). |
| Map 1: Basin | An island around a central lake. Six start locations sit on a ring 70 tiles from the center, 60 degrees apart. A cliff ridge runs out between each pair of neighbors, from 30 to 55 tiles from the center, so ground routes go around the inner ring or the outer ring. Each sector has a pond and a rock outcrop. |
| Nodes on Basin (60) | Near each start: Normal Iron and Copper about 9 tiles away, Impure Iron and Copper about 10 tiles away, Impure Coal about 14 tiles toward the lake. In each sector's middle: Normal Coal, Quartz and Sulfur. Shared between neighbors: Pure Iron or Pure Copper on the lake shore (alternating), Normal Oil or Gold on the outer ring (alternating). Each start's nodes are placed with a fixed offset of up to one tile, so starts are balanced with a little variance (SPEC). |
| Purity | Shown by how many ore rocks sit on the node (2 Impure, 3 Normal, 4 Pure; oil pools grow instead) and named when the node is selected. What purity changes (gathering rate) comes in Stage 2. |
| Maps 2 and 3 | Stage 5. |

## Structures (Stage 1)

| Item | Choice |
| --- | --- |
| Build menu | The structures the spec lists as available at the start that are built yet: Drill, Smelter, Constructor, Deployer, Solar Generator, Depot, Laboratory. Belts and power lines come in Stage 2; the rest unlock through research in Stage 4. In Stage 1 placing is free and the structures do nothing yet. |
| Footprints (tiles) | Hub 5×5. Drill and Pump 2×2 (a node is 2×2). Smelter 2×2, Constructor 2×3, Foundry and Assembler 3×3, Refinery 3×4, Manufacturer 4×4. Deployer 3×3, Garage and Landing Pad 4×4. Command Post 2×2. Solar Generator 2×2, Coal and Fuel Generators 3×3. Depot 2×2. Laboratory 3×3. Gun Turret, Arc Pile and Mortar 2×2. Tunable. |
| Placement | Every tile of the footprint must be explored ground with nothing built on it. Nodes are kept for Drills and Pumps: a Drill must line up exactly with a solid node (it snaps to the node under the cursor), a Pump with an oil node, and nothing else may cover a node. Your own units standing on the spot step aside; another player's units block it. |
| Placing | Pick from the build menu (or 1–7), then click. The preview stays after placing, so several can be placed in a row, as in factory games; right click or Esc stops. R turns the structure a quarter turn (non-square footprints now, input and output sides from Stage 2). |
| Build time (after Stage 1) | Placing is instant; the structure then takes a few seconds to finish and does nothing until it is finished (it matters from Stage 2). It blocks its tiles from the moment it is placed. While building it grows up out of a concrete foundation inside scaffolding, with a progress bar above it; its panel shows the percent and seconds left. Seconds: Solar Generator and Depot 3; Drill and Pump 4; Smelter, Constructor and Gun Turret 5; Command Post, Coal Generator, Arc Pile and Mortar 6; Foundry, Assembler and Fuel Generator 7; Deployer and Laboratory 8; Refinery 9; Garage and Landing Pad 10; Manufacturer 12. Tunable. Health is full from the start; whether it should grow with building is a question for Stage 3 (damage). |
| Demolish | Your own structures except the Hub, with the panel's button or Delete, also while still being built. The full refund (SPEC) comes with costs in Stage 2. |
| Health | Every structure has health, shown in its panel. Damage comes in Stage 3. |

## Units (Stage 1)

| Item | Choice |
| --- | --- |
| Start | 3 Minutemen on the open tiles in front of the Hub. |
| Minuteman | 3 tiles a second, sees 8 tiles, 60 health. The Hub sees 13 tiles at the start. Other units' numbers are placeholders until they are built. |
| Paths | A* over the tile grid in 8 directions, never cutting a blocked corner, then shortened to the turning points. If the target cannot be reached, units go to the reachable tile nearest it. If a structure is built across a path, the unit finds a new one. |
| Group orders | Units spread over the open tiles nearest the clicked point, one unit per tile, each taking the nearest free spot. |
| Crowding | Units walk through each other on the way; they only spread out where they stop. To be revisited with combat in Stage 3. |

## View and controls (Stage 1)

| Item | Choice |
| --- | --- |
| View | Isometric: a tile is a diamond 64 × 32 pixels at 100%. 100% at the start, centered on your Hub. |
| Zoom (after Stage 1) | Smooth, from 40% to 200%. The mouse wheel and a trackpad pinch zoom toward the pointer; the on-screen buttons and the + and - keys step by 25% about the screen's center. 40% shows roughly a third of the map's width on a 1440-pixel-wide screen; the minimap shows the rest. A two-finger swipe on a trackpad also zooms, because the browser reports it the same way as a mouse wheel. |
| Minimap (after Stage 1) | Bottom left, in the same isometric orientation as the main view, so up on the minimap is up on screen. It shows explored ground, water, cliffs and nodes (unexplored is dark), structures and units in their owner's color, and a white box for what the main view shows. Click or drag on it to move the camera there. |
| Mouse | Left click selects a unit, structure or node; left drag selects your units in a box; Shift adds to the selection. Right click sends the selected units there (StarCraft's buttons). While building: left click places, right click stops. |
| Keys | W A S D or the arrow keys move the camera; + and - zoom (so do the mouse wheel and a trackpad pinch); H centers on your Hub; 1–7 pick a structure; R rotates it; Delete demolishes the selected structure; Esc stops building, then clears the selection, then opens the menu. |
| Menu | Esc or the Menu button. Single-player pauses while it is open (SPEC). Resume, Quit match, and the controls list. |
| Fog | Unexplored tiles are drawn in a very dark navy. Explored tiles at the edge of the fog get a dark wash. Units reveal fog within their sight as they move; fog never comes back, and explored places show everything (Caleb). |

## Look

- The Portal's style for every screen: cream, navy and red; Norwester headings; Archivo body text; staggered stripes; flat cards. Light mode only.
- Logo: the full Croswell Industries logo on Home; the C mark in the gap left of the bottom stripes on the other screens, and in the slim stripe under a match.
- App icon: a cream gear with a red chevron pointing up, on navy.
- In-game colors (Caleb after Stage 1: slightly darker and grittier, like StarCraft): simplified real colors, muted and dusty, flat with navy outlines. Dusty olive ground with darker and lighter patches, bare dirt in places, tiny specks of grit, pebbles, grass tufts and small cracks; blue-grey water with paler shallows at the shore; dark grey-brown rock cliffs with grit and cracks; very dark navy fog; a dark backdrop around the map. Ores: iron rust red, copper orange with green flecks, gold yellow with a glint, quartz pale pink crystals, coal near-black, sulfur pale yellow, oil a black pool.
- Structures are worn grey metal machines with grime toward the bottom of their walls, panel seams, and a band of the owner's color: the Hub's transmitter tower with a blinking light and rings going out (the spec says directives are sent from the Hub), a lattice-tower Drill, a glowing Smelter with a chimney, a Constructor with a moving arm, a Deployer with a hangar door, a wooden-crate Depot, a tilted Solar panel on legs, a domed Laboratory. The structures from later stages are plain boxes until they are built.
- Minutemen are stick figures in the owner's color with a helmet, as in Stickman Arena, with a walking stride.
- Player colors: Blue, Orange, Green and Purple, slightly deepened to sit with the darker colors (chosen in the lobby in Stage 6). Red is kept for the interface: selections, warnings, move markers. Single-player is Blue.

## Performance (Stage 1, measured again after Caleb's Stage 1 changes)

Measured in headless Chromium on this build machine, 1440 × 860 screen, at normal (1×) and high (2×, as on most laptops) pixel density. It draws in software with no graphics card, so a real Chrome should do at least as well.

| Case | Result |
| --- | --- |
| Building Basin | About 18 ms. |
| Simulation, 4 players × 200 units (the unit limit) walking | 0.10 ms a tick on average (worst about 1 ms) of the 50 ms a tick has. |
| All 800 units ordered across the map in the same tick | 90–140 ms for that one tick (varies between runs), so the game stutters once. One player ordering 200 units is about a quarter of that. If it shows in play, group orders will share one path search instead of one per unit. |
| 200 units walking into fog at 100% | 1×: 60 frames a second (56 in the 2.5 s measured). 2×: about 43 (here the ground is drawn tile by tile each frame). |
| 200% | 60 frames a second at 1× and 2×. |
| 40% with the whole map explored, once the zoom has settled | 60 frames a second at 1× and 2×. |
| Zooming nonstop between 40% and 100% | 1×: about 38 frames a second; 2×: about 22, while the zoom keeps changing. |

How drawing keeps up:

- Units are stamped from cached pictures instead of stroking every figure (20 frames a second before, 60 after, with 200 on screen).
- Far out, the ground is drawn in cached 16 × 16 tile chunks, each with a ring of its neighbors' tiles so chunks meet without seams. While the zoom is changing, pictures from a few fixed scales are stretched; 0.2 s after it stops, the chunks and unit pictures in view are remade at the exact zoom, a few per frame. A stretched picture was 3 to 4 times slower to draw in this software-only browser (at 2×: 60 frames a second at an exact scale, 15–20 stretched).
- Making and remaking chunks (zooming, fog lifting) is limited to about 6 ms a frame.
