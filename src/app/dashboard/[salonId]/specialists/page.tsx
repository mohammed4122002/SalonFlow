import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Card, EmptyState, Field, Skeleton, inputStyles } from "@/components/ui";
import { requireManagedSalon } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createSpecialist, deleteSpecialist, updateSpecialist } from "../actions";

export const metadata: Metadata = { title: "الأخصائيات" };

type ServiceOption = { id: string; name: string; is_active: boolean };
type SpecialistRow = {
  id: string;
  full_name: string;
  bio: string | null;
  is_active: boolean;
  specialist_services: { service_id: string }[];
};

export default function SpecialistsPage({ params }: PageProps<"/dashboard/[salonId]/specialists">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Specialists params={params} />
    </Suspense>
  );
}

async function Specialists({ params }: { params: PageProps<"/dashboard/[salonId]/specialists">["params"] }) {
  const { salonId } = await params;
  await requireManagedSalon(salonId);
  const supabase = await createClient();

  const [{ data: specialists, error }, { data: services }] = await Promise.all([
    supabase
      .from("specialists")
      .select("id, full_name, bio, is_active, specialist_services(service_id)")
      .eq("salon_id", salonId)
      .order("sort_order")
      .order("created_at"),
    supabase.from("services").select("id, name, is_active").eq("salon_id", salonId).order("sort_order").order("name"),
  ]);
  if (error) throw error;
  const serviceList = services ?? [];
  const serviceNames = new Map(serviceList.map((s) => [s.id, s.name]));

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="h-fit lg:order-last">
        <h2 className="mb-4 font-bold">إضافة أخصائية</h2>
        <ActionForm action={createSpecialist.bind(null, salonId)}>
          <SpecialistFields services={serviceList} salonId={salonId} />
          <SubmitButton className="mt-4 w-full">إضافة</SubmitButton>
        </ActionForm>
      </Card>

      <section className="space-y-3 lg:col-span-2">
        {specialists.length === 0 && (
          <EmptyState title="لا توجد أخصائيات بعد" description="أضف الأخصائيات وحدّد الخدمات التي تقدمها كل واحدة." />
        )}
        {specialists.map((sp) => (
          <Card key={sp.id} className="p-0">
            <details className="group">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 p-4">
                <div>
                  <p className="font-semibold">
                    {sp.full_name} {!sp.is_active && <Badge>موقوفة</Badge>}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {sp.specialist_services.length ? (
                      sp.specialist_services.map((l) => (
                        <Badge key={l.service_id} tone="brand">
                          {serviceNames.get(l.service_id)}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-amber-700">لم تُربط بأي خدمة بعد</span>
                    )}
                  </div>
                </div>
                <span className="shrink-0 text-xs text-muted group-open:hidden">تعديل</span>
              </summary>
              <div className="border-t border-line p-4">
                <ActionForm action={updateSpecialist.bind(null, salonId, sp.id)}>
                  <SpecialistFields specialist={sp} services={serviceList} salonId={salonId} />
                  <SubmitButton className="mt-4">حفظ</SubmitButton>
                </ActionForm>
                <ActionForm
                  action={deleteSpecialist.bind(null, salonId, sp.id)}
                  confirm={`حذف «${sp.full_name}»؟ ستُحذف أيضًا ساعات عملها وإجازاتها.`}
                  className="mt-2"
                >
                  <SubmitButton variant="danger" pendingText="جارٍ الحذف…">
                    حذف الأخصائية
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

function SpecialistFields({
  specialist,
  services,
  salonId,
}: {
  specialist?: SpecialistRow;
  services: ServiceOption[];
  salonId: string;
}) {
  const linked = new Set(specialist?.specialist_services.map((l) => l.service_id));
  return (
    <div className="space-y-3">
      <Field label="الاسم">
        <input name="full_name" required minLength={2} maxLength={120} defaultValue={specialist?.full_name} className={inputStyles} />
      </Field>
      <Field label="نبذة (اختياري)">
        <textarea name="bio" rows={2} maxLength={1000} defaultValue={specialist?.bio ?? ""} className={inputStyles} />
      </Field>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">الخدمات التي تقدمها</legend>
        {services.length ? (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {services.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="service_ids"
                  value={s.id}
                  defaultChecked={linked.has(s.id)}
                  className="size-4 accent-brand-600"
                />
                {s.name}
                {!s.is_active && <span className="text-xs text-muted">(موقوفة)</span>}
              </label>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">
            <Link href={`/dashboard/${salonId}/services`} className="text-brand-700 hover:underline">
              أضف خدمات
            </Link>{" "}
            أولًا لتربطها بالأخصائيات.
          </p>
        )}
      </fieldset>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="is_active" defaultChecked={specialist?.is_active ?? true} className="size-4 accent-brand-600" />
        متاحة لاستقبال الحجوزات
      </label>
    </div>
  );
}
