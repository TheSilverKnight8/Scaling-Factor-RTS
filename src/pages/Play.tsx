import { useEffect, useMemo, useRef } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { Game } from '../game/Game';
import { MatchHud } from '../game/ui/MatchHud';
import { MAPS } from '../sim/map/maps';

/** A match against an idle CPU until the real one arrives in Stage 5. */
export function Play() {
  const [params] = useSearchParams();
  const mapId = params.get('map') ?? MAPS[0].id;
  const valid = MAPS.some((m) => m.id === mapId);
  const game = useMemo(() => {
    if (!valid) return null;
    // The seed only picks start locations; a fresh one each match. Outside the simulation, so
    // Math.random is fine here (in multiplayer the host will choose it and send it to everyone).
    const seed = Math.floor(Math.random() * 0x7fffffff);
    // Until the CPU arrives (Stage 5), an idle CPU stands at another start: its Hub and three
    // Minutemen only defend themselves, so there is something to fight (Caleb, Stage 3).
    return new Game({
      mapId,
      seed,
      players: [
        { name: 'You', color: 0 },
        { name: 'CPU (idle)', color: 1, cpu: 'idle' },
      ],
    });
  }, [mapId, valid]);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!game || !canvas.current) return;
    game.attach(canvas.current);
    // Development only: lets automated checks drive the running match.
    if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__game = game;
    return () => game.detach();
  }, [game]);

  if (!game) return <Navigate to="/single" replace />;
  return (
    <div className="absolute inset-0 select-none">
      <canvas ref={canvas} className="block h-full w-full touch-none" />
      <MatchHud game={game} />
    </div>
  );
}
