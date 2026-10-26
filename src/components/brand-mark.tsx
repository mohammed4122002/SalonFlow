// Brand logo mark: a faceted gem, echoing beauty and precision.
export function BrandMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <defs>
        <linearGradient id="bm-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c2477a" />
          <stop offset="1" stopColor="#5e1c39" />
        </linearGradient>
        <linearGradient id="bm-gem" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f1e1c4" />
          <stop offset="1" stopColor="#d4af7a" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="12" fill="url(#bm-bg)" />
      <path d="M12 16l4-5h8l4 5-8 13z" fill="url(#bm-gem)" />
      <path d="M12 16h16M16 11l4 5 4-5M20 16v13" stroke="#8a2a53" strokeOpacity=".35" strokeWidth="1" fill="none" />
    </svg>
  );
}
