import { Settings, Swords, Users } from 'lucide-react';
import { ButtonLink, Card, StageTag } from '../components/ui';

export function Home() {
  return (
    <div className="animate-rise space-y-12">
      <section>
        <p className="label-caps text-accent">An automation RTS</p>
        <h1 className="mt-1 text-6xl">Scaling Factor</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted">
          Build an automated war machine. Gather resources, process them into materials, and set up structures that turn materials into units on their own, while your units fight for you.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Card className="flex flex-col gap-4 p-6">
          <Swords className="size-7 text-accent" />
          <div>
            <h2 className="text-2xl">Single-player</h2>
            <p className="mt-1 text-sm text-muted">A match against the CPU, or story mode.</p>
          </div>
          <ButtonLink to="/single" variant="primary" className="mt-auto">
            Play
          </ButtonLink>
        </Card>
        <Card className="flex flex-col gap-4 p-6 opacity-70">
          <Users className="size-7 text-muted" />
          <div>
            <h2 className="flex items-center gap-2 text-2xl">
              Multiplayer <StageTag stage={6} />
            </h2>
            <p className="mt-1 text-sm text-muted">2 to 4 players, joining by room code.</p>
          </div>
          <span className="mt-auto text-sm text-muted">Not built yet.</span>
        </Card>
        <Card className="flex flex-col gap-4 p-6 opacity-70">
          <Settings className="size-7 text-muted" />
          <div>
            <h2 className="flex items-center gap-2 text-2xl">
              Settings <StageTag stage={8} />
            </h2>
            <p className="mt-1 text-sm text-muted">Music and sound volume.</p>
          </div>
          <span className="mt-auto text-sm text-muted">Not built yet.</span>
        </Card>
      </section>
    </div>
  );
}
