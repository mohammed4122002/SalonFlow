import Image from "next/image";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { SalonCover, SalonLogo } from "@/components/salon-visuals";
import { Badge, Card, Skeleton } from "@/components/ui";
import { DAY_NAMES, formatDuration, formatPrice, formatTime } from "@/lib/format";
import { mediaUrl } from "@/lib/media";
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

  const [{ data: services }, { data: specialists }, { data: hours }, { data: photos }] = await Promise.all([
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
    supabase.from("salon_photos").select("id, path").eq("salon_id", salon.id).order("sort_order").order("created_at"),
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

  const coverUrl = mediaUrl(salon.cover_path);
  const logoUrl = mediaUrl(salon.logo_path);
  const gallery = (photos ?? []).map((p) => ({ id: p.id, url: mediaUrl(p.path)! }));

  return (
    <main>
      <section className="relative isolate overflow-hidden bg-brand-950">
        <div className="relative h-64 overflow-hidden sm:h-80 lg:h-96">
          <SalonCover src={coverUrl} name={salon.name} sizes="100vw" priority className="animate-[fade-up_1.2s_ease-out_both]" />
          <div className="absolute inset-0 bg-gradient-to-t from-brand-950 via-brand-950/40 to-black/10" />
        </div>
        <div className="relative mx-auto -mt-28 max-w-6xl px-4 pb-10 sm:-mt-32">
          {!isPublic && (
            <p className="mb-4 inline-block rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
              معاينة: هذا الصالون غير ظاهر للزوار حاليًا (
              {salon.status === "suspended" ? "معلّق" : !salon.is_published ? "غير منشور" : "انتهى الاشتراك"}).
            </p>
          )}
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
            <SalonLogo src={logoUrl} name={salon.name} className="size-24 animate-fade-up text-4xl sm:size-28" />
            <div className="animate-fade-up text-white [animation-delay:120ms]">
              <h1 className="font-display text-3xl font-bold sm:text-5xl">{salon.name}</h1>
              <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-brand-100/85">
                {(salon.city || salon.address) && (
                  <span className="inline-flex items-center gap-1">
                    <Icon name="pin" className="size-4 text-gold-300" />
                    {[salon.city, salon.address].filter(Boolean).join("، ")}
                  </span>
                )}
                {salon.phone && (
                  <a href={`tel:${salon.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1 hover:text-gold-200">
                    <Icon name="phone" className="size-4 text-gold-300" />
                    <span className="ltr">{salon.phone}</span>
                  </a>
                )}
              </p>
            </div>
            {isPublic && (
              <a
                href="#book"
                className="animate-fade-up rounded-2xl bg-gradient-to-l from-gold-300 to-gold-400 px-6 py-3 text-center text-sm font-bold text-brand-950 shadow-lift transition [animation-delay:240ms] hover:brightness-105 sm:mr-auto"
              >
                احجزي موعدك
              </a>
            )}
          </div>
          {salon.description && (
            <p className="mt-5 max-w-3xl animate-fade-up leading-relaxed text-brand-100/85 [animation-delay:200ms]">
              {salon.description}
            </p>
          )}
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-3">
        <div className="space-y-12 lg:col-span-2">
          {gallery.length > 0 && (
            <section aria-labelledby="gallery-heading" data-reveal>
              <h2 id="gallery-heading" className="mb-4 font-display text-2xl font-bold">
                من أعمالنا
              </h2>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {gallery.map((photo, i) => (
                  <li
                    key={photo.id}
                    className={`group relative overflow-hidden rounded-2xl bg-canvas ${i === 0 ? "col-span-2 row-span-2 aspect-square sm:aspect-auto" : "aspect-square"}`}
                  >
                    <a href={photo.url} target="_blank" rel="noreferrer" className="block size-full">
                      <Image
                        src={photo.url}
                        alt={`صورة من ${salon.name}`}
                        fill
                        sizes={i === 0 ? "(min-width: 1024px) 520px, 100vw" : "(min-width: 1024px) 260px, 50vw"}
                        className="object-cover transition duration-700 group-hover:scale-105"
                      />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="services-heading" data-reveal>
            <h2 id="services-heading" className="mb-4 font-display text-2xl font-bold">
              الخدمات والأسعار
            </h2>
            {services?.length ? (
              <ul className="grid gap-3 sm:grid-cols-2">
                {services.map((service) => (
                  <li
                    key={service.id}
                    className="flex items-start justify-between gap-4 rounded-2xl border border-line/80 bg-surface p-4 shadow-soft transition hover:-translate-y-0.5 hover:border-brand-200"
                  >
                    <div>
                      <p className="font-semibold">{service.name}</p>
                      {service.description && <p className="mt-1 text-sm leading-relaxed text-muted">{service.description}</p>}
                      <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted">
                        <Icon name="clock" className="size-3.5" />
                        {formatDuration(service.duration_minutes)}
                      </p>
                    </div>
                    <p className="shrink-0 rounded-xl bg-brand-50 px-3 py-1 font-bold text-brand-700">
                      {formatPrice(service.price, salon.currency)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">لم تُضف خدمات بعد.</p>
            )}
          </section>

          <section aria-labelledby="team-heading" data-reveal>
            <h2 id="team-heading" className="mb-4 font-display text-2xl font-bold">
              فريق الأخصائيات
            </h2>
            {specialists?.length ? (
              <ul className="grid gap-4 sm:grid-cols-2">
                {specialists.map((sp) => (
                  <li key={sp.id}>
                    <Card className="h-full">
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden
                          className="grid size-12 place-items-center rounded-full bg-gradient-to-br from-brand-100 to-gold-200 font-display text-lg font-bold text-brand-800"
                        >
                          {sp.full_name.charAt(0)}
                        </span>
                        <div>
                          <p className="font-semibold">{sp.full_name}</p>
                          {sp.bio && <p className="text-sm text-muted">{sp.bio}</p>}
                        </div>
                      </div>
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
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card id="book" className="scroll-mt-24 border-brand-200 ring-1 ring-brand-100">
            <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-bold">
              <Icon name="calendar" className="size-5 text-brand-600" />
              احجزي موعدك
            </h2>
            {isPublic ? (
              <BookingWidget
                salonId={salon.id}
                timezone={salon.timezone}
                nowMs={now.getTime()}
                autoConfirm={salon.auto_confirm_bookings}
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
          <Card>
            <h2 className="mb-3 flex items-center gap-2 font-bold">
              <Icon name="clock" className="size-5 text-brand-600" />
              ساعات العمل
            </h2>
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
        </aside>
      </div>
    </main>
  );
}

function SalonSkeleton() {
  return (
    <div className="space-y-6 pb-12">
      <Skeleton className="h-80 rounded-none" />
      <div className="mx-auto grid max-w-6xl gap-8 px-4 lg:grid-cols-3">
        <Skeleton className="h-96 lg:col-span-2" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}
