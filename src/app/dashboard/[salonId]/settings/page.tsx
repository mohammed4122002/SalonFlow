import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card, Skeleton } from "@/components/ui";
import { requireManagedSalon } from "@/lib/auth";
import { updateSalon } from "../actions";
import { SalonFields } from "../../salon-fields";

export const metadata: Metadata = { title: "إعدادات الصالون" };

export default function SettingsPage({ params }: PageProps<"/dashboard/[salonId]/settings">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Settings params={params} />
    </Suspense>
  );
}

async function Settings({ params }: { params: PageProps<"/dashboard/[salonId]/settings">["params"] }) {
  const { salonId } = await params;
  const { salon } = await requireManagedSalon(salonId);

  return (
    <Card>
      <h2 className="mb-4 font-bold">بيانات الصالون</h2>
      <ActionForm action={updateSalon.bind(null, salonId)}>
        <SalonFields salon={salon} />
        <p className="mt-4 text-xs text-muted">تغيير الرابط يغيّر عنوان صفحة الصالون، والروابط القديمة لن تعمل.</p>
        <SubmitButton className="mt-4">حفظ التغييرات</SubmitButton>
      </ActionForm>
    </Card>
  );
}
