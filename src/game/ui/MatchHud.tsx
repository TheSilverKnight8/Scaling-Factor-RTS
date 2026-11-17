import { useSyncExternalStore, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Menu, Minus, Plus, RotateCw, Trash2 } from 'lucide-react';
import { STRUCTURES } from '../../sim/content/structures';
import { unitCount } from '../../sim/content/units';
import { Button, Kbd, cx } from '../../components/ui';
import { BUILD_MENU, type Game } from '../Game';
import { Minimap } from './Minimap';
import { StructureIcon } from './StructureIcon';

function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('pointer-events-auto rounded-2xl border border-line bg-surface/95 shadow-pop backdrop-blur', className)}>{children}</div>;
}

function clock(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Everything drawn over the map: clock, menu, zoom buttons, selection and the build menu. */
export function MatchHud({ game }: { game: Game }) {
  const hud = useSyncExternalStore(game.subscribe, game.getHud);
  const color = game.state.players.find((p) => p.id === game.me)?.color ?? 0;

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3">
      {/* Top: menu and clock on the left, zoom on the right. */}
      <div className="flex items-start justify-between gap-3">
        <Panel className="flex items-center gap-1 p-1.5">
          <Button size="sm" variant="ghost" onClick={() => game.setMenu(true)} title="Menu (Esc)">
            <Menu className="size-4" />
            Menu
          </Button>
          <span className="px-2 font-mono text-sm tabular-nums text-ink" title="Match time">
            {clock(hud.seconds)}
          </span>
        </Panel>
        {hud.placeError && hud.build && (
          <Panel className="px-4 py-2 text-sm text-warn">
            {hud.placeError}
          </Panel>
        )}
        <Panel className="flex items-center gap-1 p-1.5">
          <Button size="sm" variant="ghost" onClick={() => game.zoomStep(-1)} disabled={!hud.canZoomOut} title="Zoom out (-, mouse wheel or pinch)" aria-label="Zoom out">
            <Minus className="size-4" />
          </Button>
          <span className="w-12 text-center font-mono text-sm tabular-nums">{hud.zoomPercent}%</span>
          <Button size="sm" variant="ghost" onClick={() => game.zoomStep(1)} disabled={!hud.canZoomIn} title="Zoom in (+, mouse wheel or pinch)" aria-label="Zoom in">
            <Plus className="size-4" />
          </Button>
        </Panel>
      </div>

      {/* Bottom: the minimap and what is selected on the left, the build menu on the right. */}
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-end gap-3">
          <Minimap game={game} />
          <Panel className="w-72 p-4">
            <SelectionPanel game={game} />
          </Panel>
        </div>
        <Panel className="p-2">
          <div className="mb-1 flex items-center justify-between gap-3 px-1.5">
            <span className="label-caps text-muted">Build</span>
            {hud.build ? (
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <Kbd>R</Kbd> rotate <Kbd>Right click</Kbd> or <Kbd>Esc</Kbd> stop
                <button className="ml-1 rounded p-1 text-ink hover:bg-raised" onClick={() => game.rotateBuild()} title="Rotate (R)" aria-label="Rotate">
                  <RotateCw className="size-3.5" />
                </button>
              </span>
            ) : (
              <span className="text-xs text-muted">Pick a structure, then click the map</span>
            )}
          </div>
          <div className="flex gap-1">
            {BUILD_MENU.map((kind, i) => {
              const active = hud.build?.kind === kind;
              return (
                <button
                  key={kind}
                  onClick={() => (active ? game.cancelBuild() : game.startBuild(kind))}
                  title={`${STRUCTURES[kind].name}: ${STRUCTURES[kind].blurb} (${i + 1})`}
                  className={cx('relative flex w-[5.25rem] flex-col items-center rounded-xl border px-1 pb-1.5 pt-1 transition', active ? 'border-accent bg-accent/10' : 'border-transparent hover:bg-raised')}
                >
                  <StructureIcon kind={kind} color={color} />
                  <span className="mt-0.5 text-center text-[0.6875rem] font-medium leading-tight">{STRUCTURES[kind].name}</span>
                  <Kbd className="absolute left-1 top-1 px-1 py-0 text-[0.625rem]">{i + 1}</Kbd>
                </button>
              );
            })}
          </div>
        </Panel>
      </div>

      {hud.menuOpen && <MatchMenu game={game} />}
    </div>
  );
}

function SelectionPanel({ game }: { game: Game }) {
  const hud = useSyncExternalStore(game.subscribe, game.getHud);
  const sel = hud.selection;
  if (!sel)
    return (
      <div className="text-sm text-muted">
        <div className="label-caps mb-1 text-ink">Nothing selected</div>
        Click a unit, structure or node. Drag a box to select several units, then right-click the map to send them there.
      </div>
    );
  if (sel.kind === 'units')
    return (
      <div>
        <div className="label-caps text-accent">{sel.count === 1 ? 'Unit' : `${sel.count} units`}</div>
        <div className="mt-1 font-display text-2xl uppercase leading-none">{sel.groups.map((g) => unitCount(g.name, g.count)).join(', ')}</div>
        <Health hp={sel.hp} max={sel.maxHp} />
        <p className="mt-2 text-xs text-muted">Right-click the map to move.</p>
      </div>
    );
  if (sel.kind === 'structure')
    return (
      <div>
        <div className="label-caps text-accent">{sel.mine ? 'Your structure' : 'Structure'}</div>
        <div className="mt-1 font-display text-2xl uppercase leading-none">{sel.name}</div>
        <p className="mt-1.5 text-sm text-muted">{sel.blurb}</p>
        {sel.building && (
          <div className="mt-2.5">
            <div className="h-2 overflow-hidden rounded-full bg-raised">
              <div className="h-full rounded-full bg-accent" style={{ width: `${sel.building.percent}%` }} />
            </div>
            <div className="mt-1 font-mono text-[0.6875rem] text-muted">
              Building: {sel.building.percent}%, {sel.building.secondsLeft} s left
            </div>
          </div>
        )}
        <Health hp={sel.hp} max={sel.maxHp} />
        {sel.canDemolish && (
          <Button size="xs" variant="danger" className="mt-3" onClick={() => game.demolishSelected()}>
            <Trash2 className="size-3.5" />
            Demolish
            <Kbd className="ml-1 border-danger/30">Del</Kbd>
          </Button>
        )}
      </div>
    );
  return (
    <div>
      <div className="label-caps text-accent">Resource node</div>
      <div className="mt-1 font-display text-2xl uppercase leading-none">{sel.resource}</div>
      <p className="mt-1.5 text-sm text-muted">
        {sel.purity} purity. Never runs out. {sel.fluid ? 'Gathered with a Pump.' : 'Gathered with a Drill placed on it.'}
      </p>
    </div>
  );
}

function Health({ hp, max }: { hp: number; max: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, hp / max)) : 0;
  return (
    <div className="mt-2.5">
      <div className="h-2 overflow-hidden rounded-full bg-raised">
        <div className={cx('h-full rounded-full', pct > 0.35 ? 'bg-navy' : 'bg-accent')} style={{ width: `${pct * 100}%` }} />
      </div>
      <div className="mt-1 font-mono text-[0.6875rem] text-muted">
        {hp} / {max} health
      </div>
    </div>
  );
}

const CONTROLS: [string, string][] = [
  ['Click', 'Select a unit, structure or node'],
  ['Drag', 'Select your units in a box'],
  ['Shift + click or drag', 'Add to the selection'],
  ['Right click', 'Move the selected units there'],
  ['W A S D or arrows', 'Move the camera'],
  ['Mouse wheel or pinch', 'Zoom in and out toward the pointer'],
  ['+ and -', 'Zoom in and out (or the buttons)'],
  ['H', 'Center on your Hub'],
  ['Click or drag the minimap', 'Move the camera there'],
  ['1 to 7', 'Pick a structure to build'],
  ['R', 'Rotate the structure being placed'],
  ['Right click or Esc', 'Stop building'],
  ['Delete', 'Demolish the selected structure'],
  ['Esc', 'Clear the selection, or open this menu'],
];

function MatchMenu({ game }: { game: Game }) {
  const navigate = useNavigate();
  return (
    <div className="pointer-events-auto absolute inset-0 flex animate-fade items-center justify-center bg-navy/40 p-6">
      <div className="w-full max-w-lg animate-rise rounded-2xl border border-line bg-surface p-7 shadow-pop">
        <p className="label-caps text-accent">Paused</p>
        <h2 className="mt-1 text-4xl">Menu</h2>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => game.setMenu(false)}>
            Resume
          </Button>
          <Button onClick={() => navigate('/single')}>Quit match</Button>
        </div>
        <h3 className="mt-7 text-xl">Controls</h3>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          {CONTROLS.map(([k, v]) => (
            <div key={k} className="contents">
              <dt>
                <Kbd>{k}</Kbd>
              </dt>
              <dd className="text-muted">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
