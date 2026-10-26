import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Icon } from "@/components/icons";
import { Card, Skeleton, Stat, buttonStyles } from "@/components/ui";
import { requireManagedSalon } from "@/lib/auth";
import {
  SUBSCRIPTION_STATUS_LABELS,
  daysUntil,
  formatDate,
} from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { setPublished } from "./actions";

export default function SalonOverviewPage({
  params,
}: PageProps<"/dashboard/[salonId]">) {
  return (
    <Suspense fallback={<Skeleton className="h-80" />}>
      <Overview params={params} />
    </Suspense>
  );
}

async function Overview({
  params,
}: {
  params: PageProps<"/dashboard/[salonId]">["params"];
}) {
  const { salonId } = await params;
  const { salon } = await requireManagedSalon(salonId);
  await connection();
  const now = new Date();
  const supabase = await createClient();

  const [
    services,
    specialists,
    hours,
    photos,
    pending,
    upcoming,
    { data: subscription },
  ] = await Promise.all([
    supabase
      .from("services")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", salonId)
      .eq("is_active", true),
    supabase
      .from("specialists")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", salonId)
      .eq("is_active", true),
    supabase
      .from("working_hours")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", salonId),
    supabase
      .from("salon_photos")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", salonId),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", salonId)
      .eq("status", "pending"),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", salonId)
      .neq("status", "cancelled")
      .gte("starts_at", now.toISOString()),
    supabase
      .from("subscriptions")
      .select("status, trial_ends_at")
      .eq("salon_id", salonId)
      .maybeSingle(),
  ]);

  const steps: SetupStep[] = [
    {
      done: Boolean(salon.cover_path),
      label: "ارفع صورة الغلاف",
      hint: "تظهر أعلى صفحة الصالون وعلى بطاقته في الصفحة الرئيسية.",
      href: "media",
    },
    {
      done: Boolean(salon.logo_path),
      label: "ارفع شعار الصالون",
      hint: "صورة مربعة تظهر بجانب اسم الصالون.",
      href: "media",
    },
    {
      done: Boolean(photos.count),
      label: "أضف صورًا لمعرض أعمالك",
      hint: "حتى 12 صورة تظهر في قسم «من أعمالنا».",
      href: "media",
    },
    {
      done: Boolean(services.count),
      label: "أضف خدماتك وأسعارها",
      hint: "الخدمات التي يمكن للعملاء حجزها.",
      href: "services",
    },
    {
      done: Boolean(specialists.count),
      label: "أضف الأخصائيات واربطهن بالخدمات",
      hint: "كل أخصائية تُحجز للخدمات المرتبطة بها.",
      href: "specialists",
    },
    {
      done: Boolean(hours.count),
      label: "حدّد ساعات العمل",
      hint: "تُحسب منها المواعيد المتاحة تلقائيًا.",
      href: "hours",
    },
    {
      done: salon.is_published,
      label: "انشر الصالون ليظهر للعملاء",
      hint: "من بطاقة «الظهور للعملاء» في هذه الصفحة.",
      href: "#visibility",
    },
  ];
  const trialDays = subscription
    ? daysUntil(subscription.trial_ends_at, now)
    : null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="حجوزات بانتظار التأكيد" value={pending.count ?? 0} />
        <Stat label="حجوزات قادمة" value={upcoming.count ?? 0} />
        <Stat label="خدمات نشطة" value={services.count ?? 0} />
        <Stat label="أخصائيات نشطات" value={specialists.count ?? 0} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <SetupChecklist salonId={salonId} steps={steps} />

        <div className="space-y-6">
          <Card id="visibility" className="scroll-mt-24">
            <h2 className="font-bold">الظهور للعملاء</h2>
            <p className="mt-1 text-sm text-muted">
              {salon.is_published
                ? "الصالون ظاهر في الصفحة الرئيسية."
                : "الصالون مخفي عن الزوار حاليًا."}
            </p>
            <ActionForm
              action={setPublished.bind(null, salonId, !salon.is_published)}
              className="mt-4 flex flex-wrap gap-2"
            >
              <SubmitButton
                variant={salon.is_published ? "secondary" : "primary"}
                pendingText="جارٍ التحديث…"
              >
                {salon.is_published ? "إخفاء الصالون" : "نشر الصالون"}
              </SubmitButton>
              <Link
                href={`/salons/${salon.slug}`}
                className={buttonStyles.ghost}
                target="_blank"
              >
                عرض صفحة الصالون
              </Link>
            </ActionForm>
          </Card>

          {subscription && (
            <Card>
              <h2 className="font-bold">الاشتراك</h2>
              <p className="mt-1 text-sm text-muted">
                {SUBSCRIPTION_STATUS_LABELS[subscription.status]}
              </p>
              {subscription.status === "trialing" && trialDays !== null && (
                <p className="mt-2 text-sm">
                  {trialDays > 0
                    ? `متبقٍ ${trialDays} يومًا من الفترة التجريبية`
                    : "انتهت الفترة التجريبية"}{" "}
                  (حتى {formatDate(subscription.trial_ends_at, salon.timezone)})
                </p>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

type SetupStep = { done: boolean; label: string; hint: string; href: string };

function SetupChecklist({
  salonId,
  steps,
}: {
  salonId: string;
  steps: SetupStep[];
}) {
  const doneCount = steps.filter((s) => s.done).length;
  const complete = doneCount === steps.length;
  const percent = Math.round((doneCount / steps.length) * 100);

  if (complete) {
    return (
      <div className="flex items-center gap-4 self-start rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-soft lg:col-span-2">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
          <Icon name="check" className="size-6" />
        </span>
        <div>
          <h2 className="font-bold text-emerald-900">
            صالونك جاهز لاستقبال الحجوزات
          </h2>
          <p className="mt-0.5 text-sm text-emerald-800/80">
            أكملت كل خطوات الإعداد. يمكنك تعديل أي شيء من التبويبات في الأعلى.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Card className="lg:col-span-2">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-bold">أكمل إعداد صالونك</h2>
          <p className="mt-0.5 text-sm text-muted">
            صالون مكتمل بالصور والخدمات يجذب حجوزات أكثر.
          </p>
        </div>
        <p className="text-sm font-semibold text-brand-700">
          {doneCount} من {steps.length}
        </p>
      </div>
      <div
        className="mt-4 h-2 overflow-hidden rounded-full bg-canvas"
        role="progressbar"
        aria-label="تقدّم إعداد الصالون"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div
          className="h-full rounded-full bg-gradient-to-l from-brand-500 to-gold-400 transition-all duration-700"
          style={{ width: `${percent}%` }}
        />
      </div>
      <ol className="mt-5 divide-y divide-line/70">
        {steps.map((step, i) => (
          <li key={step.label} className="flex items-center gap-3 py-3">
            <span
              className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                step.done
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-brand-50 text-brand-700"
              }`}
            >
              {step.done ? <Icon name="check" className="size-4" /> : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={`text-sm font-medium ${step.done ? "text-muted line-through" : ""}`}
              >
                {step.label}
              </p>
              {!step.done && (
                <p className="mt-0.5 text-xs text-muted">{step.hint}</p>
              )}
            </div>
            {!step.done && (
              <Link
                href={
                  step.href.startsWith("#")
                    ? step.href
                    : `/dashboard/${salonId}/${step.href}`
                }
                className="inline-flex shrink-0 items-center gap-1 rounded-xl px-3 py-1.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50"
              >
                ابدأ
                <Icon name="arrow" className="size-4" />
              </Link>
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
}
