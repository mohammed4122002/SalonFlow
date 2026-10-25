import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Badge, Card, Skeleton } from "@/components/ui";
import { DAY_NAMES, formatDuration, formatPrice, formatTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { subscriptionValid } from "@/lib/subscription";
import { BookingWidget } from "./booking-widget";

export default function SalonPage({ params }: PageProps<"/salons/[slug]">) {
  return (
    <Suspense fallback={<SalonSkeleton />}>
      <SalonDetails params={params} />
    </Suspense>
  );
}

async function SalonDetails({ params }: { params: PageProps<"/salons/[slug]">["params"] }) {
  const { slug } = await params;
  const supabase = await createClient();

  // RLS returns the salon only if it is public, or owned by / managed by the viewer.
  const { data: salon } = await supabase.from("salons").select("*").eq("slug", slug).maybeSingle();
  if (!salon) notFound();

  const [{ data: services }, { data: specialists }, { data: hours }] = await Promise.all([
    supabase
      .from("services")
      .select("id, name, description, duration_minutes, price")
      .eq("salon_id", salon.id)
      .eq("is_active", true)
      .order("sort_order")
      .order("name"),
    supabase
      .from("specialists")
      .select("id, full_name, bio, specialist_services(service_id)")
      .eq("salon_id", salon.id)
      .eq("is_active", true)
      .order("sort_order")
      .order("full_name"),
    supabase
      .from("working_hours")
      .select("day_of_week, start_time, end_time")
      .eq("salon_id", salon.id)
      .is("specialist_id", null)
      .order("day_of_week")
      .order("start_time"),
  ]);

  const serviceNames = new Map((services ?? []).map((s) => [s.id, s.name]));
  // Visitors only ever receive public salons (RLS). For the owner's preview,
  // the subscription decides whether the salon is actually live.
  await connection();
  const { data: auth } = await supabase.auth.getClaims();
  const { data: sub } = auth?.claims
    ? await supabase
        .from("subscriptions")
        .select("status, trial_ends_at, current_period_end")
        .eq("salon_id", salon.id)
        .maybeSingle()
    : { data: null };
  const now = new Date();
  const isPublic = salon.is_published && salon.status === "active" && (!sub || subscriptionValid(sub, now));

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      {!isPublic && (
        <p className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          معاينة: هذا الصالون غير ظاهر للزوار حاليًا (
          {salon.status === "suspended" ? "معلّق" : !salon.is_published ? "غير منشور" : "انتهى الاشتراك"}).
        </p>
      )}

      <header className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <span
          aria-hidden
          className="grid size-20 shrink-0 place-items-center rounded-3xl bg-brand-100 text-3xl font-bold text-brand-700"
        >
          {salon.name.charAt(0)}
        </span>
        <div>
          <h1 className="text-3xl font-bold">{salon.name}</h1>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
            {salon.city && <span>{salon.city}</span>}
            {salon.address && <span>{salon.address}</span>}
            {salon.phone && (
              <a href={`tel:${salon.phone.replace(/\s/g, "")}`} className="ltr hover:text-brand-700">
                {salon.phone}
              </a>
            )}
          </p>
          {salon.description && <p className="mt-3 max-w-2xl text-muted">{salon.description}</p>}
        </div>
      </header>

      <div className="mt-10 grid gap-8 lg:grid-cols-3">
        <section className="lg:col-span-2" aria-labelledby="services-heading">
          <h2 id="services-heading" className="mb-4 text-xl font-bold">
            الخدمات والأسعار
          </h2>
          {services?.length ? (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {services.map((service) => (
                <li key={service.id} className="flex items-start justify-between gap-4 p-4">
                  <div>
                    <p className="font-semibold">{service.name}</p>
                    {service.description && <p className="mt-0.5 text-sm text-muted">{service.description}</p>}
                    <p className="mt-1 text-xs text-muted">{formatDuration(service.duration_minutes)}</p>
                  </div>
                  <p className="shrink-0 font-bold text-brand-700">{formatPrice(service.price, salon.currency)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">لم تُضف خدمات بعد.</p>
          )}

          <h2 className="mb-4 mt-10 text-xl font-bold">الأخصائيات</h2>
          {specialists?.length ? (
            <ul className="grid gap-4 sm:grid-cols-2">
              {specialists.map((sp) => (
                <li key={sp.id}>
                  <Card className="h-full">
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden
                        className="grid size-11 place-items-center rounded-full bg-brand-50 font-bold text-brand-700"
                      >
                        {sp.full_name.charAt(0)}
                      </span>
                      <p className="font-semibold">{sp.full_name}</p>
                    </div>
                    {sp.bio && <p className="mt-3 text-sm text-muted">{sp.bio}</p>}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {sp.specialist_services
                        .map((link) => serviceNames.get(link.service_id))
                        .filter((name): name is string => Boolean(name))
                        .map((name) => (
                          <Badge key={name} tone="brand">
                            {name}
                          </Badge>
                        ))}
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">لم تُضف أخصائيات بعد.</p>
          )}
        </section>

        <aside className="space-y-4">
          <Card>
            <h2 className="mb-3 font-bold">ساعات العمل</h2>
            <dl className="space-y-2 text-sm">
              {DAY_NAMES.map((day, i) => {
                const slots = (hours ?? []).filter((h) => h.day_of_week === i);
                return (
                  <div key={day} className="flex justify-between gap-3">
                    <dt className="text-muted">{day}</dt>
                    <dd className="flex flex-col items-end gap-0.5">
                      {slots.length ? (
                        slots.map((s) => (
                          <span key={s.start_time} className="ltr">
                            {formatTime(s.start_time)}–{formatTime(s.end_time)}
                          </span>
                        ))
                      ) : (
                        <span className="text-muted">مغلق</span>
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </Card>
          <Card id="book" className="border-brand-200">
            <h2 className="mb-4 text-lg font-bold">احجزي موعدك</h2>
            {isPublic ? (
              <BookingWidget
                salonId={salon.id}
                timezone={salon.timezone}
                nowMs={now.getTime()}
                currency={salon.currency}
                services={services ?? []}
                specialists={(specialists ?? []).map((sp) => ({
                  id: sp.id,
                  full_name: sp.full_name,
                  serviceIds: sp.specialist_services.map((l) => l.service_id),
                }))}
              />
            ) : (
              <p className="text-sm text-muted">الحجز غير متاح لأن الصالون غير ظاهر للزوار حاليًا.</p>
            )}
          </Card>
        </aside>
      </div>
    </main>
  );
}

function SalonSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-12">
      <Skeleton className="h-24" />
      <div className="grid gap-8 lg:grid-cols-3">
        <Skeleton className="h-96 lg:col-span-2" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}
