import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Field, inputStyles } from "@/components/ui";
import { signUp } from "../actions";
import { AuthCard } from "../auth-card";

export const metadata: Metadata = { title: "إنشاء حساب" };

export default function SignupPage() {
  return (
    <AuthCard title="سجّل صالونك" subtitle="أنشئ حساب صاحب صالون، وابدأ تجربة مجانية لمدة 30 يومًا.">
      <ActionForm action={signUp} className="space-y-4">
        <Field label="الاسم الكامل">
          <input name="full_name" required minLength={2} maxLength={120} autoComplete="name" className={inputStyles} />
        </Field>
        <Field label="البريد الإلكتروني">
          <input name="email" type="email" required autoComplete="email" dir="ltr" className={inputStyles} />
        </Field>
        <Field label="كلمة المرور" hint="8 أحرف على الأقل.">
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            dir="ltr"
            className={inputStyles}
          />
        </Field>
        <SubmitButton className="w-full" pendingText="جارٍ إنشاء الحساب…">
          إنشاء الحساب
        </SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-sm text-muted">
        لديك حساب؟{" "}
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">
          تسجيل الدخول
        </Link>
      </p>
    </AuthCard>
  );
}
