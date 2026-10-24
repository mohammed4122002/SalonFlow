"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { authErrorMessage } from "@/lib/errors";
import { type ActionState, safeNextPath, text } from "@/lib/forms";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

async function siteOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export async function signUp(_: ActionState, formData: FormData): Promise<ActionState> {
  const fullName = text(formData, "full_name");
  const email = text(formData, "email").toLowerCase();
  const password = text(formData, "password");

  if (fullName.length < 2) return { error: "يرجى إدخال الاسم الكامل." };
  if (!EMAIL_RE.test(email)) return { error: "البريد الإلكتروني غير صحيح." };
  if (password.length < 8) return { error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${await siteOrigin()}/auth/confirm?next=/dashboard`,
    },
  });
  if (error) return { error: authErrorMessage(error.message) };

  // Email confirmation disabled in Supabase: the user is signed in right away.
  if (data.session) redirect("/dashboard");

  return { success: "تم إنشاء الحساب. أرسلنا رسالة تأكيد إلى بريدك، افتحها لتفعيل الحساب ثم سجّل الدخول." };
}

export async function signIn(_: ActionState, formData: FormData): Promise<ActionState> {
  const email = text(formData, "email").toLowerCase();
  const password = text(formData, "password");
  if (!email || !password) return { error: "يرجى إدخال البريد الإلكتروني وكلمة المرور." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: authErrorMessage(error.message) };

  redirect(safeNextPath(text(formData, "next")));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
