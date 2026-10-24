import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Card, EmptyState, Field, Skeleton, inputStyles } from "@/components/ui";
import type { Tables } from "@/lib/database.types";
import { requireManagedSalon } from "@/lib/auth";
import { formatDuration, formatPrice } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { createService, deleteService, updateService } from "../actions";

export const metadata: Metadata = { title: "الخدمات" };

export default function ServicesPage({ params }: PageProps<"/dashboard/[salonId]/services">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Services params={params} />
    </Suspense>
  );
}

async function Services({ params }: { params: PageProps<"/dashboard/[salonId]/services">["params"] }) {
  const { salonId } = await params;
  const { salon } = await requireManagedSalon(salonId);
  const supabase = await createClient();
  const { data: services, error } = await supabase
    .from("services")
    .select("*")
    .eq("salon_id", salonId)
    .order("sort_order")
    .order("created_at");
  if (error) throw error;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="h-fit lg:order-last">
        <h2 className="mb-4 font-bold">إضافة خدمة</h2>
        <ActionForm action={createService.bind(null, salonId)}>
          <ServiceFields currency={salon.currency} />
          <SubmitButton className="mt-4 w-full">إضافة</SubmitButton>
        </ActionForm>
      </Card>

      <section className="space-y-3 lg:col-span-2">
        {services.length === 0 && (
          <EmptyState title="لا توجد خدمات بعد" description="أضف أول خدمة مع مدتها وسعرها من النموذج." />
        )}
        {services.map((service) => (
          <Card key={service.id} className="p-0">
            <details className="group">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 p-4">
                <div>
                  <p className="font-semibold">
                    {service.name} {!service.is_active && <Badge>موقوفة</Badge>}
                  </p>
                  <p className="mt-0.5 text-sm text-muted">{formatDuration(service.duration_minutes)}</p>
                </div>
                <div className="text-end">
                  <p className="font-bold text-brand-700">{formatPrice(service.price, salon.currency)}</p>
                  <p className="mt-0.5 text-xs text-muted group-open:hidden">تعديل</p>
                </div>
              </summary>
              <div className="border-t border-line p-4">
                <ActionForm action={updateService.bind(null, salonId, service.id)}>
                  <ServiceFields service={service} currency={salon.currency} />
                  <div className="mt-4 flex gap-2">
                    <SubmitButton>حفظ</SubmitButton>
                  </div>
                </ActionForm>
                <ActionForm
                  action={deleteService.bind(null, salonId, service.id)}
                  confirm={`حذف خدمة «${service.name}»؟`}
                  className="mt-2"
                >
                  <SubmitButton variant="danger" pendingText="جارٍ الحذف…">
                    حذف الخدمة
                  </SubmitButton>
                </ActionForm>
              </div>
            </details>
          </Card>
        ))}
      </section>
    </div>
  );
}

function ServiceFields({ service, currency }: { service?: Tables<"services">; currency: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="اسم الخدمة" className="sm:col-span-2">
        <input name="name" required minLength={2} maxLength={120} defaultValue={service?.name} className={inputStyles} />
      </Field>
      <Field label="المدة (بالدقائق)">
        <input
          name="duration_minutes"
          type="number"
          required
          min={5}
          max={600}
          step={5}
          defaultValue={service?.duration_minutes ?? 30}
          dir="ltr"
          className={inputStyles}
        />
      </Field>
      <Field label={`السعر (${currency})`}>
        <input
          name="price"
          type="number"
          required
          min={0}
          step="0.01"
          defaultValue={service?.price}
          dir="ltr"
          className={inputStyles}
        />
      </Field>
      <Field label="الوصف (اختياري)" className="sm:col-span-2">
        <textarea name="description" rows={2} maxLength={1000} defaultValue={service?.description ?? ""} className={inputStyles} />
      </Field>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="is_active" defaultChecked={service?.is_active ?? true} className="size-4 accent-brand-600" />
        الخدمة متاحة للحجز
      </label>
    </div>
  );
}
