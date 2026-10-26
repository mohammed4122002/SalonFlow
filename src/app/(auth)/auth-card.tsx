import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";

const PERKS: { icon: IconName; text: string }[] = [
  { icon: "check", text: "حجوزات مؤكدة تلقائيًا بدون تعارض" },
  { icon: "bot", text: "بوت تلغرام ذكي يحجز عنك على مدار الساعة" },
  { icon: "sparkles", text: "صفحة أنيقة لصالونك بالصور والأسعار" },
];

export function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <main className="mx-auto grid max-w-5xl gap-8 px-4 py-10 sm:py-14 lg:grid-cols-2 lg:items-stretch">
      <aside className="relative isolate hidden overflow-hidden rounded-[2rem] bg-brand-950 p-10 text-white shadow-lift lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden className="absolute inset-0 -z-10">
          <div className="absolute -right-16 -top-16 size-72 animate-blob rounded-full bg-brand-600/50 blur-3xl" />
          <div className="absolute -bottom-20 -left-10 size-72 animate-blob rounded-full bg-gold-400/25 blur-3xl [animation-delay:-7s]" />
          <div className="hero-texture absolute inset-0" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gold-300">SalonFlow</p>
          <h2 className="mt-3 font-display text-3xl font-bold leading-snug">
            إدارة صالونك
            <br />
            <span className="text-shine">بأناقة وسهولة</span>
          </h2>
        </div>
        <ul className="space-y-4">
          {PERKS.map((p) => (
            <li key={p.text} className="flex items-center gap-3 text-sm text-brand-100/85">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/10 text-gold-300">
                <Icon name={p.icon} className="size-5" />
              </span>
              {p.text}
            </li>
          ))}
        </ul>
      </aside>
      <div className="animate-fade-up self-center rounded-[2rem] border border-line/80 bg-surface p-6 shadow-lift sm:p-10">
        <h1 className="font-display text-3xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-muted">{subtitle}</p>
        <div className="mt-7">{children}</div>
      </div>
    </main>
  );
}
