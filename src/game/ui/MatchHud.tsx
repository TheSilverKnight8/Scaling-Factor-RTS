import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { ArrowDownToLine, ArrowUpFromLine, Menu, Minus, Plus, Power, RotateCw, Trash2, Unplug, Users, Warehouse } from 'lucide-react';
import { ITEMS } from '../../sim/content/items';
import { IMPERATIVES, unitCount } from '../../sim/content/units';
import { Button, Kbd, cx } from '../../components/ui';
import { BUILD_MENU, type BuildEntry, type Game, type HudState, type SelectionInfo } from '../Game';
import { ItemIcon, ToolIcon } from './Icons';
import { Minimap } from './Minimap';

function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('pointer-events-auto rounded-2xl border border-line bg-surface/95 shadow-pop backdrop-blur', className)}>{children}</div>;
}

function clock(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const GROUPS: BuildEntry['group'][] = ['Production', 'Power', 'Transport'];

/** Everything drawn over the map: clock, Hub inventory, zoom, minimap, selection and the build menu. */
export function MatchHud({ game }: { game: Game }) {
  const hud = useSyncExternalStore(game.subscribe, game.getHud);
  const color = game.player.color;

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3">
      {/* Top: menu and clock, the Hub's inventory, zoom. */}
      <div className="flex items-start justify-between gap-3">
        <Panel className="flex shrink-0 items-center gap-1 p-1.5">
          <Button size="sm" variant="ghost" onClick={() => game.setMenu(true)} title="Menu (Esc)">
            <Menu className="size-4" />
            Menu
          </Button>
          <span className="px-2 font-mono text-sm tabular-nums text-ink" title="Match time">
            {clock(hud.seconds)}
          </span>
        </Panel>
        <div className="flex min-w-0 flex-col items-center gap-2">
          <HubBar hud={hud} />
          {hud.notices.map((n) => (
            <Panel key={n} className="border-accent px-4 py-2 font-display text-lg uppercase tracking-wide text-accent">
              {n}
            </Panel>
          ))}
          {hud.tool && (hud.tool.id === 'placeUnit' || hud.tool.id === 'patrol') && (
            <Panel className="px-4 py-2 text-sm">
              {hud.tool.id === 'placeUnit' ? 'Click the map where the unit should go: it is made at the Hub, walks there and holds the spot. Right click or Esc to stop.' : 'Click up to 8 patrol points, in order. Right click or Enter to finish; Esc to cancel.'}
            </Panel>
          )}
          {hud.placeError && hud.tool && <Panel className="px-4 py-2 text-sm text-warn">{hud.placeError}</Panel>}
        </div>
        <Panel className="flex shrink-0 items-center gap-1 p-1.5">
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
        <div className="flex min-h-0 items-end gap-3">
          <Minimap game={game} />
          <Panel className="max-h-[calc(100dvh-12rem)] w-80 overflow-y-auto p-4">
            <SelectionPanel game={game} sel={hud.selection} hub={hud.hub} />
          </Panel>
        </div>
        <BuildMenu game={game} hud={hud} color={color} />
      </div>

      {hud.menuOpen && <MatchMenu game={game} />}
    </div>
  );
}

function HubBar({ hud }: { hud: HudState }) {
  const full = hud.hub.total >= hud.hub.capacity;
  return (
    <Panel className="flex max-w-[44rem] flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
      <span className="flex items-center gap-1.5 label-caps text-muted" title="The Hub's inventory: what you build and pay with">
        <Warehouse className="size-4" />
        Hub
      </span>
      {hud.hub.items.length === 0 && <span className="text-xs text-muted">Empty</span>}
      {hud.hub.items.map((it) => (
        <span key={it.item} className="flex items-center gap-1 text-sm tabular-nums" title={it.name}>
          <ItemIcon item={it.item} />
          {it.count}
        </span>
      ))}
      <span className={cx('font-mono text-[0.6875rem]', full ? 'text-warn' : 'text-muted')} title="Items in the Hub / its capacity">
        {hud.hub.total} / {hud.hub.capacity}
      </span>
      <span className="mx-1 h-4 w-px bg-line" />
      <span className={cx('flex items-center gap-1 text-sm tabular-nums', hud.units >= hud.unitLimit ? 'text-warn' : 'text-ink')} title="Your units / the unit limit (production pauses at it)">
        <Users className="size-4 text-muted" />
        {hud.units} / {hud.unitLimit}
      </span>
    </Panel>
  );
}

function BuildMenu({ game, hud, color }: { game: Game; hud: HudState; color: number }) {
  const [hover, setHover] = useState<BuildEntry | null>(null);
  const group = game.group;
  const shown = hover ?? BUILD_MENU.find((e) => e.id === hud.tool?.id) ?? null;
  return (
    <div className="flex flex-col items-end gap-2">
      {shown && (
        <Panel className="w-80 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-display text-lg uppercase leading-none">{shown.name}</span>
            <Kbd>{shown.key}</Kbd>
          </div>
          <p className="mt-1 text-muted">{shown.blurb}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            {shown.cost.map(([id, n]) => (
              <span key={id} className="flex items-center gap-1 tabular-nums">
                <ItemIcon item={id} />
                {n} {ITEMS[id].name}
              </span>
            ))}
            {shown.costNote && <span className="text-xs text-muted">{shown.costNote}</span>}
          </div>
          {hud.tool && hud.tool.id === shown.id && <ToolHint id={shown.id} lineFrom={hud.tool.lineFrom} />}
        </Panel>
      )}
      <Panel className="p-2">
        <div className="mb-1.5 flex items-center justify-between gap-3 px-1">
          <div className="flex gap-1">
            {GROUPS.map((g) => (
              <button key={g} onClick={() => game.setGroup(g)} className={cx('rounded-lg px-2.5 py-1 font-display text-[0.8125rem] uppercase tracking-[0.06em] transition', group === g ? 'bg-navy text-on-accent' : 'text-muted hover:bg-raised hover:text-ink')}>
                {g}
              </button>
            ))}
          </div>
          {hud.tool ? (
            <button className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-ink hover:bg-raised" onClick={() => game.rotateTool()} title="Rotate (R)">
              <RotateCw className="size-3.5" /> <Kbd>R</Kbd>
            </button>
          ) : (
            <span className="text-xs text-muted">Pick one, then click the map</span>
          )}
        </div>
        <div className="flex gap-1">
          {BUILD_MENU.filter((e) => e.group === group).map((e) => {
            const active = hud.tool?.id === e.id;
            const can = hud.affordable[e.id];
            return (
              <button
                key={e.id}
                onClick={() => (active ? game.cancelTool() : game.startTool(e.id))}
                onMouseEnter={() => setHover(e)}
                onMouseLeave={() => setHover(null)}
                className={cx('relative flex w-[5.25rem] flex-col items-center rounded-xl border px-1 pb-1.5 pt-1 transition', active ? 'border-accent bg-accent/10' : 'border-transparent hover:bg-raised', !can && !active && 'opacity-45')}
              >
                <ToolIcon id={e.id} color={color} />
                <span className="mt-0.5 text-center text-[0.6875rem] font-medium leading-tight">{e.name}</span>
                <Kbd className="absolute left-1 top-1 px-1 py-0 text-[0.625rem]">{e.key}</Kbd>
              </button>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

function ToolHint({ id, lineFrom }: { id: BuildEntry['id']; lineFrom: boolean }) {
  const text =
    id === 'belt'
      ? 'Press and drag to lay a line; R changes which way it bends. A click lays one tile (R turns it). Belts feed into input ports (cream arrows) and take from output ports (red arrows).'
      : id === 'line'
        ? lineFrom
          ? 'Click another pole or structure to connect it. Right click or Esc to stop.'
          : 'Click a pole or structure to start the line.'
        : id === 'splitter' || id === 'merger'
          ? 'Click to place; R turns it.'
          : 'Click to place; R turns it. Line up ports (arrows) to join structures directly, or join them with belts.';
  return <p className="mt-2 border-t border-line pt-2 text-xs text-muted">{text}</p>;
}

function SelectionPanel({ game, sel, hub }: { game: Game; sel: SelectionInfo | null; hub: HudState['hub'] }) {
  if (!sel)
    return (
      <div className="text-sm text-muted">
        <div className="label-caps mb-1 text-ink">Nothing selected</div>
        Click a unit, structure, belt or node. Drag a box to select several units, then right-click the map to send them there.
      </div>
    );
  if (sel.kind === 'units')
    return (
      <div>
        <div className="label-caps text-accent">{sel.count === 1 ? 'Unit' : `${sel.count} units`}</div>
        <div className="mt-1 font-display text-2xl uppercase leading-none">{sel.groups.map((g) => unitCount(g.name, g.count)).join(', ')}</div>
        {!sel.mine && <p className="mt-1 text-sm text-muted">{sel.owner}</p>}
        <Bar value={sel.hp} max={sel.maxHp} label={`${sel.hp} / ${sel.maxHp} health`} />
        {sel.mine && <p className="mt-2 text-sm">{sel.behavior}</p>}
        {sel.mine && <p className="mt-2 text-xs text-muted">Right-click an enemy to attack it, or the ground to move there. Ordered units wait for your orders afterwards.</p>}
      </div>
    );
  if (sel.kind === 'node')
    return (
      <div>
        <div className="label-caps text-accent">Resource node</div>
        <div className="mt-1 font-display text-2xl uppercase leading-none">{sel.resource}</div>
        <p className="mt-1.5 text-sm text-muted">
          {sel.purity} purity: {sel.rate}. Never runs out.
        </p>
      </div>
    );
  if (sel.kind === 'belt')
    return (
      <div>
        <div className="label-caps text-accent">Transport</div>
        <div className="mt-1 font-display text-2xl uppercase leading-none">{sel.name}</div>
        <ItemList items={sel.carrying} empty="Carrying nothing." />
        <Button size="xs" variant="danger" className="mt-3" onClick={() => game.demolishSelected()}>
          <Trash2 className="size-3.5" />
          Remove
          <Kbd className="ml-1 border-danger/30">Del</Kbd>
        </Button>
      </div>
    );

  return (
    <div>
      <div className="label-caps text-accent">{sel.isHub ? (sel.mine ? 'Your Hub' : `${sel.owner}'s Hub`) : sel.mine ? 'Your structure' : `${sel.owner}'s structure`}</div>
      <div className="mt-1 font-display text-2xl uppercase leading-none">{sel.name}</div>
      <p className="mt-1.5 text-sm text-muted">{sel.blurb}</p>
      {sel.building && <Bar value={sel.building.percent} max={100} accent label={`Building: ${sel.building.percent}%, ${sel.building.secondsLeft} s left`} />}
      {!sel.building && !sel.isHub && <p className={cx('mt-2 text-sm font-medium', sel.status === 'blown' || sel.status === 'noPower' ? 'text-warn' : 'text-ink')}>{sel.statusText}</p>}

      {sel.isHub && (
        <Section title="Inventory">
          <ItemList items={hub.items} empty="Empty." />
          <Bar value={hub.total} max={hub.capacity} accent={hub.total >= hub.capacity} label={`${hub.total} / ${hub.capacity} items`} />
        </Section>
      )}

      {sel.place && (
        <Section title="Place units">
          {sel.place.options.map((o) => (
            <Button key={o.kind} size="sm" className="h-auto justify-start py-1.5 text-left" disabled={!o.affordable} onClick={() => game.startPlaceUnit(o.kind)} title="Then click the map where it should go">
              <span className="flex flex-col items-start normal-case tracking-normal">
                <span className="font-display uppercase tracking-[0.06em]">{o.name}</span>
                <span className="font-sans text-xs text-muted">
                  {o.parts}, {o.seconds} s at the Hub
                </span>
              </span>
            </Button>
          ))}
          {sel.place.waiting > 0 && <Bar value={sel.place.percent} max={100} accent label={`${sel.place.waiting} waiting to be made`} />}
        </Section>
      )}

      {sel.production && sel.mine && (
        <Section title="Produces">
          <div className="flex flex-col gap-1">
            {sel.production.options.map((o) => (
              <button
                key={o.kind}
                onClick={() => game.setProduce(sel.production!.produce === o.kind ? null : o.kind)}
                className={cx('rounded-lg border px-2.5 py-1.5 text-left text-xs transition', sel.production!.produce === o.kind ? 'border-accent bg-accent/10' : 'border-line hover:bg-raised')}
              >
                <span className="font-medium text-ink">{o.name}</span>
                <span className="block text-muted">
                  {o.parts}, {o.seconds} s
                </span>
              </button>
            ))}
            <span className="text-xs text-muted">More units come with research (Stage 4).</span>
          </div>
          {sel.production.produce && sel.production.percent > 0 && <Bar value={sel.production.percent} max={100} accent label={`Making: ${sel.production.percent}%`} />}
        </Section>
      )}

      {sel.production && sel.mine && (
        <Section title="Its units">
          <div className="inline-flex rounded-xl border border-line bg-raised p-0.5">
            {(['auto', 'directed'] as const).map((m) => (
              <button key={m} onClick={() => game.setUnitMode(m, sel.production!.imperative)} className={cx('flex-1 rounded-lg px-3 py-1 text-xs font-medium transition', sel.production!.mode === m ? 'bg-navy text-on-accent' : 'text-muted hover:text-ink')}>
                {m === 'auto' ? 'Act on their own' : 'Directed'}
              </button>
            ))}
          </div>
          {sel.production.mode === 'auto' ? (
            <div className="grid grid-cols-2 gap-1">
              {IMPERATIVES.map((i) => (
                <button key={i.id} onClick={() => game.setUnitMode('auto', i.id)} title={i.text} className={cx('rounded-lg border px-2 py-1 text-left text-xs transition', sel.production!.imperative === i.id ? 'border-accent bg-accent/10 font-medium' : 'border-line hover:bg-raised')}>
                  {i.name}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted">They wait at the rally point for your orders.</p>
          )}
          {sel.production.mode === 'auto' && <p className="text-xs text-muted">{IMPERATIVES.find((i) => i.id === sel.production!.imperative)!.text}</p>}
          {sel.production.mode === 'auto' && sel.production.imperative === 'patrol' && (
            <Button size="xs" onClick={() => game.startPatrol()}>
              Set patrol points ({sel.production.patrolPoints})
            </Button>
          )}
          <p className="text-xs text-muted">Right-click the map to set the rally point (the flag).</p>
        </Section>
      )}

      {sel.recipes && sel.mine && (
        <Section title="Recipe">
          <div className="flex flex-col gap-1">
            {sel.recipes.map((r) => (
              <button
                key={r.id}
                onClick={() => game.chooseRecipe(r.selected ? null : r.id)}
                className={cx('rounded-lg border px-2.5 py-1.5 text-left text-xs transition', r.selected ? 'border-accent bg-accent/10' : 'border-line hover:bg-raised')}
                title={r.selected ? 'Click again to clear the recipe' : undefined}
              >
                <span className="font-medium text-ink">{r.name}</span>
                <span className="block text-muted">{r.text}</span>
              </button>
            ))}
          </div>
        </Section>
      )}

      {sel.mine && sel.needs.length > 0 && (
        <Section title="From the Hub">
          {sel.needs.map((n) => (
            <div key={n.item} className="flex items-center gap-2 text-sm">
              <ItemIcon item={n.item} />
              <span className="flex-1">
                {n.name} <span className="text-muted">({n.have} in, {n.inHub} in Hub)</span>
              </span>
              <Button size="xs" onClick={() => game.giveItem(n.item)} disabled={n.room <= 0 || n.inHub <= 0} title="Move as many as fit from the Hub">
                <ArrowDownToLine className="size-3.5" />
                Add
              </Button>
            </div>
          ))}
        </Section>
      )}

      {sel.mine && !sel.isHub && sel.contents.length > 0 && (
        <Section title="Holding">
          {sel.contents.map((c) => (
            <div key={c.item} className="flex items-center gap-2 text-sm">
              <ItemIcon item={c.item} />
              <span className="flex-1 tabular-nums">
                {c.count} {c.name}
              </span>
              <Button size="xs" onClick={() => game.takeItem(c.item)} disabled={hub.total >= hub.capacity} title="Move to the Hub (as many as fit)">
                <ArrowUpFromLine className="size-3.5" />
                To Hub
              </Button>
            </div>
          ))}
        </Section>
      )}

      {sel.power && sel.mine && (
        <Section title="Power">
          <div className="text-sm">
            {sel.power.makes > 0 ? <>Makes {sel.power.makes} MW.</> : sel.power.uses > 0 ? <>Uses {sel.power.uses} MW while working.</> : <>Carries power.</>}
            <span className="block text-muted">
              Grid: {sel.power.demand} MW used of {sel.power.supply} MW. Lines {sel.power.lines} / {sel.power.maxLines}.
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {sel.power.blown && (
              <Button size="xs" variant="primary" onClick={() => game.restartGrid()}>
                <Power className="size-3.5" />
                Restart grid
              </Button>
            )}
            <Button size="xs" onClick={() => game.startTool('line')} title="Start a power line here (L)">
              Connect <Kbd className="ml-1">L</Kbd>
            </Button>
            {sel.power.lines > 0 && (
              <Button size="xs" onClick={() => game.removeLines()} title="Remove this structure's power lines (refunded)">
                <Unplug className="size-3.5" />
                Remove lines
              </Button>
            )}
          </div>
        </Section>
      )}

      <Bar value={sel.hp} max={sel.maxHp} label={`${sel.hp} / ${sel.maxHp} health`} />
      {sel.canDemolish && (
        <Button size="xs" variant="danger" className="mt-3" onClick={() => game.demolishSelected()} title="Full refund to the Hub, with what it holds">
          <Trash2 className="size-3.5" />
          Demolish
          <Kbd className="ml-1 border-danger/30">Del</Kbd>
        </Button>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-3 border-t border-line pt-2.5">
      <div className="label-caps mb-1.5 text-muted">{title}</div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

function ItemList({ items, empty }: { items: { item: keyof typeof ITEMS; name: string; count: number }[]; empty: string }) {
  if (!items.length) return <p className="mt-1.5 text-sm text-muted">{empty}</p>;
  return (
    <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1">
      {items.map((it) => (
        <span key={it.item} className="flex items-center gap-1.5 text-sm tabular-nums">
          <ItemIcon item={it.item} />
          {it.count} {it.name}
        </span>
      ))}
    </div>
  );
}

function Bar({ value, max, label, accent }: { value: number; max: number; label: string; accent?: boolean }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <div className="mt-2.5">
      <div className="h-2 overflow-hidden rounded-full bg-raised">
        <div className={cx('h-full rounded-full', accent ? 'bg-accent' : pct > 0.35 ? 'bg-navy' : 'bg-accent')} style={{ width: `${pct * 100}%` }} />
      </div>
      <div className="mt-1 font-mono text-[0.6875rem] text-muted">{label}</div>
    </div>
  );
}

const CONTROLS: [string, string][] = [
  ['Click', 'Select a unit, structure, belt or node'],
  ['Drag', 'Select your units in a box'],
  ['Shift + click or drag', 'Add to the selection'],
  ['Right click', 'With units selected: attack the enemy under the pointer, or move there. With a Deployer selected: set its rally point'],
  ['W A S D or arrows', 'Move the camera'],
  ['Mouse wheel or pinch', 'Zoom in and out toward the pointer'],
  ['+ and -', 'Zoom in and out (or the buttons)'],
  ['H', 'Center on your Hub'],
  ['Click or drag the minimap', 'Move the camera there'],
  ['1 to 7, P, L', 'Production structures, Solar Generator, Power Pole, Power Line'],
  ['B, T, M', 'Belt (drag to lay a line), Splitter, Merger'],
  ['R', 'Rotate what is being placed; while dragging a belt, change its bend'],
  ['Right click or Esc', 'Stop building'],
  ['Delete', 'Demolish the selected structure or belt (full refund)'],
  ['Enter', 'Finish setting patrol points'],
  ['Esc', 'Clear the selection, or open this menu'],
];

function MatchMenu({ game }: { game: Game }) {
  const navigate = useNavigate();
  return (
    <div className="pointer-events-auto absolute inset-0 flex animate-fade items-center justify-center bg-navy/40 p-6">
      <div className="max-h-full w-full max-w-xl animate-rise overflow-y-auto rounded-2xl border border-line bg-surface p-7 shadow-pop">
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
