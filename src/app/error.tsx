"use client";

import { buttonStyles } from "@/components/ui";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-xl font-bold">حدث خطأ غير متوقع</h1>
      <p className="mt-2 text-sm text-muted">تعذّر تحميل الصفحة. حاول مرة أخرى بعد قليل.</p>
      <button type="button" onClick={reset} className={`${buttonStyles.primary} mt-6`}>
        إعادة المحاولة
      </button>
    </main>
  );
}
