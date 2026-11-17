# Scaling Factor — Spec

Status: content stage. This document records decisions Caleb has made, plus items Claude proposed that Caleb approved. Anything marked [Claude's call] was delegated to Claude and is revisable. Anything not decided is under "Open items."

## Working agreement
- Caleb has a large say at every step of design and build. Ask before deciding anything under "Open items" or anything not covered here.
- Do not add features, structures, units, or materials that are not listed here.
- Implementation (framework, file structure, libraries, netcode, performance, balance numbers) is left to Claude Code, within the constraints below. Caleb will playtest and adjust.
- This project is independent. It replaces an earlier factory-vs-factory idea; nothing carries over from it. It shares a workflow and visual style with Caleb's other web apps, but no code, accounts, or data are assumed to be shared.

## Premise
- An RTS where the goal is creating an automated war machine rather than having the best APM.
- The main goal is building structures that automatically produce units from basic and advanced materials.
- The player can place units by hand, but this is inefficient for most play styles because the time is not spent building the engine.

## Platform and look
- Web app (installable PWA hosted on GitHub Pages), same basic outline and workflow as Caleb's previous web apps.
- Must run on free plans only.
- Visual reference: the shop manual app (https://github.com/TheSilverKnight8/shop-manual). Its color scheme and style carry over, with simplified real colors for in-game things (units, structures, resources) for readability.
- Art style: slightly cartoony sci-fi, like Satisfactory combined with Stickman Arena.
- View: isometric, like StarCraft.
- Devices: computer only.
- Controls: mouse click and drag for selecting and giving orders.
- Building: pick a structure from a menu and place it on the grid.
- Giving orders (hand-placing units, Command Post directives): select a structure or area, then click. Structures or units with multiple options use menus.
- Camera: WASD or arrow keys move the screen. The player zooms manually with on-screen buttons.
- Keyboard shortcuts: wanted for efficiency; specific bindings left to Claude Code.

## Modes and match flow
- Single-player: vs a CPU, plus a story mode.
- Multiplayer: 2-4 players, joining by room code.
- Regular match: each player starts with a Hub. A player whose Hub is destroyed is out. The match ends when one player is left standing.
- Story mode: a tutorial comes first, followed by extra challenge levels (solo). See "Story mode."
- Alliances: set before the match by the host (like StarCraft team setup). CPUs can be allies in multiplayer but not in single-player. Allies share vision but not resources or control. Area damage still hurts allies. Allied players win together.
- Match end rules (time limit, sudden death, stalemate tiebreaker): see "Match end rules."
- Players can surrender.
- Match summary screen at the end of a match. Contents [Claude's call, revisable]: result (winner and alliances), match duration, and per player: units produced and lost, structures built and destroyed, resources gathered by type, research completed, and how many enemy units and structures they destroyed.

## The core loop
- Resources are gathered at nodes by gatherers (Drills, Pumps, and Haulers).
- The player picks a target building for each node (or group of nodes); gatherers deliver there.
- Materials are processed through structures into advanced materials, and units are produced by unit-production structures.
- Belts, pipes, and rails move materials between structures.
- Auto-produced units can be set per structure to act on their own or be directed by the player.
- Units fight automatically based on basic imperatives and attack structures directly.

## Multiplayer details
- The multiplayer room has player names, player colors, and map pings. There is no in-match text chat.
- Room codes, 2-4 players. A room can mix humans and CPU players.
- If a player disconnects, a CPU takes over for them at medium difficulty (Caleb said "medium"; the CPU levels are Easy / Normal / Hard, so this is read as Normal). Rejoining is not possible.
- The host chooses the map, and chooses the difficulty of each CPU in a mixed room. Hub start locations are random.
- The game cannot be paused in multiplayer. It can be paused in single-player.

## Hub
- Each player starts with one Hub, plus enough resources for a Drill and some Solar Generators, and 3 Minutemen for exploration.
- The Hub acts as the player's inventory. The player moves items into the Hub by hand; belts, rails, pipes, and Haulers do not deliver to it. The material cost of hand-placed units, research, and building structures is paid from the Hub, and demolition refunds go back to it. The Hub inventory has a capacity. Depots do not connect to the Hub; they just provide extra storage that the player can then access to move items into the Hub.
- The Hub is quite resilient, and has minor defense mechanisms: a low-damage area-of-effect pulse.
- Any unit the player has unlocked can be produced manually at the Hub.
- Thematically, it is how directives are transmitted.
- Destroying a player's Hub eliminates that player.
- The Hub has health and can be repaired.

## Hand-placed units
- The player places a unit as a directive: the unit is produced at the Hub and moves to that area.
- Hand-placed units do cost something (Caleb corrected an earlier note that they were free). They count toward the unit limit (see "Unit production and automation").
- Purposes: getting started, filling gaps, applying immediate pressure or defense.
- Production time at the Hub depends on the unit and is usually short, so movement is the bulk of deploy time.

## Map and fog of war
- Fixed maps: 3 maps in total. They differ only in layout (no different themes). Each map is StarCraft-sized and works with any player count (2-4).
- Terrain includes water and cliffs, which restrict placement and block everything except air units.
- Resource nodes are in the same place every time within a map (each map places them differently).
- Hubs start at one of many designated starting locations: about 6 per map ("maybe 6" per Caleb), all about evenly spaced from the center. Each start location is roughly balanced in starting resource distance, with a little variance.
- Fog of war: yes. Fog is revealed by units exploring an area, and is permanently lifted in explored areas.
- Structures cannot be placed in fogged areas, or on water or cliffs. Enemy territory is also fogged. (Earlier Caleb said fog was the only placement constraint; water and cliffs were added after.)
- Structures are placed on a grid.

## Resources and materials
Basic resources (from nodes): Iron, Copper, Gold, Quartz, Coal, Oil, Sulfur.
- Nodes are infinite (they never run out).
- Nodes have purity levels like Satisfactory's (Impure, Normal, Pure).
- Gold takes the role of Satisfactory's Caterium.
- Advanced materials follow Satisfactory closely. Item names are from the Satisfactory wiki; recipes follow Satisfactory's and are left to Claude Code.
- Satisfactory parts that depend on resources outside the basic list (Limestone, Water, Bauxite, etc.) are left out: Concrete, Encased Industrial Beam, Heavy Modular Frame, Adaptive Control Unit, the aluminum line (Aluminum Ingot, Alclad Aluminum Sheet, Aluminum Casing, Radio Control Unit, Battery), Cooling System, Heat Sink, Turbo Motor, and later parts that need them.
- Advanced materials are unlocked by research, in tiers.

Materials list:
- Ingots: Iron Ingot, Copper Ingot, Gold Ingot (Caterium Ingot), Steel Ingot
- Standard parts: Iron Plate, Iron Rod, Screws, Wire, Cable, Copper Sheet, Quickwire, Reinforced Iron Plate, Rotor, Modular Frame, Smart Plating, Steel Beam, Steel Pipe, Versatile Framework, Stator, Motor, Automated Wiring
- Quartz line: Quartz Crystal, Silica, Crystal Oscillator
- Oil line: Plastic, Rubber, Polymer Resin, Petroleum Coke, Heavy Oil Residue, Fuel
- Electronics: Circuit Board, Computer, AI Limiter, High-Speed Connector, Supercomputer, Modular Engine
- Sulfur/coal line: Black Powder, Smokeless Powder, Compacted Coal, Turbofuel
- Fuel: just specific resources (e.g. Coal, Compacted Coal, Fuel, Turbofuel)

## Structures
All structures need power to run, and have inputs and outputs (amounts and accepted input types vary per building). Structures have health and can be repaired.

- Gatherers: Drill (solid nodes), Pump (oil nodes)
- Material processors: Smelter, Foundry, Constructor, Assembler, Refinery, Manufacturer
- Unit production: Deployer (infantry, plus the Mechanic), Garage (vehicles, plus the Hauler), Landing Pad (aircraft)
- Unit organization: Command Post (gives extra directives by area, e.g. go to a certain place). Its area is a fixed radius around the Command Post.
- Power: Solar Generator (no fuel, very inefficient in power and space), Coal Generator, Fuel Generator
- Storage: Depot (holds anything; extra storage the player can take items from to put into the Hub, not connected to the Hub)
- Research: Laboratory (research is paid for with resources; unlocks new materials and units)
- Automated defense:
  - Gun Turret: uses Screws as stand-in bullets
  - Arc Pile: like the Gun Turret, but higher damage per shot, lower fire rate, uses electricity as ammo instead of Screws
  - Mortar: hits at long range but not short range, area-of-effect damage, uses any materials as ammo (material does not change damage; a trash dump of sorts)

## Transport (separate from structures)
Belt, Splitter, Merger, Pipe, Rail, Rail Station. They hook up to any port that accepts them.
- Belts, pipes, and rails can cross water. Nothing crosses cliffs.
- Belts: shorter range and direct.
- Rails: run shipments of cargo between points, for large multi-item and/or long-range transport.
- Pipes: for oil and other fluids.

## Power
- Generators supply power to structures through power lines.
- Grid overload: a grid "blows" when its current demand exceeds its supply, not when the theoretical maximum demand of its structures exceeds supply. A blown grid stays down until the player restarts it manually.
- Power can be supplied manually (clicking and supplying fuel by hand, without conveyors or other automatic methods) or by automated fuel delivery.

## Research
- Researched at the Laboratory, one item at a time. Research is instant but costs a fair amount of resources.
- Research unlocks new materials and units.
- At the start of a match, players have only the most basic iron and copper research.
- The research tree is semi-randomized in layout: which items sit where is randomized, but items stay grouped in tiers, and the layout must guarantee nothing is impossible to research (e.g. the materials needed to research an item must never be gated behind that item or otherwise be inaccessible).
- The layout is different for each player.
- Available at the start [Claude's call, revisable; Caleb: must include Smelters and Constructors]:
  - Structures: Drill, Smelter, Constructor, Deployer, Depot, Solar Generator, Laboratory, Belt, power lines. The Laboratory is available to build from the start but is a bit expensive for the starting resources, so the player cannot build it right away (Caleb)
  - Materials (basic iron and copper research): Iron Ingot, Copper Ingot, Iron Plate, Iron Rod, Screws, Wire, Cable
  - Units: Minuteman (producible at the Hub and the Deployer; unlocked units in general can be produced at the Hub)
  - Everything else is unlocked by research.

## Units
Roster: Hauler, Mechanic, Minuteman, Burner, Vanguard, Rifleman, Tank, Rocket Tank, Cyclops, Gunship, Fighter.
- Hauler: gatherer unit; carries resources from a node to the target building, no belts needed. Built at the Garage.
- Mechanic: repairs; restores health. Built at the Deployer.
- Minuteman: cheap infantry
- Burner: area damage
- Vanguard: tanky
- Rifleman: ranged damage
- Tank
- Rocket Tank
- Cyclops: the heavy walker stand-in; tanky, high damage, both melee and ranged attacks
- Gunship: air; bigger, cruiser-like
- Fighter: air; small, fast, swarmy
- Any unit can explore. There is no dedicated scout.

Tiers and key parts (Claude's proposal, approved by Caleb; amounts and stats left to Claude Code):
- Tier 1: Hauler (Iron Plate, Rotor); Minuteman (Iron Plate, Screws); Rifleman (Iron Rod, Wire, Black Powder)
- Tier 2: Mechanic (Motor, Cable, Smart Plating); Burner (Iron Plate, Compacted Coal / Fuel); Vanguard (Reinforced Iron Plate, Steel Beam)
- Tier 3: Tank (Steel Pipe, Motor, Modular Frame); Rocket Tank (Tank parts + Smokeless Powder, Circuit Board); Fighter (Plastic, Circuit Board, Motor, Fuel)
- Tier 4: Cyclops (Modular Engine, Steel Beam, Computer, Rubber); Gunship (Computer, Modular Engine, Smokeless Powder, Turbofuel)

## Unit production and automation
- Each unit-production structure (Deployer, Garage, Landing Pad) produces one unit type at a time; the player can switch it.
- Production keeps going as long as the structure has materials (and power, as for all structures).
- Per structure, the player chooses whether its units act on their own or are directed, and, for units that act on their own, which imperative they follow.
- Directed units wait until given an order. If there is overflow, they move to an open location.
- Unit production structures make units from the unit's key parts as materials, delivered by belt or by hand.
- Unit limit: about 200 units per player ("say, 200 or something"; the exact number is left to Claude Code to tune). Hand-placed units count toward it.
- When a player is at the unit limit, production structures pause and resume when the unit count drops below the limit.

## Unit behavior
- Units fight automatically based on basic imperatives, set per structure for auto-produced units (or directed by the player).
- Imperatives (Claude proposed, Caleb approved with Guard and Hold merged): Aggressive (chase and attack anything seen), Hold Point (stay at a location, attack in range), Patrol (loop between points), Explore (reveal fog, avoid fights).
- Units attack structures directly.
- Command Posts give extra directives to units within a fixed radius.

## Story mode
- Light narrative with characters; mostly flavor.
- Two robot characters guide the player: Perceval (male; more stoic and strategic) and Palamedes (female; more friendly and resource-driven). They have dialog with the player and comment on matches, in both story mode and regular matches.
- Character design and narrative details are left to Claude Code; Caleb will edit from there.
- About 10 levels in total (tutorial plus challenges), Caleb's estimate ("maybe 10").
- The tutorial comes first. Challenge levels are extra levels after it.
- The tutorial and challenge levels use the 3 maps, in fixed setups.
- Challenge levels are practice in different locations with different strategy objectives, introducing different playstyles. Nothing else special (no build restrictions or extra rules were specified).
- Story mode progress is saved locally. (This is the only saved data decided so far.)
- Single-player matches cannot be saved and resumed; they are played in one sitting (pausing is allowed).
- Level breakdown [Claude's proposal, divided by mechanic; approved by Caleb with level 10 swapped; which map each uses is left to Claude Code]:
  1. Tutorial: gather and place. Drill on a node, deliver to a Depot, power it with Solar Generators
  2. Tutorial: processing. Smelter and Constructor on a Belt chain to produce a target part
  3. Tutorial: units. Deployer producing Minutemen automatically, set an imperative, hand-place units
  4. Tutorial: a full match against the Easy CPU, including exploring fog and destroying its Hub
  5. Challenge: research. Unlock a target part line under a resource budget
  6. Challenge: logistics. Haulers, rails, and crossing water to move materials a long distance
  7. Challenge: power. Keep a growing base powered with Coal and Fuel Generators
  8. Challenge: defense. Survive CPU attacks with Gun Turrets, Arc Piles, Mortars, and the Hub
  9. Challenge: ground push. Tanks and Rocket Tanks directed with Command Posts and imperatives
  10. Challenge: resource outpost (replaces the air challenge, per Caleb). Objective [Claude's call, revisable]: explore to a distant, unexplored node, build a self-sufficient outpost there (Drill, Solar Generators, a few defenses), and hold it against CPU raids until it has produced a target amount of resources

## Match end rules
Caleb asked for a time limit, sudden death, and a stalemate tiebreaker "of your choosing." [Claude's call, revisable; numbers are tunable by Claude Code]
- Time limit: 60 minutes.
- Sudden death: when the time limit is reached, every Hub starts losing health at the same steady rate and cannot be repaired. The match ends when only one player or alliance still has a Hub.
- Stalemate: if for 5 minutes no player can destroy an enemy structure, produce units, or gather resources, the match goes straight to sudden death. (The idea comes from StarCraft II's stalemate rule.)
- Tiebreaker: if the last Hubs are destroyed at the same moment, the winner is the player or alliance that gathered the most total resources over the match. If that is also tied, the match is a draw.

## Building, demolition, and elimination
- Structures cost resources to build, paid from the Hub. Rebuilding a destroyed structure costs the full cost again.
- Structures can be demolished by the player for a full refund.
- When a Hub is destroyed and its player is eliminated, all of that player's remaining structures and units are destroyed.

## Combat
- Damage is just damage: no damage types or armor types, no unit-type strengths and weaknesses.
- Ranged units can attack air units; melee units cannot. Air units can attack anything.
- Arc Pile can target air units. Gun Turret and Mortar can only target ground.
- Units attack structures directly.
- Attack types [Minuteman is melee per Caleb; the rest are Claude's call, revisable]:
  - Melee (cannot hit air): Minuteman, Burner (short-range flame), Vanguard
  - Ranged (can hit air): Rifleman, Tank, Rocket Tank
  - Both melee and ranged (can hit air): Cyclops
  - Air units (can hit anything): Fighter, Gunship
  - Non-combat: Hauler, Mechanic (unarmed)

## CPU opponent
- Plays by the same rules as the player.
- Difficulty levels [Claude's call, revisable]: Easy / Normal / Hard. No resource cheating at any level; the levels differ only in how well the CPU plays.
  - Easy: builds slowly, small and simple production lines, small attack waves, rarely defends or scouts
  - Normal: steady expansion, a few production lines, regular attack waves, defends its Hub, scouts occasionally
  - Hard: fast expansion, efficient multi-stage production chains, scouts actively, coordinates larger attacks, goes after weakly defended structures, adapts when its Hub is threatened

## Audio
- Music and sound effects. Music style: focus/working music that fits a strategic tech theme (this replaces the earlier "similar to Satisfactory's music" note).
- Perceval and Palamedes are silent (text dialog only).
- Audio settings (e.g. volume controls) are wanted.
- Sound effects and music are both made by Claude Code itself, like the sounds for Stickman Arena (Caleb).

## Left to Claude Code
- Main menu and lobby screens (content and layout)
Framework, networking approach and room-code format, file structure, performance, balance numbers and stats, recipes (following Satisfactory), exact costs, AI implementation. (Caleb said "let code fully decide the how".)

## Open items
- None
