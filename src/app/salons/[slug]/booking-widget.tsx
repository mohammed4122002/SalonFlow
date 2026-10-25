"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, inputStyles } from "@/components/ui";
import { formatDuration, formatPrice } from "@/lib/format";
import { fetchSlots, submitBooking, type Slot } from "./actions";

type Service = { id: string; name: string; duration_minutes: number; price: number };
type Specialist = { id: string; full_name: string; serviceIds: string[] };

const DAYS_AHEAD = 14;

function dateInZone(d: Date, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function BookingWidget({
  salonId,
  timezone,
  nowMs,
  currency,
  services,
  specialists,
}: {
  salonId: string;
  timezone: string;
  nowMs: number;
  currency: string;
  services: Service[];
  specialists: Specialist[];
}) {
  const [serviceId, setServiceId] = useState<string>("");
  const [specialistId, setSpecialistId] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [startsAt, setStartsAt] = useState<string>("");
  const [loading, startLoading] = useTransition();
  const requestId = useRef(0);

  // Next 14 days in the salon's timezone, starting from the server's "now".
  const days = useMemo(() => {
    const now = nowMs;
    return Array.from({ length: DAYS_AHEAD }, (_, i) => {
      const d = new Date(now + i * 86_400_000);
      return {
        value: dateInZone(d, timezone),
        weekday: new Intl.DateTimeFormat("ar", { timeZone: timezone, weekday: "short" }).format(d),
        day: new Intl.DateTimeFormat("ar-u-nu-latn", { timeZone: timezone, day: "numeric", month: "short" }).format(d),
      };
    });
  }, [timezone, nowMs]);

  const service = services.find((s) => s.id === serviceId);
  const eligible = specialists.filter((s) => s.serviceIds.includes(serviceId));

  useEffect(() => {
    if (!serviceId || !date) return;
    const id = ++requestId.current;
    startLoading(async () => {
      const res = await fetchSlots(salonId, serviceId, specialistId || null, date);
      if (id !== requestId.current) return; // a newer request superseded this one
      if ("error" in res) {
        setSlotError(res.error);
        setSlots([]);
      } else {
        setSlotError(null);
        setSlots(res.slots);
      }
    });
  }, [salonId, serviceId, specialistId, date]);

  // With "any specialist" several specialists can share a time; show it once.
  const times = useMemo(() => {
    const seen = new Map<string, Slot>();
    for (const s of slots ?? []) if (!seen.has(s.startsAt)) seen.set(s.startsAt, s);
    return [...seen.values()];
  }, [slots]);

  const timeLabel = (iso: string) =>
    new Intl.DateTimeFormat("ar-u-nu-latn", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(
      new Date(iso),
    );

  if (!services.length) return <p className="text-sm text-muted">لا توجد خدمات متاحة للحجز حاليًا.</p>;

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">1. اختاري الخدمة</legend>
        <div className="grid gap-2">
          {services.map((s) => (
            <label
              key={s.id}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm transition ${
                serviceId === s.id ? "border-brand-500 bg-brand-50" : "border-line hover:border-brand-200"
              }`}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="service_choice"
                  value={s.id}
                  checked={serviceId === s.id}
                  onChange={() => {
                    setServiceId(s.id);
                    setSpecialistId("");
                    setStartsAt("");
                    setSlots(null);
                  }}
                  className="accent-brand-600"
                />
                <span>
                  {s.name}
                  <span className="block text-xs text-muted">{formatDuration(s.duration_minutes)}</span>
                </span>
              </span>
              <span className="font-semibold text-brand-700">{formatPrice(s.price, currency)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {serviceId && (
        <Field label="2. الأخصائية">
          <select
            value={specialistId}
            onChange={(e) => {
              setSpecialistId(e.target.value);
              setStartsAt("");
            }}
            className={inputStyles}
          >
            <option value="">أي أخصائية متاحة</option>
            {eligible.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
              </option>
            ))}
          </select>
        </Field>
      )}

      {serviceId && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">3. اليوم</legend>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {days.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => {
                  setDate(d.value);
                  setStartsAt("");
                }}
                aria-pressed={date === d.value}
                className={`shrink-0 rounded-xl border px-3 py-2 text-center text-xs transition ${
                  date === d.value ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-surface hover:border-brand-200"
                }`}
              >
                <span className="block font-semibold">{d.weekday}</span>
                <span className="block">{d.day}</span>
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {serviceId && date && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">4. الوقت</legend>
          {loading && <p className="text-sm text-muted">جارٍ تحميل المواعيد…</p>}
          {!loading && slotError && <p className="text-sm text-red-700">{slotError}</p>}
          {!loading && !slotError && slots && times.length === 0 && (
            <p className="rounded-xl bg-canvas px-3 py-2 text-sm text-muted">لا توجد مواعيد متاحة في هذا اليوم، جرّبي يومًا آخر.</p>
          )}
          {!loading && times.length > 0 && (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {times.map((s) => (
                <button
                  key={s.startsAt}
                  type="button"
                  onClick={() => setStartsAt(s.startsAt)}
                  aria-pressed={startsAt === s.startsAt}
                  className={`ltr rounded-lg border px-2 py-2 text-sm transition ${
                    startsAt === s.startsAt ? "border-brand-600 bg-brand-600 text-white" : "border-line hover:border-brand-200"
                  }`}
                >
                  {timeLabel(s.startsAt)}
                </button>
              ))}
            </div>
          )}
        </fieldset>
      )}

      {startsAt && service && (
        <ActionForm action={submitBooking.bind(null, salonId)} className="space-y-3 border-t border-line pt-4">
          <p className="text-sm">
            <b>{service.name}</b> · <span className="ltr">{timeLabel(startsAt)}</span> ·{" "}
            {formatPrice(service.price, currency)}
          </p>
          <input type="hidden" name="service_id" value={serviceId} />
          <input type="hidden" name="specialist_id" value={specialistId} />
          <input type="hidden" name="starts_at" value={startsAt} />
          <Field label="الاسم الكامل">
            <input name="full_name" required minLength={2} maxLength={120} autoComplete="name" className={inputStyles} />
          </Field>
          <Field label="رقم الهاتف">
            <input
              name="phone"
              type="tel"
              required
              autoComplete="tel"
              dir="ltr"
              placeholder="+970 59 000 0000"
              pattern="\+?[0-9 \-\(\)]{7,25}"
              className={inputStyles}
            />
          </Field>
          <Field label="البريد الإلكتروني">
            <input name="email" type="email" required autoComplete="email" dir="ltr" className={inputStyles} />
          </Field>
          <Field label="ملاحظات (اختياري)">
            <textarea name="notes" rows={2} maxLength={1000} className={inputStyles} />
          </Field>
          <SubmitButton className="w-full" pendingText="جارٍ إرسال الطلب…">
            إرسال طلب الحجز
          </SubmitButton>
          <p className="text-xs text-muted">سيكون الحجز «بانتظار التأكيد» حتى يؤكده الصالون، وستصلك رسالة بالبريد.</p>
        </ActionForm>
      )}
    </div>
  );
}
