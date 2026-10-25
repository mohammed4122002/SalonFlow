import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Badge, Card, Skeleton } from "@/components/ui";
import { requireManagedSalon } from "@/lib/auth";
import { SUBSCRIPTION_STATUS_LABELS, daysUntil, formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { subscriptionValid } from "@/lib/subscription";

export const metadata: Metadata = { title: "الاشتراك" };

export default function SubscriptionPage({ params }: PageProps<"/dashboard/[salonId]/subscription">) {
  return (
    <Suspense fallback={<Skeleton className="h-72" />}>
      <Subscription params={params} />
    </Suspense>
  );
}

async function Subscription({ params }: { params: PageProps<"/dashboard/[salonId]/subscription">["params"] }) {
  const { salonId } = await params;
  const { salon, subscription: sub } = await requireManagedSalon(salonId);
  await connection();
  const now = new Date();
  const supabase = await createClient();
  const { data: events } = await supabase
    .from("subscription_events")
    .select("id, created_at, details")
    .eq("salon_id", salonId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!sub) return <Card>لا يوجد اشتراك مرتبط بهذا الصالون. تواصل مع إدارة المنصة.</Card>;
  const valid = subscriptionValid(sub, now);
  const endsAt = sub.status === "trialing" ? sub.trial_ends_at : sub.current_period_end;
  const days = endsAt ? daysUntil(endsAt, now) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-bold">حالة الاشتراك</h2>
          <Badge tone={valid ? "green" : "red"}>{valid ? "فعّال" : "غير فعّال"}</Badge>
          <Badge>{SUBSCRIPTION_STATUS_LABELS[sub.status]}</Badge>
        </div>
        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">الباقة</dt>
            <dd className="font-medium">{sub.plan === "trial" ? "تجريبية" : sub.plan}</dd>
          </div>
          {sub.status === "trialing" || sub.plan === "trial" ? (
            <div>
              <dt className="text-muted">تنتهي الفترة التجريبية</dt>
              <dd className="font-medium">{formatDate(sub.trial_ends_at, salon.timezone)}</dd>
            </div>
          ) : (
            <div>
              <dt className="text-muted">نهاية الفترة الحالية</dt>
              <dd className="font-medium">{sub.current_period_end ? formatDate(sub.current_period_end, salon.timezone) : "مفتوحة"}</dd>
            </div>
          )}
          {days !== null && (
            <div>
              <dt className="text-muted">المتبقي</dt>
              <dd className={`font-medium ${days <= 3 ? "text-red-700" : ""}`}>
                {days > 0 ? `${days} يومًا` : "انتهت"}
              </dd>
            </div>
          )}
        </dl>
        <div className="mt-6 rounded-xl bg-canvas p-4 text-sm">
          <p className="font-semibold">الترقية</p>
          <p className="mt-1 text-muted">
            الدفع الإلكتروني سيتاح لاحقًا. حاليًا تتم الترقية عبر إدارة المنصة: تواصل معنا ليتم تفعيل اشتراكك فورًا.
          </p>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 font-bold">ماذا يحدث عند انتهاء الاشتراك؟</h2>
        <ul className="list-disc space-y-1.5 ps-5 text-sm text-muted">
          <li>يُخفى الصالون عن العملاء ولا يستقبل حجوزات جديدة (من الموقع أو البوت).</li>
          <li>لا يمكن تعديل الخدمات والأخصائيات والساعات والإعدادات.</li>
          <li>يبقى بإمكانك تسجيل الدخول وعرض البيانات وإلغاء الحجوزات القائمة.</li>
          <li>يعود كل شيء فور التفعيل، دون فقدان أي بيانات.</li>
        </ul>
      </Card>

      {events && events.length > 0 && (
        <Card className="lg:col-span-3">
          <h2 className="mb-3 font-bold">سجل التغييرات</h2>
          <ul className="divide-y divide-line text-sm">
            {events.map((e) => {
              const d = e.details as { from?: { status?: string }; to?: { status?: string } };
              return (
                <li key={e.id} className="flex justify-between gap-3 py-2">
                  <span>
                    {SUBSCRIPTION_STATUS_LABELS[d.from?.status as keyof typeof SUBSCRIPTION_STATUS_LABELS] ?? d.from?.status} ←{" "}
                    {SUBSCRIPTION_STATUS_LABELS[d.to?.status as keyof typeof SUBSCRIPTION_STATUS_LABELS] ?? d.to?.status}
                  </span>
                  <span className="text-muted">{formatDate(e.created_at, salon.timezone)}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
