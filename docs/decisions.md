# Decisions made by Claude Code

The spec leaves implementation to Claude Code (SPEC "Working agreement": framework, file structure, libraries, netcode, performance and balance numbers; SPEC "Left to Claude Code": the main menu and lobby screens, room codes, recipes following Satisfactory, exact costs, AI). Each choice is written down here so Caleb can read it, test it and change it. Anything about *what* the game does that is not here or in `SPEC.md` is asked first.

## Build stages (proposed by Claude Code; Caleb: "the plan is good")

Macro to micro, with a test checkpoint at the end of each stage. Keyboard shortcuts are added in the stage that builds what they control.

1. **Foundation and the map:** the app shell and main menu; one of the three maps (ground, water, cliffs, nodes with purity, about 6 start locations); the isometric view; the camera (WASD/arrow keys, zoom buttons); fog of war; the Hub and the 3 starting Minutemen with drag-to-select and move orders; placing structures on the grid with the fog, water and cliff rules. **(done; Caleb's checkpoint changes done)**
2. **The starting economy:** the Hub inventory and its capacity; build costs and full-refund demolition; moving items into the Hub by hand; Drill, Smelter, Constructor and Depot; Belt, Splitter and Merger; Solar Generator, power poles and lines, grids blowing and manual restart; the starting iron and copper recipes. (A Drill's target building is wherever its belts lead, Caleb.) **(done)**
3. **Units and combat:** Deployer production (one unit type at a time, pausing at the unit limit); hand-placed units from the Hub; units acting on their own or waiting for orders, and the four imperatives; the melee, ranged and air targeting rules; attacking structures; health; the Hub's pulse. **(done)**
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
| Merging (after Stage 1) | "Let's get as much done as we can before merging": stages carry on, each on its own branch on top of the last, and are merged to `main` together later. |
| How a Drill's resources reach its target building (Stage 2) | By belt. Structures whose ports touch and face each other connect with no belt, as in Satisfactory. |
| Moving items by hand between the Hub and a structure (Stage 2) | Instant, at any distance. |
| Power lines (Stage 2; the spec has no poles) | Power poles, with lines that connect poles and structures. |
| Belts and ground units (Stage 2) | Belts block ground units. |
| Aggressive units with no enemy in sight (Stage 3) | Wait at their structure's rally point. |
| Hand-placed units once they arrive (Stage 3) | Hold the point (the Hold Point imperative there). |
| Something to fight before the CPU (Stage 3) | An idle CPU: its Hub and 3 Minutemen at another start location, which only defend themselves, until Stage 5. |
| Health of a structure being built (Stage 3) | Starts at a tenth and grows as it is built, like StarCraft. |

Nothing is waiting on Caleb. Points for Caleb to look at when he tries Stage 2 are under "Stage 2: for Caleb to check".

## Builder's additions in Stage 1 (not named in the spec; easy to remove)

- **H centers the camera on your Hub.** The map is large and the camera only moves by keys.
- **A list of controls in the pause menu.**
- **"Stage N" tags** on menu entries that are not built yet (Multiplayer, Settings, Story mode, the other two maps, the CPU). They go away as the stages land.
- Until Stage 5, **Match vs CPU starts a match with only you on the map**, so the map, camera, fog, units and placement can be tried.

## Builder's additions in Stage 2 (not named in the spec; easy to remove)

- **The Hub's inventory across the top of the screen**, with its count and capacity.
- **Adding a Smelter's or Constructor's ingredients by hand from the Hub.** The spec names by-hand delivery for unit parts and fuel; the same button is given to machines, which helps at the very start.
- **Arrows on item ports** while building (cream into a structure, red out of it), and **badges** over structures with no power, a blown grid or no recipe.
- **Laying a belt over your own belt turns it** to the new direction, free.
- **Power lines carry on from the last structure connected**, so a row of poles is a click each.
- **Demolishing also returns what a structure holds** to the Hub, and **changing a recipe** returns its ingredients and products.

## Stage 2: for Caleb to check

- **Starting out.** The spec starts every player with enough for a Drill and some Solar Generators. Satisfactory's Smelter and Constructor cost parts that need a Smelter and a Constructor to make, so here the Smelter costs 40 Iron Ore and the Constructor 30 Iron Ingots. The opening goes: Drill and Solar Generators, take the Drill's ore to the Hub by hand, build a Smelter, take its ingots to the Hub, build a Constructor.
- **Grids blow easily at the start.** A Drill (5 MW) joined to a single Solar Generator (4 MW) blows that grid at once, and it stays blown until restarted from any structure on it, even after more Solar Generators are joined. That is the spec's rule (current demand over supply); stringing the Solar Generators together before the Drill avoids it.
- **A structure with no power does nothing**, including a Depot: it neither takes items from belts nor puts them out (SPEC: all structures need power to run). By-hand moves still work.

## Builder's additions in Stage 3 (not named in the spec; easy to remove)

- **Rally points**: right-click the map with a Deployer selected; its units gather there (Caleb's answer names the rally point). Shown as a red flag with a dashed line while it is selected.
- **Attack orders**: with units selected, right-click an enemy unit, structure or belt. A red ring marks the target.
- **A unit the player orders waits for the player's orders from then on**, even if it was acting on its own.
- **Belt tiles can be destroyed** (100 health) by ordering units to attack them, since belts block units; units never pick belts as targets on their own.
- **Units push apart** when they stand too close, so crowds spread out instead of piling up.
- **The unit count** next to the Hub's inventory, a notice when a player is out of the match, and dust, debris and a ring for deaths, destroyed structures and the Hub's pulse.

## Stage 3: for Caleb to check

- **Hold Point with melee units.** The spec says Hold Point attacks what is "in range". A Minuteman's range is a strike's reach, so a Minuteman on Hold Point only hits what comes right up to it.
- **The Hub is hard to take with Minutemen.** 9 Minutemen hitting a Hub took about a third of its health in a minute while its pulse killed 4 of them (SPEC: the Hub is quite resilient).
- **Changing a Deployer's settings changes its units too**: new mode, imperative, rally point or patrol points apply to the units it already made, except those the player has given orders.

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
| Changes | Only `step()` changes the match. Every player action is a command (move, attack, build, demolish, belts, power lines, by-hand moves, recipes, grid restart, production, unit mode, rally and patrol points, placing units), applied at the start of the next tick and checked there. |
| Order in a tick | Commands, building progress, structures (power, then work and production, then products out of output ports), the Hubs' hand-placed units, belts, units thinking and hitting, the Hubs' pulses, units moving, units pushing apart, removing what was destroyed (and players whose Hub fell), fog. |
| Random numbers | One seeded generator in the match state. The seed picks start locations; in multiplayer the host will choose it. |
| Fingerprint | `stateHash()` sums up the match each tick; multiplayer will compare it between computers to catch a mismatch early. |
| Check | `npm run check:sim` builds every map and checks that every start reaches every other start and every node on foot; runs the same 4-player match twice and compares fingerprints every tick; plays the opening from the starting inventory to Iron Plates twice and compares; checks belts, a splitter, a merger taking turns, a grid blowing and restarting, refunds and recipe changes; and runs the load tests below. |

## Map (Stage 1)

| Item | Choice |
| --- | --- |
| Size | 192 × 192 tiles. "StarCraft-sized" checked against listed map sizes: StarCraft II 4-player ladder maps on Liquipedia such as [Zerus Prime](https://liquipedia.net/starcraft2/Zerus_Prime) (172×156), [Star Station](https://liquipedia.net/starcraft2/Star_Station) (180×152) and [Invader](https://liquipedia.net/starcraft2/Invader_LE) (200×164); Brood War's most common sizes in the [Battle.net map archive](https://classic.battle.net/scc/maps.shtml) are 192×192 and 128×128. These figures come from web search results (November 2026); liquipedia.net and classic.battle.net are not reachable from the build environment, so the pages themselves were not opened. One tile is one grid square, the width of a belt (Stage 2). |
| Tiles | Ground, water and cliffs. Water and cliffs block placement and all ground units (air units arrive in Stage 4c). Cliffs are raised rock ridges; there is no high ground (not in the spec). |
| Map 1: Basin | An island around a central lake. Six start locations sit on a ring 70 tiles from the center, 60 degrees apart. A cliff ridge runs out between each pair of neighbors, from 30 to 55 tiles from the center, so ground routes go around the inner ring or the outer ring. Each sector has a pond and a rock outcrop. |
| Nodes on Basin (60) | Near each start: Normal Iron and Copper about 9 tiles away, Impure Iron and Copper about 10 tiles away, Impure Coal about 14 tiles toward the lake. In each sector's middle: Normal Coal, Quartz and Sulfur. Shared between neighbors: Pure Iron or Pure Copper on the lake shore (alternating), Normal Oil or Gold on the outer ring (alternating). Each start's nodes are placed with a fixed offset of up to one tile, so starts are balanced with a little variance (SPEC). |
| Purity | Shown by how many ore rocks sit on the node (2 Impure, 3 Normal, 4 Pure; oil pools grow instead) and named when the node is selected. A Drill gathers 30, 60 or 120 a minute (Satisfactory's Miner Mk.1). |
| Maps 2 and 3 | Stage 5. |

## Structures (Stage 1)

| Item | Choice |
| --- | --- |
| Build menu (Stage 2) | Three tabs. Production: Drill 1, Smelter 2, Constructor 3, Deployer 4, Depot 5, Laboratory 6. Power: Solar Generator 7, Power Pole P, Power Line L. Transport: Belt B, Splitter T, Merger M. Hovering shows the cost and what it does; entries the Hub cannot pay for are dimmed. The rest unlock through research in Stage 4. |
| Footprints (tiles) | Hub 5×5. Power Pole 1×1. Drill and Pump 2×2 (a node is 2×2). Smelter 2×2, Constructor 2×3, Foundry and Assembler 3×3, Refinery 3×4, Manufacturer 4×4. Deployer 3×3, Garage and Landing Pad 4×4. Command Post 2×2. Solar Generator 2×2, Coal and Fuel Generators 3×3. Depot 2×2. Laboratory 3×3. Gun Turret, Arc Pile and Mortar 2×2. Tunable. |
| Placement | Every tile of the footprint must be explored ground with nothing built on it. Nodes are kept for Drills and Pumps: a Drill must line up exactly with a solid node (it snaps to the node under the cursor), a Pump with an oil node, and nothing else may cover a node. Your own units standing on the spot step aside; another player's units block it. |
| Placing | Pick from the build menu (or its key), then click. The preview stays after placing, so several can be placed in a row, as in factory games; right click or Esc stops. R turns the structure a quarter turn (four ways), which moves its ports. |
| Build time (after Stage 1) | Placing is instant; the structure then takes a few seconds to finish and does nothing until it is finished (it matters from Stage 2). It blocks its tiles from the moment it is placed. While building it grows up out of a concrete foundation inside scaffolding, with a progress bar above it; its panel shows the percent and seconds left. Seconds: Power Pole 1; Solar Generator and Depot 3; Drill and Pump 4; Smelter, Constructor and Gun Turret 5; Command Post, Coal Generator, Arc Pile and Mortar 6; Foundry, Assembler and Fuel Generator 7; Deployer and Laboratory 8; Refinery 9; Garage and Landing Pad 10; Manufacturer 12. Tunable. Health is full from the start; whether it should grow with building is a question for Stage 3 (damage). |
| Demolish | Your own structures except the Hub, with the panel's button or Delete, also while still being built. The full cost comes back to the Hub (SPEC), with whatever the structure held and its power lines' cost. Refunds always fit: the Hub may go past its capacity, and nothing more can be moved in until it is back under. |
| Health | Every structure has health, shown in its panel. Damage comes in Stage 3. |

## Units (Stage 1)

| Item | Choice |
| --- | --- |
| Start | 3 Minutemen on the open tiles in front of the Hub. |
| Minuteman | 3 tiles a second, sees 8 tiles, 60 health. The Hub sees 13 tiles at the start. Other units' numbers are placeholders until they are built. |
| Paths | A* over the tile grid in 8 directions, never cutting a blocked corner, then shortened to the turning points. If the target cannot be reached, units go to the reachable tile nearest it. If a structure is built across a path, the unit finds a new one. |
| Group orders | Units spread over the open tiles nearest the clicked point, one unit per tile, each taking the nearest free spot. |
| Crowding (Stage 3) | Ground units closer than about half a tile push each other apart a little each tick, never onto blocked ground. Group orders still send each unit to its own tile. |

## View and controls (Stage 1)

| Item | Choice |
| --- | --- |
| View | Isometric: a tile is a diamond 64 × 32 pixels at 100%. 100% at the start, centered on your Hub. |
| Zoom (after Stage 1) | Smooth, from 40% to 200%. The mouse wheel and a trackpad pinch zoom toward the pointer; the on-screen buttons and the + and - keys step by 25% about the screen's center. 40% shows roughly a third of the map's width on a 1440-pixel-wide screen; the minimap shows the rest. A two-finger swipe on a trackpad also zooms, because the browser reports it the same way as a mouse wheel. |
| Minimap (after Stage 1) | Bottom left, in the same isometric orientation as the main view, so up on the minimap is up on screen. It shows explored ground, water, cliffs and nodes (unexplored is dark), structures and units in their owner's color, and a white box for what the main view shows. Click or drag on it to move the camera there. |
| Mouse | Left click selects a unit, structure, belt or node (other players' too, to look at); left drag selects your units in a box; Shift adds to the selection. Right click: with units selected, attack the enemy under the pointer or move there (StarCraft's buttons); with a Deployer selected, set its rally point. While building or placing units: left click places, right click stops. |
| Keys | W A S D or the arrow keys move the camera; + and - zoom (so do the mouse wheel and a trackpad pinch); H centers on your Hub; 1–7, P, L, B, T and M pick from the build menu; R rotates what is being placed (and, while dragging a belt, which way it bends); Delete demolishes the selected structure or belt; Enter finishes patrol points; Esc stops building, then clears the selection, then opens the menu. |
| Menu | Esc or the Menu button. Single-player pauses while it is open (SPEC). Resume, Quit match, and the controls list. |
| Fog | Unexplored tiles are drawn in a very dark navy. Explored tiles at the edge of the fog get a dark wash. Units reveal fog within their sight as they move; fog never comes back, and explored places show everything (Caleb). |

## Units and combat (Stage 3)

| Item | Choice |
| --- | --- |
| Minuteman | 3 Iron Plate + 6 Screws (SPEC: Iron Plate and Screws). 6 s at a Deployer, 3 s at the Hub. 60 health; hits for 6 every second at a strike's reach (melee, SPEC). Other units' numbers are placeholders until research (Stage 4). |
| Deployer | Choose the unit in its panel (one type at a time, SPEC); it makes them while it has parts and power (10 MW while making). Parts come by belt into its three input ports, or by hand with Add. Changing the unit returns its parts to the Hub. New units appear at its front and go to the rally point (default: just outside its front), spreading over the tiles around it. |
| Unit limit | 200 units a player (SPEC: about 200). At the limit a Deployer pauses, even part way through a unit, and the Hub stops making placed units; both carry on when the count drops (SPEC). |
| Placing units by hand | Select the Hub, pick a unit, then click the map; each click places one, paid from the Hub at once (SPEC: they cost something). The Hub makes them one at a time (up to 20 waiting); each walks to its spot and holds it (Caleb). Dashed rings mark where they are headed. |
| Acting on their own or directed | Set per Deployer (SPEC). Directed units wait at the rally point for orders and hit enemies that come within reach. Units acting on their own follow the Deployer's imperative. |
| Imperatives | Aggressive: chase and attack anything seen; with nothing in sight, wait at the rally point (Caleb). Hold Point: stay at the rally point and hit what comes in reach. Patrol: loop from the rally point through up to 8 patrol points set from the panel, chasing what they see and going back to the route. Explore: head for the nearest unexplored ground; never fight, and head back home while an armed enemy is in sight. |
| Targets | The nearest enemy unit the unit can hit, else the nearest enemy structure (SPEC: units attack structures directly), ties to the lower id. Melee units cannot hit air; ranged, both and air units can hit anything (SPEC). Chasers give up 4 tiles past their sight. |
| Damage | Just damage (SPEC). A unit hit flashes pale; a structure flashes in its band. Health bars show on anything damaged or selected. Destroyed structures leave nothing and give no refund; what they held is lost. |
| The Hub's pulse | Every 3 s, when an enemy unit is within 4 tiles of the Hub's edge, it hits every enemy unit there for 5 (SPEC: a low-damage pulse). It works without power. |
| Elimination | When a Hub is destroyed, its player is out and all their units, structures, belts and lines are destroyed (SPEC). The match's end, winner and summary come in Stage 5. |
| The idle CPU | "CPU (idle)", in orange, at another random start, with the starting Hub and 3 Minutemen on Hold Point. It builds and attacks nothing (Caleb, until Stage 5). |

## Economy (Stage 2)

Recipes, extraction rates and power use follow Satisfactory, checked against the game's data (the SatisfactoryTools data file on GitHub, November 2026; satisfactory.wiki.gg is not reachable from the build environment).

| Item | Choice |
| --- | --- |
| Items so far | Raw: Iron Ore, Copper Ore, Gold Ore, Raw Quartz, Coal, Crude Oil, Sulfur (Satisfactory's names, Gold Ore for Caterium Ore). Made: Iron Ingot, Copper Ingot, Iron Plate, Iron Rod, Screws, Wire, Cable. |
| Recipes | Smelter: 1 Iron Ore → 1 Iron Ingot, 1 Copper Ore → 1 Copper Ingot, 2 s each. Constructor: 3 Iron Ingot → 2 Iron Plate in 6 s; 1 Iron Ingot → 1 Iron Rod in 4 s; 1 Iron Rod → 4 Screws in 6 s; 1 Copper Ingot → 2 Wire in 4 s; 2 Wire → 1 Cable in 2 s. A Smelter or Constructor makes nothing until a recipe is chosen in its panel; changing it returns what it held to the Hub. |
| Machines | A machine takes up to 10 cycles' worth of each ingredient and holds up to 100 products; a Drill holds up to 100 ore. A full output stops it. Power: Drill 5 MW, Smelter 4 MW, Constructor 4 MW, Depot 1 MW, drawn only while working (a Depot always). |
| Hub | Holds 2,000 items in all (SPEC: the Hub has a capacity). Belts never deliver to it (SPEC). A Depot holds 1,000. |
| By hand | Select a structure: **To Hub** moves as many of an item as fit into the Hub, instantly, at any distance (Caleb). **Add** moves a machine's ingredient from the Hub into it. |
| Starting inventory | 30 Iron Plate, 12 Iron Rod, 38 Wire, 6 Cable: a Drill, 4 Solar Generators, 2 Power Poles and 6 Power Lines (SPEC: enough for a Drill and some Solar Generators). |
| Costs | Drill 10 Iron Plate + 10 Iron Rod. Smelter 40 Iron Ore. Constructor 30 Iron Ingot. Depot 10 Iron Plate + 10 Iron Rod (Satisfactory's Storage Container). Solar Generator 5 Iron Plate + 8 Wire. Power Pole 1 Iron Rod + 3 Wire (Satisfactory's, without its Concrete). Power Line 1 Cable (Satisfactory's). Belt 1 Iron Plate a tile. Splitter 2 Iron Plate + 2 Cable; Merger 2 Iron Plate + 2 Iron Rod (Satisfactory's). Deployer 20 Iron Plate + 20 Iron Rod + 40 Screws. Laboratory 40 Iron Plate + 20 Cable + 100 Screws (too much for the start, SPEC). Structures that come later have placeholder costs until their stage. |

## Belts and ports (Stage 2)

| Item | Choice |
| --- | --- |
| Ports | Each structure has input and output ports on the edge of its footprint, which turn with it. Drill: one output. Smelter, Constructor, Depot: an input on one side and an output on the opposite side. Deployer: three inputs (for unit parts, Stage 3). Ports show as arrows while building. |
| Direct links | Two structures whose output and input ports touch and face each other pass items with no belt (Caleb, as in Satisfactory), at a belt's rate. |
| Belts | One tile each, pointing the way items go. Drag to lay a line; it runs along one axis, then the other (R changes which first). Items move 1 tile a second, at least half a tile apart: 2 items a second, 120 a minute (Satisfactory's Mk.1 belt carries 60 a minute, but a Pure node gives 120). A belt passes items to the next belt, splitter or merger, or into an input port it points at. Belts cannot go on cliffs, nodes or structures; they can cross water (SPEC). They block ground units (Caleb). |
| Splitter, Merger | One tile each. A splitter takes items from behind and sends them out of its front, right and left in turn, skipping a side that cannot take one. A merger takes items from behind, left and right in turn and sends them out of its front. |
| Owners | Items only pass between things of the same owner. |

## Power (Stage 2)

| Item | Choice |
| --- | --- |
| Lines | Power Line tool (L), or Connect in a structure's panel: click a pole or structure, then another. Up to 14 tiles, center to center; not across cliffs (water is fine). A pole takes 4 lines, other structures 2. Each line costs 1 Cable, refunded when it goes. Structures and poles joined by lines form a grid. |
| Supply | Solar Generator 4 MW, always (SPEC: no fuel, weak for its space; Satisfactory's Coal Generator makes 75 MW). Coal and Fuel Generators come in Stage 4a. |
| Blowing | Each tick, a grid's demand is what its working structures draw. If it goes over the grid's supply, the grid blows: everything on it stops until the player restarts it with **Restart grid** in any of its structures' panels (SPEC). A grid with no generator has no power but does not blow. Joining a blown grid to a working one gives one blown grid. |
| The Hub | Works without power. |

## Look

- The Portal's style for every screen: cream, navy and red; Norwester headings; Archivo body text; staggered stripes; flat cards. Light mode only.
- Logo: the full Croswell Industries logo on Home; the C mark in the gap left of the bottom stripes on the other screens, and in the slim stripe under a match.
- App icon: a cream gear with a red chevron pointing up, on navy.
- In-game colors (Caleb after Stage 1: slightly darker and grittier, like StarCraft): simplified real colors, muted and dusty, flat with navy outlines. Dusty olive ground with darker and lighter patches, bare dirt in places, tiny specks of grit, pebbles, grass tufts and small cracks; blue-grey water with paler shallows at the shore; dark grey-brown rock cliffs with grit and cracks; very dark navy fog; a dark backdrop around the map. Ores: iron rust red, copper orange with green flecks, gold yellow with a glint, quartz pale pink crystals, coal near-black, sulfur pale yellow, oil a black pool.
- Structures are worn grey metal machines with grime toward the bottom of their walls, panel seams, and a band of the owner's color: the Hub's transmitter tower with a blinking light and rings going out (the spec says directives are sent from the Hub), a lattice-tower Drill, a glowing Smelter with a chimney, a Constructor with a moving arm, a Deployer with a hangar door, a wooden-crate Depot, a tilted Solar panel on legs, a domed Laboratory. The structures from later stages are plain boxes until they are built.
- Belts are dark rubber between metal rails, with chevrons crawling the way they run and a bend where one joins from the side; items ride on them as small pictures (ore rocks, ingot bars, plates, rods, screws, coils). Splitters and mergers are low metal boxes with red arrows for the ways out. Power Poles are posts with a cross arm; lines are dark wires that sag a little. Machines move only while they work (the Drill's bit, the Smelter's glow, the Constructor's arm).
- Minutemen are stick figures in the owner's color with a helmet, as in Stickman Arena, with a walking stride and a forward strike when they hit.
- Other players' units and structures show only on explored ground (where explored ground shows everything, Caleb).
- Player colors: Blue, Orange, Green and Purple, slightly deepened to sit with the darker colors (chosen in the lobby in Stage 6). Red is kept for the interface: selections, warnings, move markers. Single-player is Blue.

## Performance (measured at the end of Stage 3)

Measured in headless Chromium on this build machine, 1440 × 860 screen, at normal (1×) and high (2×, as on most laptops) pixel density. It draws in software with no graphics card, so a real Chrome should do at least as well.

| Case | Result |
| --- | --- |
| Building Basin | About 18 ms. |
| Simulation, 4 players × 200 units (the unit limit) walking in a crowd | About 2 ms a tick on average (worst about 5 ms) of the 50 ms a tick has; most of it is units pushing apart. |
| Simulation, 4 × 200 Aggressive Minutemen marching to one spot and fighting for a minute | About 1.2 ms a tick on average, worst about 22 ms. |
| Drawing, about 270 Minutemen fighting on screen at 100% | 1×: 60 frames a second. 2×: about 52. |
| All 800 units ordered across the map in the same tick | 90–140 ms for that one tick (varies between runs), so the game stutters once. One player ordering 200 units is about a quarter of that. If it shows in play, group orders will share one path search instead of one per unit. |
| 200 units walking into fog at 100% | 1×: 60 frames a second (56 in the 2.5 s measured). 2×: about 43 (here the ground is drawn tile by tile each frame). |
| 200% | 60 frames a second at 1× and 2×. |
| 40% with the whole map explored, once the zoom has settled | 60 frames a second at 1× and 2×. |
| Zooming nonstop between 40% and 100% | 1×: about 38 frames a second; 2×: about 22, while the zoom keeps changing. |
| Belts, simulation: 2,400 belt tiles, all full | 0.16 ms a tick. |
| Belts, drawing: about 880 belt tiles full of items on screen | 1×: 60 frames a second at 100% and 40%. 2×: 30. Belt tiles and items are stamped from cached pictures (before that, 1× was 30 and 2× 20). |

How drawing keeps up:

- Units, belt tiles and items are stamped from cached pictures instead of being drawn stroke by stroke every frame (with 200 units on screen: 20 frames a second before, 60 after).
- Far out, the ground is drawn in cached 16 × 16 tile chunks, each with a ring of its neighbors' tiles so chunks meet without seams. While the zoom is changing, pictures from a few fixed scales are stretched; 0.2 s after it stops, the chunks and unit pictures in view are remade at the exact zoom, a few per frame. A stretched picture was 3 to 4 times slower to draw in this software-only browser (at 2×: 60 frames a second at an exact scale, 15–20 stretched).
- Making and remaking chunks (zooming, fog lifting) is limited to about 6 ms a frame.
