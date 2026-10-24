import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, Skeleton, inputStyles } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/forms";
import { signIn } from "../actions";
import { AuthCard } from "../auth-card";

export const metadata: Metadata = { title: "تسجيل الدخول" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <AuthCard title="تسجيل الدخول" subtitle="ادخل إلى لوحة تحكم صالونك.">
      <Suspense fallback={<Skeleton className="h-64" />}>
        <LoginForm searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function LoginForm({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  if (await getCurrentUser()) redirect(next);

  return (
    <>
      {params.error === "confirm" && (
        <p role="alert" className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
          إذا فتحت رابط التأكيد فقد تم تفعيل حسابك، سجّل الدخول الآن. وإذا لم ينجح الدخول فالرابط منتهي، أنشئ الحساب من جديد.
        </p>
      )}
      <ActionForm action={signIn} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <Field label="البريد الإلكتروني">
          <input name="email" type="email" required autoComplete="email" dir="ltr" className={inputStyles} />
        </Field>
        <Field label="كلمة المرور">
          <input name="password" type="password" required autoComplete="current-password" dir="ltr" className={inputStyles} />
        </Field>
        <SubmitButton className="w-full" pendingText="جارٍ الدخول…">
          دخول
        </SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-sm text-muted">
        ليس لديك حساب؟{" "}
        <Link href="/signup" className="font-semibold text-brand-700 hover:underline">
          سجّل صالونك
        </Link>
      </p>
    </>
  );
}
