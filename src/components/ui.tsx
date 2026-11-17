import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { twMerge } from 'tailwind-merge';

/** Joins class names. When two classes set the same thing (h-11 and h-9), the later one wins. */
export function cx(...parts: (string | false | null | undefined)[]) {
  return twMerge(parts.filter(Boolean).join(' '));
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'navy';
type Size = 'xs' | 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent hover:brightness-105 active:brightness-95',
  navy: 'bg-navy text-on-accent hover:brightness-110 active:brightness-95',
  secondary: 'bg-surface text-ink border border-line hover:bg-raised active:bg-raised',
  ghost: 'text-ink hover:bg-raised active:bg-raised',
  danger: 'bg-danger/10 text-danger border border-danger/30 hover:bg-danger/15',
};
const sizes: Record<Size, string> = {
  xs: 'h-7 px-2 text-[0.8125rem] gap-1 rounded-lg',
  sm: 'h-9 px-3 text-[0.9375rem] gap-1.5 rounded-lg',
  md: 'h-11 px-4 text-base gap-2 rounded-xl',
  lg: 'h-13 px-5 text-lg gap-2 rounded-xl',
};

export function buttonClass(variant: Variant = 'secondary', size: Size = 'md', className?: string) {
  return cx(
    // Norwester capitals, like the Shop Manual's buttons.
    'inline-flex shrink-0 items-center justify-center whitespace-nowrap font-display uppercase tracking-[0.06em] leading-none transition select-none disabled:pointer-events-none disabled:opacity-50',
    variants[variant],
    sizes[size],
    className,
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant, size, className, children, type = 'button', ...rest }, ref) {
  return (
    <button ref={ref} type={type} className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </button>
  );
});

export function ButtonLink({ variant, size, className, ...rest }: LinkProps & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}

export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('rounded-2xl border border-line bg-surface shadow-card', className)} {...rest}>
      {children}
    </div>
  );
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return <kbd className={cx('rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[0.6875rem] leading-none text-muted', className)}>{children}</kbd>;
}

/** A small tag saying which build stage brings something that is not built yet. */
export function StageTag({ stage }: { stage: number }) {
  return <span className="rounded-full border border-line bg-raised px-2 py-0.5 text-[0.6875rem] font-medium normal-case tracking-normal text-muted">Stage {stage}</span>;
}
