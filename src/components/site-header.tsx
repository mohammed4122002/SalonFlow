import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { signOut } from "@/app/(auth)/actions";
import { buttonStyles } from "./ui";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3">
        <Link href="/" aria-label="SalonFlow — الرئيسية" className="flex items-center gap-2 text-lg font-bold text-brand-700">
          <span aria-hidden className="grid size-8 place-items-center rounded-xl bg-brand-600 text-sm text-white">
            S
          </span>
          <span className="max-[380px]:hidden">SalonFlow</span>
        </Link>
        <nav className="flex items-center gap-1 whitespace-nowrap sm:gap-2 [&_a]:max-sm:px-3 [&_button]:max-sm:px-2.5">
          <Link href="/" className="hidden rounded-xl px-4 py-2.5 text-sm font-semibold text-muted hover:bg-brand-50 hover:text-ink sm:block">
            الصالونات
          </Link>
          <Suspense fallback={<div className="h-10 w-32" />}>
            <AccountLinks />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}

async function AccountLinks() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <>
        <Link href="/login" className={buttonStyles.ghost}>
          تسجيل الدخول
        </Link>
        <Link href="/signup" className={buttonStyles.primary}>
          سجّل صالونك
        </Link>
      </>
    );
  }

  return (
    <>
      {user.role === "super_admin" && (
        <Link href="/admin" className={buttonStyles.ghost}>
          الإدارة
        </Link>
      )}
      <Link href="/dashboard" className={buttonStyles.secondary}>
        لوحة التحكم
      </Link>
      <form action={signOut}>
        <button type="submit" className={buttonStyles.ghost} title={user.email}>
          خروج
        </button>
      </form>
    </>
  );
}
