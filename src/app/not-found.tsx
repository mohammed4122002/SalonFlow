import Link from "next/link";
import { buttonStyles } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="text-5xl font-bold text-brand-600">404</p>
      <h1 className="mt-4 text-xl font-bold">الصفحة غير موجودة</h1>
      <p className="mt-2 text-sm text-muted">ربما تغيّر الرابط، أو لا تملك صلاحية الوصول إلى هذه الصفحة.</p>
      <Link href="/" className={`${buttonStyles.primary} mt-6`}>
        العودة للرئيسية
      </Link>
    </main>
  );
}
