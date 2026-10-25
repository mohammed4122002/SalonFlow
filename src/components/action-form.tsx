"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/forms";
import { buttonStyles } from "./ui";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

// A form wired to a Server Action, showing its error / success message.
export function ActionForm({
  action,
  children,
  className = "",
  confirm,
}: {
  action: Action;
  children: ReactNode;
  className?: string;
  confirm?: string;
}) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      {state?.error && (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p role="status" className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {state.success}
        </p>
      )}
    </form>
  );
}

export function SubmitButton({
  children,
  variant = "primary",
  className = "",
  pendingText = "جارٍ الحفظ…",
  disabled = false,
}: {
  children: ReactNode;
  variant?: keyof typeof buttonStyles;
  className?: string;
  pendingText?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} className={`${buttonStyles[variant]} ${className}`}>
      {pending ? pendingText : children}
    </button>
  );
}
