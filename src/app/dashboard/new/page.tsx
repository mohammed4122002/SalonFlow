import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card, PageHeader, Skeleton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { createSalon } from "../actions";
import { SalonFields } from "../salon-fields";

export const metadata: Metadata = { title: "صالون جديد" };

export default function NewSalonPage() {
  return (
    <>
      <PageHeader
        title="إنشاء صالون جديد"
        description="أدخل بيانات صالونك الأساسية. يمكنك تعديلها لاحقًا، ولن يظهر الصالون للزوار حتى تنشره."
      />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <NewSalonForm />
      </Suspense>
    </>
  );
}

async function NewSalonForm() {
  await requireUser();
  return (
    <Card>
      <ActionForm action={createSalon}>
        <SalonFields />
        <div className="mt-6">
          <SubmitButton pendingText="جارٍ الإنشاء…">إنشاء الصالون</SubmitButton>
        </div>
      </ActionForm>
    </Card>
  );
}
