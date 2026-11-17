import { useState } from 'react';
import { useNavigate } from 'react-router';
import { BookOpen, Map as MapIcon } from 'lucide-react';
import { Button, Card, StageTag, cx } from '../components/ui';
import { MAPS } from '../sim/map/maps';

export function SinglePlayer() {
  const [mapId, setMapId] = useState(MAPS[0].id);
  const navigate = useNavigate();

  return (
    <div className="animate-rise space-y-10">
      <section>
        <p className="label-caps text-accent">Single-player</p>
        <h1 className="mt-1 text-5xl">Match vs CPU</h1>
        <p className="mt-3 max-w-2xl text-muted">Pick a map. Your Hub starts at a random start location.</p>
      </section>

      <section>
        <h2 className="text-2xl">Map</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {MAPS.map((m) => (
            <button
              key={m.id}
              onClick={() => setMapId(m.id)}
              className={cx('rounded-2xl border bg-surface p-5 text-left shadow-card transition', mapId === m.id ? 'border-accent ring-2 ring-accent/30' : 'border-line hover:bg-raised')}
            >
              <MapIcon className="size-6 text-accent" />
              <div className="mt-3 font-display text-xl uppercase">{m.name}</div>
              <p className="mt-1 text-sm text-muted">{m.blurb}</p>
            </button>
          ))}
          {[2, 3].map((n) => (
            <div key={n} className="rounded-2xl border border-dashed border-line p-5 text-muted">
              <MapIcon className="size-6" />
              <div className="mt-3 flex items-center gap-2 font-display text-xl uppercase">
                Map {n} <StageTag stage={5} />
              </div>
              <p className="mt-1 text-sm">Not built yet.</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="flex items-center gap-2 text-2xl">
          CPU opponent <StageTag stage={5} />
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">The CPU (Easy, Normal, Hard) comes in Stage 5. Until then a match has only you, so you can try the map, the camera, fog, moving units and placing structures.</p>
      </section>

      <div className="flex flex-wrap gap-3">
        <Button variant="primary" size="lg" onClick={() => navigate(`/play?map=${mapId}`)}>
          Start match
        </Button>
      </div>

      <Card className="flex items-start gap-4 p-6 opacity-70">
        <BookOpen className="mt-1 size-6 text-muted" />
        <div>
          <h2 className="flex items-center gap-2 text-2xl">
            Story mode <StageTag stage={7} />
          </h2>
          <p className="mt-1 text-sm text-muted">The tutorial and challenge levels with Perceval and Palamedes. Not built yet.</p>
        </div>
      </Card>
    </div>
  );
}
