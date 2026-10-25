"use client";

import { useActionState, useState } from "react";
import { buttonStyles } from "@/components/ui";
import { generateApiKey, type KeyState } from "./actions";

export function CopyButton({ value, label = "نسخ" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className={`${buttonStyles.secondary} !px-3 !py-1.5 text-xs`}
    >
      {copied ? "تم النسخ ✓" : label}
    </button>
  );
}

// Generates a key; the plaintext lives only in this component's state and is
// never stored or shown again after the page is left.
export function KeyPanel({ salonId, hasKey, canEdit }: { salonId: string; hasKey: boolean; canEdit: boolean }) {
  const [state, action, pending] = useActionState<KeyState>(generateApiKey.bind(null, salonId), null);

  return (
    <div>
      {state?.key && (
        <div role="status" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm">
          <p className="font-semibold text-amber-900">انسخ المفتاح الآن: لن يظهر مرة أخرى.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="ltr block flex-1 overflow-x-auto rounded-lg bg-white px-2 py-1.5 text-xs">{state.key}</code>
            <CopyButton value={state.key} />
          </div>
          <p className="mt-2 text-xs text-amber-900">
            ضعه في n8n كـ Credential من نوع Header Auth: الاسم <span className="ltr">Authorization</span> والقيمة{" "}
            <span className="ltr">Bearer &lt;المفتاح&gt;</span>. لا تضعه داخل نص الـ Workflow أو في أي رسالة.
          </p>
        </div>
      )}
      {state?.error && <p role="alert" className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <form
        action={action}
        onSubmit={(e) => {
          if (hasKey && !window.confirm("سيتوقف المفتاح الحالي عن العمل فورًا. متابعة؟")) e.preventDefault();
        }}
      >
        <button type="submit" disabled={pending || !canEdit} className={hasKey ? buttonStyles.secondary : buttonStyles.primary}>
          {pending ? "جارٍ التوليد…" : hasKey ? "توليد مفتاح جديد (يلغي القديم)" : "توليد مفتاح API"}
        </button>
      </form>
    </div>
  );
}
