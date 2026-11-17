import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router';
import { AppMark } from '../graphics/AppMark';
import { CroswellLogo, CroswellMark } from '../graphics/Logo';
import { APP_NAME } from '../config';
import { cx } from './ui';

const navClass = ({ isActive }: { isActive: boolean }) =>
  cx('flex items-center gap-2 rounded-xl px-3 py-1.5 font-display text-[1.0625rem] uppercase tracking-[0.05em] transition', isActive ? 'bg-accent text-on-accent' : 'text-ink hover:bg-raised');

/**
 * The frame around every screen, in the Engineering Management Portal's style. Menu screens
 * are pages: stripes at the top and bottom, with the full Croswell Industries logo beside the
 * bottom stripes on Home and the C mark everywhere else. A match fills the screen and keeps a
 * slim stripe with the C mark at the bottom.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const inMatch = pathname.startsWith('/play');
  const isHome = pathname === '/';

  if (inMatch) {
    return (
      <div className="flex h-dvh flex-col overflow-hidden">
        <main className="relative min-h-0 flex-1 overflow-hidden">{children}</main>
        <footer className="relative shrink-0 border-t border-line bg-bg py-1.5">
          <div className="stripes stripes-br stripes-sm" aria-hidden />
          <div className="absolute inset-y-0 left-0 flex w-[23%] items-center justify-start pl-4">
            <CroswellMark className="h-5 text-ink" />
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="z-30 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-4">
        <NavLink to="/" className="mr-3 flex items-center gap-2.5">
          <AppMark size={32} />
          <span className="font-display text-xl uppercase leading-none tracking-wide">{APP_NAME}</span>
        </NavLink>
        <nav className="flex min-w-0 items-center gap-1">
          <NavLink to="/" end className={navClass}>
            Home
          </NavLink>
          <NavLink to="/single" className={navClass}>
            Single-player
          </NavLink>
        </nav>
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="stripes stripes-tl mt-5 shrink-0" aria-hidden />
        <main className="mx-auto w-full max-w-5xl flex-1 px-6 pb-14 pt-8 lg:px-10">{children}</main>
        <footer className="mb-5 shrink-0">
          <div className="relative">
            <div className="stripes stripes-br" aria-hidden />
            {/* The logo sits in the gap left of the bars (the longest bar reaches 77% of the way). */}
            <div className={cx('absolute inset-y-0 left-0 flex w-[23%] items-center', isHome ? 'justify-center' : 'justify-start pl-6 lg:pl-10')}>
              {isHome ? <CroswellLogo className="w-[85%] max-w-[15rem] text-ink" /> : <CroswellMark className="h-9 text-ink lg:h-11" />}
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
