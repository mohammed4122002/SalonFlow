import Link from "next/link";
import { Icon } from "./icons";
import { SalonCover, SalonLogo } from "./salon-visuals";

export type SalonCardData = {
  slug: string;
  name: string;
  city: string | null;
  description: string | null;
  coverUrl: string | null;
  logoUrl: string | null;
  services: number;
  specialists: number;
};

export function SalonCard({ salon, priority = false }: { salon: SalonCardData; priority?: boolean }) {
  return (
    <Link
      href={`/salons/${salon.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-3xl border border-line/80 bg-surface shadow-soft transition duration-500 hover:-translate-y-1.5 hover:shadow-lift"
    >
      <div className="relative h-44 overflow-hidden">
        <SalonCover
          src={salon.coverUrl}
          name={salon.name}
          sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
          priority={priority}
          className="transition duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/0 to-black/0" />
        {salon.city && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-ink backdrop-blur">
            <Icon name="pin" className="size-3.5 text-brand-600" />
            {salon.city}
          </span>
        )}
      </div>
      <div className="relative flex flex-1 flex-col px-5 pb-5">
        <div className="-mt-8 flex items-end gap-3">
          <SalonLogo src={salon.logoUrl} name={salon.name} className="size-16 text-2xl" />
          <h3 className="pb-1 font-display text-xl font-bold leading-tight transition group-hover:text-brand-700">{salon.name}</h3>
        </div>
        {salon.description && <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted">{salon.description}</p>}
        <div className="mt-auto flex items-center justify-between gap-2 pt-4 text-xs text-muted">
          <span>
            {salon.services} خدمة · {salon.specialists} أخصائية
          </span>
          <span className="inline-flex items-center gap-1 font-semibold text-brand-700 transition group-hover:gap-2">
            احجزي الآن
            <Icon name="arrow" className="size-4" />
          </span>
        </div>
      </div>
    </Link>
  );
}
