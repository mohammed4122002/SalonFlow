import Link from "next/link";
import { Suspense, type CSSProperties } from "react";
import { Icon, type IconName } from "@/components/icons";
import { SalonCard } from "@/components/salon-card";
import { EmptyState, Skeleton, buttonStyles } from "@/components/ui";
import { mediaUrl } from "@/lib/media";
import { createClient } from "@/lib/supabase/server";

const POPULAR = ["قص وتصفيف", "كيراتين", "مكياج عروس", "هيدرافيشيال", "مانيكير جل", "رموش", "صبغة", "حواجب"];

const STEPS: { icon: IconName; title: string; text: string }[] = [
  { icon: "search", title: "اختاري صالونك", text: "تصفّحي الصالونات بالصور والأسعار، وتعرّفي على الأخصائيات وخدماتهن." },
  { icon: "calendar", title: "حدّدي الموعد", text: "اختاري الخدمة واليوم والوقت من المواعيد المتاحة فعليًا، بدون اتصالات." },
  { icon: "check", title: "تأكيد فوري", text: "يُؤكَّد حجزك مباشرة وتصلك التفاصيل، ويمكنك إلغاؤه قبل موعده بضغطة." },
];

const OWNER_FEATURES: { icon: IconName; title: string; text: string }[] = [
  { icon: "check", title: "حجوزات مؤكدة تلقائيًا", text: "بدون تعارض في المواعيد، حتى مع حجوزات متزامنة." },
  { icon: "bot", title: "بوت تلغرام ذكي", text: "يرد على العملاء ويحجز لهم على مدار الساعة، ويفهم الرسائل الصوتية." },
  { icon: "chart", title: "لوحة تحكم كاملة", text: "الخدمات والأخصائيات وساعات العمل والصور والحجوزات في مكان واحد." },
  { icon: "shield", title: "آمن ومستقل", text: "بيانات كل صالون معزولة، ومفاتيح الربط مشفّرة." },
];

export default function HomePage({ searchParams }: PageProps<"/">) {
  return (
    <main>
      <Hero />

      {/* Services marquee */}
      <section aria-label="خدمات شائعة" className="overflow-hidden border-y border-line bg-surface py-4">
        <div dir="ltr" className="flex w-max animate-marquee gap-10 whitespace-nowrap">
          {[...POPULAR, ...POPULAR, ...POPULAR, ...POPULAR].map((s, i) => (
            <span key={i} dir="rtl" className="inline-flex items-center gap-3 font-display text-lg text-brand-800/80">
              <Icon name="sparkles" className="size-4 text-gold-400" />
              {s}
            </span>
          ))}
        </div>
      </section>

      <section id="salons" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16">
        <div data-reveal className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-brand-600">الصالونات</p>
            <h2 className="mt-1 font-display text-3xl font-bold sm:text-4xl">اكتشفي صالونك المفضّل</h2>
          </div>
          <SearchForm searchParams={searchParams} />
        </div>
        <Suspense fallback={<SalonGridSkeleton />}>
          <SalonGrid searchParams={searchParams} />
        </Suspense>
      </section>

      <section className="bg-gradient-to-b from-canvas to-brand-50/60 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <div data-reveal className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold text-brand-600">كيف يعمل</p>
            <h2 className="mt-1 font-display text-3xl font-bold sm:text-4xl">موعدك في ثلاث خطوات</h2>
          </div>
          <ol className="mt-10 grid gap-5 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <li
                key={step.title}
                data-reveal
                style={{ "--reveal-delay": `${i * 120}ms` } as CSSProperties}
                className="relative rounded-3xl border border-line/80 bg-surface p-6 shadow-soft"
              >
                <span className="absolute left-5 top-4 font-display text-5xl font-bold text-brand-100">{i + 1}</span>
                <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-soft">
                  <Icon name={step.icon} className="size-6" />
                </span>
                <h3 className="mt-4 font-display text-xl font-bold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <OwnersSection />
    </main>
  );
}

function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-brand-950 text-white">
      {/* Animated backdrop */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute -right-24 -top-24 size-[28rem] animate-blob rounded-full bg-brand-600/50 blur-3xl" />
        <div className="absolute -bottom-32 left-10 size-[26rem] animate-blob rounded-full bg-gold-400/25 blur-3xl [animation-delay:-6s]" />
        <div className="absolute left-1/3 top-10 size-72 animate-blob rounded-full bg-brand-400/30 blur-3xl [animation-delay:-12s]" />
        <div className="hero-texture absolute inset-0" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-brand-950 to-transparent" />
      </div>

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:py-24 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="inline-flex animate-fade-up items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-gold-200 backdrop-blur">
            <span className="size-2 animate-pulse-ring rounded-full bg-gold-400" />
            منصة الحجز الأذكى للصالونات
          </p>
          <h1 className="mt-5 animate-fade-up font-display text-4xl font-bold leading-[1.25] [animation-delay:120ms] sm:text-6xl">
            جمالك يبدأ <span className="text-shine">بموعد</span>
            <br />
            في أقل من دقيقة
          </h1>
          <p className="mt-5 max-w-xl animate-fade-up text-base leading-relaxed text-brand-100/85 [animation-delay:240ms] sm:text-lg">
            تصفّحي أفضل الصالونات بالصور والأسعار، واختاري الأخصائية والوقت المناسب، واحصلي على تأكيد فوري، من الموقع أو من بوت
            تلغرام.
          </p>
          <form action="/#salons" className="mt-8 flex max-w-xl animate-fade-up gap-2 [animation-delay:360ms]" role="search">
            <label className="relative flex-1">
              <span className="sr-only">بحث عن صالون</span>
              <Icon name="search" className="pointer-events-none absolute right-3.5 top-1/2 size-5 -translate-y-1/2 text-brand-200/70" />
              <input
                name="q"
                type="search"
                placeholder="ابحثي باسم الصالون أو المدينة"
                className="w-full rounded-2xl border border-white/15 bg-white/10 py-3.5 pl-4 pr-11 text-sm text-white placeholder:text-brand-100/60 backdrop-blur focus:border-gold-300 focus:outline-none focus:ring-2 focus:ring-gold-300/40"
              />
            </label>
            <button
              type="submit"
              className="rounded-2xl bg-gradient-to-l from-gold-300 to-gold-400 px-6 text-sm font-bold text-brand-950 shadow-lift transition hover:brightness-105"
            >
              ابحثي
            </button>
          </form>
          <div className="mt-5 flex max-w-xl animate-fade-up flex-wrap gap-2 [animation-delay:480ms]">
            {POPULAR.slice(0, 5).map((s) => (
              <span key={s} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-brand-100/80">
                {s}
              </span>
            ))}
          </div>
          <Suspense fallback={<div className="mt-10 h-16" />}>
            <HeroStats />
          </Suspense>
        </div>

        <HeroVisual />
      </div>
    </section>
  );
}

// Floating mock-ups illustrating the booking flow.
function HeroVisual() {
  return (
    <div aria-hidden className="relative mx-auto hidden h-[26rem] w-full max-w-md select-none lg:block">
      <div className="absolute inset-6 rounded-[2.5rem] border border-white/10 bg-gradient-to-br from-white/10 to-white/0 backdrop-blur-sm" />

      <div className="absolute right-0 top-4 w-64 animate-float rounded-3xl bg-white p-4 text-ink shadow-lift [--tilt:-3deg]">
        <p className="text-xs text-muted">اختاري الوقت</p>
        <p className="mt-1 font-display text-lg font-bold">الخميس 30/10</p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm ltr">
          {["10:00", "10:30", "11:00", "12:30", "16:00", "17:30"].map((t, i) => (
            <span
              key={t}
              className={`rounded-xl border px-2 py-1.5 ${i === 4 ? "border-brand-600 bg-brand-600 text-white" : "border-line"}`}
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="absolute bottom-16 left-0 w-60 animate-float-slow rounded-3xl bg-white p-4 text-ink shadow-lift [--tilt:4deg] [animation-delay:-3s]">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-emerald-100 text-emerald-700">
            <Icon name="check" className="size-5" />
          </span>
          <div>
            <p className="font-bold">تم تأكيد حجزك</p>
            <p className="text-xs text-muted">هيدرافيشيال · ميار · 16:00</p>
          </div>
        </div>
      </div>

      <div className="absolute bottom-2 right-10 w-56 animate-float rounded-3xl rounded-br-md bg-gradient-to-br from-brand-600 to-brand-800 p-3.5 text-sm text-white shadow-lift [animation-delay:-5s]">
        <p className="flex items-center gap-1.5 text-xs text-brand-100">
          <Icon name="mic" className="size-3.5" />
          رسالة صوتية · بوت الصالون
        </p>
        <p className="mt-1">«بدي موعد مكياج سهرة بكرة العصر»</p>
      </div>

      <div className="absolute left-8 top-10 grid size-16 animate-float-slow place-items-center rounded-2xl bg-gold-300 text-brand-950 shadow-lift [--tilt:-8deg]">
        <Icon name="sparkles" className="size-8" />
      </div>
    </div>
  );
}

async function HeroStats() {
  const supabase = await createClient();
  const [salons, services, specialists] = await Promise.all([
    supabase.from("salons").select("id", { count: "exact", head: true }).eq("is_published", true).eq("status", "active"),
    supabase.from("services").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("specialists").select("id", { count: "exact", head: true }).eq("is_active", true),
  ]);
  const stats = [
    { value: salons.count ?? 0, label: "صالون" },
    { value: services.count ?? 0, label: "خدمة" },
    { value: specialists.count ?? 0, label: "أخصائية" },
    { value: "24/7", label: "حجز متاح" },
  ];
  return (
    <dl className="mt-10 grid max-w-xl animate-fade-up grid-cols-4 gap-3 [animation-delay:600ms]">
      {stats.map((s) => (
        <div
          key={s.label}
          className="flex flex-col-reverse rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-center backdrop-blur"
        >
          <dt className="text-xs text-brand-100/70">{s.label}</dt>
          <dd className="font-display text-2xl font-bold text-gold-200">{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function OwnersSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <div className="relative isolate overflow-hidden rounded-[2rem] bg-brand-950 px-6 py-12 text-white shadow-lift sm:px-12">
        <div aria-hidden className="absolute inset-0 -z-10">
          <div className="absolute -left-20 -top-20 size-80 animate-blob rounded-full bg-brand-600/40 blur-3xl" />
          <div className="absolute -bottom-24 right-0 size-80 animate-blob rounded-full bg-gold-400/20 blur-3xl [animation-delay:-8s]" />
          <div className="hero-texture absolute inset-0" />
        </div>
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div data-reveal>
            <p className="text-sm font-semibold text-gold-300">لأصحاب الصالونات</p>
            <h2 className="mt-2 font-display text-3xl font-bold leading-snug sm:text-4xl">
              صالونك يستقبل الحجوزات
              <br />
              <span className="text-shine">وأنتِ مرتاحة</span>
            </h2>
            <p className="mt-4 max-w-md text-brand-100/80">
              أنشئي صفحة صالونك خلال دقائق، وأضيفي الخدمات والأخصائيات والصور، ودعي العملاء يحجزون من الموقع أو بوت تلغرام.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="rounded-2xl bg-gradient-to-l from-gold-300 to-gold-400 px-6 py-3 text-sm font-bold text-brand-950 shadow-lift transition hover:brightness-105"
              >
                ابدئي تجربة مجانية 30 يومًا
              </Link>
              <Link
                href="/login"
                className="rounded-2xl border border-white/20 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                دخول صاحب الصالون
              </Link>
            </div>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {OWNER_FEATURES.map((f, i) => (
              <li
                key={f.title}
                data-reveal
                style={{ "--reveal-delay": `${i * 100}ms` } as CSSProperties}
                className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur transition hover:border-gold-300/40 hover:bg-white/10"
              >
                <span className="grid size-10 place-items-center rounded-xl bg-gold-300/15 text-gold-300">
                  <Icon name={f.icon} className="size-5" />
                </span>
                <h3 className="mt-3 font-bold">{f.title}</h3>
                <p className="mt-1 text-sm text-brand-100/70">{f.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

// Characters with meaning in PostgREST filter syntax are stripped from the query.
function cleanQuery(value: string | string[] | undefined): string {
  const q = typeof value === "string" ? value : "";
  return q.replace(/[%,()*\\:"']/g, " ").trim().slice(0, 60);
}

function SearchForm({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  return (
    <Suspense fallback={null}>
      <SearchFormInner searchParams={searchParams} />
    </Suspense>
  );
}

async function SearchFormInner({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const q = cleanQuery((await searchParams).q);
  if (!q) return null;
  return (
    <p className="flex items-center gap-2 text-sm text-muted">
      نتائج البحث عن «{q}»
      <Link href="/#salons" className={buttonStyles.ghost}>
        مسح
      </Link>
    </p>
  );
}

async function SalonGrid({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const q = cleanQuery((await searchParams).q);
  const supabase = await createClient();

  // RLS: anonymous visitors only see published, active salons. Signed-in owners
  // would also see their own drafts, so filter explicitly for the public list.
  let query = supabase
    .from("salons")
    .select("id, slug, name, city, description, logo_path, cover_path, services(count), specialists(count)")
    .eq("is_published", true)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(60);
  if (q) query = query.or(`name.ilike.%${q}%,city.ilike.%${q}%`);

  const { data: salons, error } = await query;
  if (error) throw error;

  if (!salons.length) {
    return q ? (
      <EmptyState
        title="لا توجد نتائج"
        description={`لم نجد صالونات تطابق «${q}».`}
        action={
          <Link href="/#salons" className={buttonStyles.secondary}>
            عرض كل الصالونات
          </Link>
        }
      />
    ) : (
      <EmptyState title="لا توجد صالونات منشورة بعد" description="عودي قريبًا، أو سجّلي صالونك الآن." />
    );
  }

  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {salons.map((salon, i) => (
        <li key={salon.id} data-reveal style={{ "--reveal-delay": `${(i % 3) * 100}ms` } as CSSProperties}>
          <SalonCard
            priority={i < 3}
            salon={{
              slug: salon.slug,
              name: salon.name,
              city: salon.city,
              description: salon.description,
              coverUrl: mediaUrl(salon.cover_path),
              logoUrl: mediaUrl(salon.logo_path),
              services: salon.services[0]?.count ?? 0,
              specialists: salon.specialists[0]?.count ?? 0,
            }}
          />
        </li>
      ))}
    </ul>
  );
}

function SalonGridSkeleton() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-80 rounded-3xl" />
      ))}
    </div>
  );
}
