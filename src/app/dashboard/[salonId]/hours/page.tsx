import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card, EmptyState, Field, Skeleton, inputStyles } from "@/components/ui";
import { requireManagedSalon } from "@/lib/auth";
import { DAY_NAMES, formatDateTime, formatTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { addTimeOff, addWorkingHours, deleteTimeOff, deleteWorkingHours } from "../actions";

export const metadata: Metadata = { title: "أوقات العمل" };

type Slot = { id: string; day_of_week: number; start_time: string; end_time: string; specialist_id: string | null };

export default function HoursPage({ params }: PageProps<"/dashboard/[salonId]/hours">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Hours params={params} />
    </Suspense>
  );
}

async function Hours({ params }: { params: PageProps<"/dashboard/[salonId]/hours">["params"] }) {
  const { salonId } = await params;
  const { salon } = await requireManagedSalon(salonId);
  await connection();
  const supabase = await createClient();
  // Show time off that has not ended more than a week ago.
  const now = new Date();
  const since = new Date(now.getTime() - 7 * 86_400_000).toISOString();

  const [{ data: specialists }, { data: slots, error }, { data: timeOff }] = await Promise.all([
    supabase.from("specialists").select("id, full_name").eq("salon_id", salonId).order("sort_order").order("full_name"),
    supabase
      .from("working_hours")
      .select("id, day_of_week, start_time, end_time, specialist_id")
      .eq("salon_id", salonId)
      .order("day_of_week")
      .order("start_time"),
    supabase
      .from("time_off")
      .select("id, starts_at, ends_at, reason, specialist_id")
      .eq("salon_id", salonId)
      .gte("ends_at", since)
      .order("starts_at"),
  ]);
  if (error) throw error;

  const people = specialists ?? [];
  const nameOf = new Map(people.map((p) => [p.id, p.full_name]));
  const groups = [
    { id: null as string | null, title: "ساعات عمل الصالون" },
    ...people.map((p) => ({ id: p.id as string | null, title: `ساعات خاصة: ${p.full_name}` })),
  ].filter((g) => g.id === null || slots.some((s) => s.specialist_id === g.id));

  return (
    <div className="space-y-10">
      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="h-fit lg:order-last">
          <h2 className="mb-1 font-bold">إضافة فترة عمل</h2>
          <p className="mb-4 text-xs text-muted">
            الأوقات بتوقيت الصالون (<span className="ltr">{salon.timezone}</span>). لفترتين في اليوم (مثل صباحية ومسائية)
            أضف كل فترة على حدة.
          </p>
          <ActionForm action={addWorkingHours.bind(null, salonId)} className="space-y-3">
            <Field label="لمن؟" hint="الأخصائية التي لها ساعات خاصة تُستخدم ساعاتها بدل ساعات الصالون.">
              <select name="specialist_id" className={inputStyles} defaultValue="">
                <option value="">الصالون (لكل الأخصائيات)</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
              </select>
            </Field>
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium">الأيام</legend>
              <div className="grid grid-cols-2 gap-1.5">
                {DAY_NAMES.map((day, i) => (
                  <label key={day} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="days" value={i} className="size-4 accent-brand-600" />
                    {day}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid grid-cols-2 gap-3">
              <Field label="من">
                <input name="start_time" type="time" required defaultValue="09:00" dir="ltr" className={inputStyles} />
              </Field>
              <Field label="إلى">
                <input name="end_time" type="time" required defaultValue="17:00" dir="ltr" className={inputStyles} />
              </Field>
            </div>
            <SubmitButton className="w-full">إضافة</SubmitButton>
          </ActionForm>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          {groups.map((group) => (
            <Card key={group.id ?? "salon"}>
              <h2 className="mb-3 font-bold">{group.title}</h2>
              <WeekTable salonId={salonId} slots={slots.filter((s) => s.specialist_id === group.id)} />
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="h-fit lg:order-last">
          <h2 className="mb-4 font-bold">إضافة إجازة</h2>
          <ActionForm action={addTimeOff.bind(null, salonId)} className="space-y-3">
            <Field label="لمن؟">
              <select name="specialist_id" className={inputStyles} defaultValue="">
                <option value="">الصالون كاملًا (إغلاق)</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="من">
              <input name="starts_at" type="datetime-local" required dir="ltr" className={inputStyles} />
            </Field>
            <Field label="إلى">
              <input name="ends_at" type="datetime-local" required dir="ltr" className={inputStyles} />
            </Field>
            <Field label="السبب (اختياري)">
              <input name="reason" maxLength={300} className={inputStyles} />
            </Field>
            <SubmitButton className="w-full">إضافة</SubmitButton>
          </ActionForm>
        </Card>

        <div className="lg:col-span-2">
          <h2 className="mb-3 text-lg font-bold">الإجازات والإغلاقات</h2>
          {timeOff?.length ? (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {timeOff.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                  <div>
                    <p className="font-semibold">{t.specialist_id ? nameOf.get(t.specialist_id) : "الصالون كاملًا"}</p>
                    <p className="mt-0.5 text-muted">
                      {formatDateTime(t.starts_at, salon.timezone)} ← {formatDateTime(t.ends_at, salon.timezone)}
                    </p>
                    {t.reason && <p className="mt-0.5 text-muted">{t.reason}</p>}
                  </div>
                  <ActionForm action={deleteTimeOff.bind(null, salonId, t.id)} confirm="حذف هذه الإجازة؟">
                    <SubmitButton variant="ghost" pendingText="…">
                      حذف
                    </SubmitButton>
                  </ActionForm>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="لا توجد إجازات مسجّلة" />
          )}
        </div>
      </section>
    </div>
  );
}

function WeekTable({ salonId, slots }: { salonId: string; slots: Slot[] }) {
  return (
    <dl className="divide-y divide-line text-sm">
      {DAY_NAMES.map((day, i) => {
        const daySlots = slots.filter((s) => s.day_of_week === i);
        return (
          <div key={day} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <dt className="w-20 text-muted">{day}</dt>
            <dd className="flex flex-1 flex-wrap justify-end gap-2">
              {daySlots.length ? (
                daySlots.map((s) => (
                  <ActionForm
                    key={s.id}
                    action={deleteWorkingHours.bind(null, salonId, s.id)}
                    confirm={`حذف فترة ${day} ${formatTime(s.start_time)}–${formatTime(s.end_time)}؟`}
                  >
                    <span className="inline-flex items-center gap-1 rounded-full border border-line bg-canvas ps-3 pe-1 py-0.5">
                      <span className="ltr">
                        {formatTime(s.start_time)}–{formatTime(s.end_time)}
                      </span>
                      <button
                        type="submit"
                        aria-label="حذف الفترة"
                        className="grid size-6 place-items-center rounded-full text-muted hover:bg-red-50 hover:text-red-700"
                      >
                        ×
                      </button>
                    </span>
                  </ActionForm>
                ))
              ) : (
                <span className="text-muted">مغلق</span>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
