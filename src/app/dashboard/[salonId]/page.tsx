import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card, Skeleton, Stat, buttonStyles } from "@/components/ui";
import { requireManagedSalon } from "@/lib/auth";
import { SUBSCRIPTION_STATUS_LABELS, daysUntil, formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { setPublished } from "./actions";

export default function SalonOverviewPage({ params }: PageProps<"/dashboard/[salonId]">) {
  return (
    <Suspense fallback={<Skeleton className="h-80" />}>
      <Overview params={params} />
    </Suspense>
  );
}

async function Overview({ params }: { params: PageProps<"/dashboard/[salonId]">["params"] }) {
  const { salonId } = await params;
  const { salon } = await requireManagedSalon(salonId);
  await connection();
  const now = new Date();
  const supabase = await createClient();

  const [services, specialists, hours, pending, upcoming, { data: subscription }] = await Promise.all([
    supabase.from("services").select("id", { count: "exact", head: true }).eq("salon_id", salonId).eq("is_active", true),
    supabase.from("specialists").select("id", { count: "exact", head: true }).eq("salon_id", salonId).eq("is_active", true),
    supabase.from("working_hours").select("id", { count: "exact", head: true }).eq("salon_id", salonId),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("salon_id", salonId).eq("status", "pending"),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", salonId)
      .neq("status", "cancelled")
      .gte("starts_at", now.toISOString()),
    supabase.from("subscriptions").select("status, trial_ends_at").eq("salon_id", salonId).maybeSingle(),
  ]);

  const steps = [
    { done: Boolean(services.count), label: "أضف خدماتك وأسعارها", href: "services" },
    { done: Boolean(specialists.count), label: "أضف الأخصائيات واربطهن بالخدمات", href: "specialists" },
    { done: Boolean(hours.count), label: "حدّد ساعات العمل", href: "hours" },
    { done: salon.is_published, label: "انشر الصالون ليظهر للعملاء", href: "" },
  ];
  const trialDays = subscription ? daysUntil(subscription.trial_ends_at, now) : null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="حجوزات بانتظار التأكيد" value={pending.count ?? 0} />
        <Stat label="حجوزات قادمة" value={upcoming.count ?? 0} />
        <Stat label="خدمات نشطة" value={services.count ?? 0} />
        <Stat label="أخصائيات نشطات" value={specialists.count ?? 0} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="font-bold">خطوات تجهيز الصالون</h2>
          <ol className="mt-4 space-y-2">
            {steps.map((step, i) => (
              <li key={step.label} className="flex items-center gap-3 text-sm">
                <span
                  className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
                    step.done ? "bg-emerald-100 text-emerald-700" : "bg-canvas text-muted"
                  }`}
                >
                  {step.done ? "✓" : i + 1}
                </span>
                {step.done || !step.href ? (
                  <span className={step.done ? "text-muted line-through" : ""}>{step.label}</span>
                ) : (
                  <Link href={`/dashboard/${salonId}/${step.href}`} className="text-brand-700 hover:underline">
                    {step.label}
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </Card>

        <div className="space-y-6">
          <Card>
            <h2 className="font-bold">الظهور للعملاء</h2>
            <p className="mt-1 text-sm text-muted">
              {salon.is_published ? "الصالون ظاهر في الصفحة الرئيسية." : "الصالون مخفي عن الزوار حاليًا."}
            </p>
            <ActionForm action={setPublished.bind(null, salonId, !salon.is_published)} className="mt-4 flex flex-wrap gap-2">
              <SubmitButton variant={salon.is_published ? "secondary" : "primary"} pendingText="جارٍ التحديث…">
                {salon.is_published ? "إخفاء الصالون" : "نشر الصالون"}
              </SubmitButton>
              <Link href={`/salons/${salon.slug}`} className={buttonStyles.ghost} target="_blank">
                عرض صفحة الصالون
              </Link>
            </ActionForm>
          </Card>

          {subscription && (
            <Card>
              <h2 className="font-bold">الاشتراك</h2>
              <p className="mt-1 text-sm text-muted">{SUBSCRIPTION_STATUS_LABELS[subscription.status]}</p>
              {subscription.status === "trialing" && trialDays !== null && (
                <p className="mt-2 text-sm">
                  {trialDays > 0 ? `متبقٍ ${trialDays} يومًا من الفترة التجريبية` : "انتهت الفترة التجريبية"} (حتى{" "}
                  {formatDate(subscription.trial_ends_at, salon.timezone)})
                </p>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
