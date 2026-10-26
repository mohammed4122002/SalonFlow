import Image from "next/image";

// Deterministic palette per salon so salons without photos still look distinct.
const PALETTES = [
  ["#5e1c39", "#c2477a", "#d4af7a"],
  ["#22091a", "#8a2a53", "#ee9dbb"],
  ["#3a1024", "#a83565", "#e6cb9a"],
  ["#2b1631", "#7c3a6b", "#f1e1c4"],
  ["#40142c", "#b9506f", "#d4af7a"],
];
function paletteFor(seed: string) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTES[h % PALETTES.length];
}

/** Cover photo, or an elegant generated backdrop when the salon has none. */
export function SalonCover({
  src,
  name,
  sizes,
  priority = false,
  className = "",
}: {
  src: string | null;
  name: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  if (src) {
    return (
      <Image
        src={src}
        alt={`صورة غلاف ${name}`}
        fill
        sizes={sizes}
        preload={priority}
        className={`object-cover ${className}`}
      />
    );
  }
  const [a, b, c] = paletteFor(name);
  return (
    <div
      aria-hidden
      className={`absolute inset-0 overflow-hidden ${className}`}
      style={{ background: `radial-gradient(120% 120% at 100% 0%, ${b} 0%, ${a} 55%, #12040c 100%)` }}
    >
      <div className="absolute -top-10 -left-10 size-48 rounded-full opacity-40 blur-3xl" style={{ background: c }} />
      <div className="hero-texture absolute inset-0 opacity-70" />
      <span className="absolute bottom-3 left-4 font-display text-6xl font-bold text-white/15 sm:text-7xl">{name}</span>
    </div>
  );
}

/** Round logo, or the salon's initial on a gradient. */
export function SalonLogo({
  src,
  name,
  className = "size-14 text-xl",
}: {
  src: string | null;
  name: string;
  className?: string;
}) {
  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-brand-500 to-brand-800 font-display font-bold text-white ring-4 ring-white shadow-soft ${className}`}
    >
      {src ? <Image src={src} alt={`شعار ${name}`} fill sizes="96px" className="object-cover" /> : name.charAt(0)}
    </span>
  );
}
