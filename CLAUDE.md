# Notes for Claude Code

`SPEC.md` is Caleb's. It holds what the game does. Follow it and do not add features, structures, units or materials that are not in it. Items it marks **[Claude's call]** were left to the builder and can be revised.

- The ideas are Caleb's; the design and implementation are the builder's (SPEC "Working agreement" and "Left to Claude Code": framework, networking, file structure, performance, balance numbers, recipes following Satisfactory, exact costs, AI). When a question is about *what* the game should do and `SPEC.md` does not answer it, ask Caleb before building it. The builder's choices and Caleb's answers are recorded in `docs/decisions.md`.
- Build in the stages listed in `docs/decisions.md` (agreed with Caleb), macro to micro. Each stage ends at a test checkpoint: Caleb tries it before the next stage starts. Bring each stage's open questions to Caleb before starting it.
- Work on a branch per stage. Ask Caleb before merging to `main`: a push to `main` publishes the site.
- This project is independent of Caleb's other projects. It replaces an earlier factory-vs-factory idea; nothing carries over from it. The only links are the workflow and the visual style.
- Look (Caleb's answer): the Engineering Management Portal's style (cream, navy and red, Norwester headings, Archivo body text, staggered stripes, flat cards). The spec links the old shop manual; Caleb chose the Portal. Light mode only. In-game things (units, structures, resources, ground) use simplified real colors drawn flat with navy outlines, slightly darker and grittier like StarCraft (Caleb after Stage 1; `src/render/style.ts`); infantry are stick figures in Stickman Arena's manner.
- Logo rule (same as the other apps): the full Croswell Industries logo on Home only; the C mark on every other screen, in the gap left of the bottom stripes (a match keeps a slim stripe with the C mark).
- Computer only (Chrome is the target). Free plans only. Hosting is GitHub Pages. Multiplayer (Stage 6) is planned on the free PeerJS signaling server with direct WebRTC connections, as in Stickman Arena. The only saved data decided so far is story-mode progress, in this browser (Stage 7).
- The simulation (`src/sim/`) must give identical results on every computer, because multiplayer will keep players in step by sending only commands (lockstep):
  - It changes only in `step()` (`src/sim/step.ts`), and only through the commands in `src/sim/commands.ts`. Every player action must be a command and be checked there, not only in the interface.
  - Whole numbers only: positions are in 1/1024 tile (`FP` in `src/sim/fmath.ts`). No `Math.random`, `Math.sin`/`cos`/`atan2`/`pow`, `Date` or other engine-dependent math inside `src/sim/`; use `src/sim/rng.ts`, `isqrt`, and the written-out `sin15`/`cos15` tables. Maps are built with the same rules (`src/sim/map/builder.ts`).
  - Nothing in `src/sim/` may import from `src/render/`, `src/game/` or the DOM.
  - `npm run check:sim` must pass: maps are connected, two runs give the same state fingerprint, and the load test at the unit limit is printed.
- Drawing (`src/render/`) reads the match state and never changes it. Terrain is cached in chunks redrawn when their fog changes; units are stamped from cached sprites (`src/render/sprites.ts`). Zoom is smooth: pictures are stretched while it changes and remade at the exact zoom once it settles. Measure frame time with many units on screen at the end of each stage and record it in `docs/decisions.md`.
- `npm run typecheck` and `npm run build` must pass.
