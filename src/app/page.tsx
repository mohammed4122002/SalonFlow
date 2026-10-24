import Link from "next/link";
import { Suspense } from "react";
import { EmptyState, Skeleton, buttonStyles, inputStyles } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

export default function HomePage({ searchParams }: PageProps<"/">) {
  return (
    <main>
      <section className="bg-gradient-to-b from-brand-50 to-canvas">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
          <h1 className="max-w-2xl text-3xl font-bold leading-tight text-ink sm:text-5xl">
            احجزي موعدك في صالونك المفضّل بسهولة
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted sm:text-lg">
            تصفّحي الصالونات، وقارني الخدمات والأسعار، وتعرّفي على الأخصائيات قبل الحجز.
          </p>
          <form action="/" className="mt-8 flex max-w-xl gap-2" role="search">
            <input
              name="q"
              type="search"
              placeholder="ابحثي باسم الصالون أو المدينة"
              aria-label="بحث عن صالون"
              className={inputStyles}
            />
            <button type="submit" className={buttonStyles.primary}>
              بحث
            </button>
          </form>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="mb-5 text-xl font-bold">الصالونات</h2>
        <Suspense fallback={<SalonGridSkeleton />}>
          <SalonGrid searchParams={searchParams} />
        </Suspense>
      </section>
    </main>
  );
}

// Characters with meaning in PostgREST filter syntax are stripped from the query.
function cleanQuery(value: string | string[] | undefined): string {
  const q = typeof value === "string" ? value : "";
  return q.replace(/[%,()*\\:"']/g, " ").trim().slice(0, 60);
}

async function SalonGrid({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const q = cleanQuery((await searchParams).q);
  const supabase = await createClient();

  // RLS: anonymous visitors only see published, active salons. Signed-in owners
  // would also see their own drafts, so filter explicitly for the public list.
  let query = supabase
    .from("salons")
    .select("id, slug, name, city, description, services(count), specialists(count)")
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
          <Link href="/" className={buttonStyles.secondary}>
            عرض كل الصالونات
          </Link>
        }
      />
    ) : (
      <EmptyState title="لا توجد صالونات منشورة بعد" description="عودي قريبًا، أو سجّلي صالونك الآن." />
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {salons.map((salon) => (
        <li key={salon.id}>
          <Link
            href={`/salons/${salon.slug}`}
            className="group flex h-full flex-col rounded-2xl border border-line bg-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-100 text-lg font-bold text-brand-700"
              >
                {salon.name.charAt(0)}
              </span>
              <div className="min-w-0">
                <h3 className="truncate font-bold group-hover:text-brand-700">{salon.name}</h3>
                {salon.city && <p className="text-sm text-muted">{salon.city}</p>}
              </div>
            </div>
            {salon.description && <p className="mt-3 line-clamp-2 text-sm text-muted">{salon.description}</p>}
            <p className="mt-auto pt-4 text-xs text-muted">
              {salon.services[0]?.count ?? 0} خدمة · {salon.specialists[0]?.count ?? 0} أخصائية
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function SalonGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-36" />
      ))}
    </div>
  );
}
