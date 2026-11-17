// The app's icon: a cream gear with a red chevron pointing up (production scaling up), on
// navy, in the Shop Manual colors. Same drawing as public/favicon.svg and the PNG icons in public/.

const TEETH = [0, 45, 90, 135, 180, 225, 270, 315];

export function AppMark({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden>
      <rect width="64" height="64" rx="12" fill="#002657" />
      {TEETH.map((a) => (
        <rect key={a} x="28" y="8" width="8" height="10" rx="1.5" fill="#faeeda" transform={`rotate(${a} 32 32)`} />
      ))}
      <circle cx="32" cy="32" r="17" fill="#faeeda" />
      <circle cx="32" cy="32" r="10.5" fill="#002657" />
      <path d="M24.5 36.5L32 27.5L39.5 36.5" fill="none" stroke="#fc3f3f" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
