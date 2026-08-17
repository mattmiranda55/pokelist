export function Pokeball({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id="pb-red" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff6b6b" />
          <stop offset="1" stopColor="var(--primary-deep)" />
        </linearGradient>
        <linearGradient id="pb-dark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--surface-elevated)" />
          <stop offset="1" stopColor="var(--bg)" />
        </linearGradient>
      </defs>
      <circle
        cx="32"
        cy="32"
        r="29"
        fill="url(#pb-dark)"
        stroke="var(--border-strong)"
        strokeWidth="2"
      />
      <path d="M 3 32 A 29 29 0 0 1 61 32 Z" fill="url(#pb-red)" />
      <rect x="3" y="29" width="58" height="6" fill="var(--bg)" />
      <circle
        cx="32"
        cy="32"
        r="8.5"
        fill="var(--bg)"
        stroke="var(--border-strong)"
        strokeWidth="2"
      />
      <circle cx="32" cy="32" r="4" fill="var(--text)" />
    </svg>
  );
}
