import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, PageHeader, Skeleton, Stat } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { SALON_STATUS_LABELS, SUBSCRIPTION_STATUS_LABELS, daysUntil, formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { subscriptionValid } from "@/lib/subscription";
import { activateSubscription, extendTrial, setSalonStatus, suspendSubscription } from "./actions";
import { Field, inputStyles } from "@/components/ui";

export const metadata: Metadata = { title: "لوحة الإدارة" };

export default function AdminPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <PageHeader title="لوحة الإدارة العامة" description="متابعة الصالونات وأصحابها على المنصة." />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <AdminContent />
      </Suspense>
    </main>
  );
}

async function AdminContent() {
  await requireAdmin();
  await connection();
  const now = new Date();
  const supabase = await createClient();

  const [{ data: salons, error }, { data: owners }, bookings] = await Promise.all([
    supabase
      .from("salons")
      .select(
        "id, name, slug, city, status, is_published, created_at, owner:profiles(email, full_name), subscriptions(status, plan, trial_ends_at, current_period_end)",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, email, full_name, role, created_at, salons(count)")
      .order("created_at", { ascending: false }),
    supabase.from("bookings").select("id", { count: "exact", head: true }),
  ]);
  if (error) throw error;

  const active = salons.filter((s) => s.status === "active").length;
  const published = salons.filter((s) => s.is_published && s.status === "active" && subscriptionValid(s.subscriptions, now)).length;
  const subs = salons.map((s) => s.subscriptions).filter((x) => x !== null);
  const trialing = subs.filter((x) => x.status === "trialing" && subscriptionValid(x, now)).length;
  const paying = subs.filter((x) => x.status === "active" && subscriptionValid(x, now)).length;
  const expired = subs.length - trialing - paying;

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="الصالونات" value={salons.length} hint={`${active} نشط · ${salons.length - active} معلّق`} />
        <Stat label="ظاهرة للزوار" value={published} />
        <Stat label="الحسابات" value={owners?.length ?? 0} />
        <Stat label="إجمالي الحجوزات" value={bookings.count ?? 0} />
        <Stat label="في الفترة التجريبية" value={trialing} />
        <Stat label="اشتراكات مدفوعة فعّالة" value={paying} />
        <Stat label="منتهية / معلّقة" value={expired} hint="مخفية ولا تستقبل حجوزات" />
      </div>

      <section>
        <h2 className="mb-3 text-lg font-bold">الصالونات</h2>
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="bg-canvas text-xs text-muted">
              <tr>
                <th className="p-3 text-start font-medium">الصالون</th>
                <th className="p-3 text-start font-medium">المالك</th>
                <th className="p-3 text-start font-medium">الحالة</th>
                <th className="p-3 text-start font-medium">الاشتراك</th>
                <th className="p-3 text-start font-medium">أُنشئ</th>
                <th className="p-3 text-start font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {salons.map((s) => {
                const sub = s.subscriptions;
                const endsAt = sub ? (sub.status === "active" ? sub.current_period_end : sub.trial_ends_at) : null;
                const days = endsAt ? daysUntil(endsAt, now) : null;
                return (
                  <tr key={s.id}>
                    <td className="p-3">
                      <p className="font-medium">{s.name}</p>
                      <p className="ltr text-start text-xs text-muted">/{s.slug}</p>
                    </td>
                    <td className="p-3">
                      <p>{s.owner?.full_name}</p>
                      <p className="ltr text-start text-xs text-muted">{s.owner?.email}</p>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        <Badge tone={s.status === "active" ? "green" : "red"}>{SALON_STATUS_LABELS[s.status]}</Badge>
                        {s.is_published && <Badge tone="brand">منشور</Badge>}
                      </div>
                    </td>
                    <td className="p-3">
                      {sub ? (
                        <>
                          <p>
                            {SUBSCRIPTION_STATUS_LABELS[sub.status]}
                            {sub.status === "active" && <span className="text-xs text-muted"> ({sub.plan})</span>}
                          </p>
                          {days !== null && (
                            <p className={`text-xs ${days > 0 ? "text-muted" : "text-red-700"}`}>
                              {days > 0 ? `متبقٍ ${days} يومًا` : "منتهٍ"}
                            </p>
                          )}
                          <SubscriptionTools salonId={s.id} status={sub.status} />
                        </>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="p-3 whitespace-nowrap text-muted">{formatDate(s.created_at)}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap items-start gap-2">
                        <Link href={`/dashboard/${s.id}`} className="rounded-lg px-2 py-1 text-brand-700 hover:bg-brand-50">
                          إدارة
                        </Link>
                        <ActionForm
                          action={setSalonStatus.bind(null, s.id, s.status === "active" ? "suspended" : "active")}
                          confirm={s.status === "active" ? `تعليق صالون «${s.name}»؟ سيختفي عن الزوار.` : undefined}
                        >
                          <SubmitButton variant={s.status === "active" ? "danger" : "secondary"} pendingText="…" className="!px-3 !py-1">
                            {s.status === "active" ? "تعليق" : "تفعيل"}
                          </SubmitButton>
                        </ActionForm>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!salons.length && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted">
                    لا توجد صالونات بعد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">الحسابات</h2>
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="bg-canvas text-xs text-muted">
              <tr>
                <th className="p-3 text-start font-medium">الاسم</th>
                <th className="p-3 text-start font-medium">البريد</th>
                <th className="p-3 text-start font-medium">الدور</th>
                <th className="p-3 text-start font-medium">الصالونات</th>
                <th className="p-3 text-start font-medium">التسجيل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(owners ?? []).map((o) => (
                <tr key={o.id}>
                  <td className="p-3">{o.full_name || "—"}</td>
                  <td className="ltr p-3 text-start">{o.email}</td>
                  <td className="p-3">
                    <Badge tone={o.role === "super_admin" ? "brand" : "neutral"}>
                      {o.role === "super_admin" ? "مدير عام" : "صاحب صالون"}
                    </Badge>
                  </td>
                  <td className="p-3">{o.salons[0]?.count ?? 0}</td>
                  <td className="p-3 whitespace-nowrap text-muted">{formatDate(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SubscriptionTools({ salonId, status }: { salonId: string; status: string }) {
  return (
    <details className="mt-1">
      <summary className="cursor-pointer text-xs text-brand-700 hover:underline">إدارة الاشتراك</summary>
      <div className="mt-2 w-56 space-y-3 rounded-xl border border-line bg-canvas p-3">
        <ActionForm action={extendTrial.bind(null, salonId)} className="space-y-2">
          <Field label="تمديد التجربة (أيام)">
            <input name="days" type="number" min={1} max={365} defaultValue={7} dir="ltr" className={`${inputStyles} !py-1.5`} />
          </Field>
          <SubmitButton variant="secondary" className="w-full !py-1.5" pendingText="…">
            تمديد
          </SubmitButton>
        </ActionForm>
        <ActionForm action={activateSubscription.bind(null, salonId)} className="space-y-2 border-t border-line pt-3">
          <Field label="تفعيل اشتراك مدفوع (أشهر)">
            <input name="months" type="number" min={1} max={36} defaultValue={1} dir="ltr" className={`${inputStyles} !py-1.5`} />
          </Field>
          <Field label="الباقة">
            <input name="plan" defaultValue="standard" dir="ltr" className={`${inputStyles} !py-1.5`} />
          </Field>
          <SubmitButton className="w-full !py-1.5" pendingText="…">
            تفعيل
          </SubmitButton>
        </ActionForm>
        {status !== "suspended" && (
          <ActionForm action={suspendSubscription.bind(null, salonId)} confirm="تعليق اشتراك هذا الصالون؟" className="border-t border-line pt-3">
            <SubmitButton variant="danger" className="w-full !py-1.5" pendingText="…">
              تعليق الاشتراك
            </SubmitButton>
          </ActionForm>
        )}
      </div>
    </details>
  );
}
