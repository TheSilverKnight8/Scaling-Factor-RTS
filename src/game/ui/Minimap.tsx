import { useEffect, useRef } from 'react';
import type { Game } from '../Game';

/** The minimap panel. The game draws it each frame; clicking or dragging on it moves the camera. */
export function Minimap({ game }: { game: Game }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    game.attachMinimap(c);
    return () => game.attachMinimap(null);
  }, [game]);

  const look = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    game.lookAtMinimap(e.clientX - r.left, e.clientY - r.top, r.width, r.height);
  };

  return (
    <div className="pointer-events-auto overflow-hidden rounded-2xl border border-line bg-surface/95 p-2 shadow-pop backdrop-blur">
      <canvas
        ref={ref}
        className="block h-[8.75rem] w-[17.5rem] cursor-pointer touch-none"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          look(e);
        }}
        onPointerMove={(e) => {
          if (e.buttons & 1) look(e);
        }}
        onContextMenu={(e) => e.preventDefault()}
        aria-label="Minimap: click to move the camera there"
      />
    </div>
  );
}
