"use client";

import { useRef, useState, useTransition } from "react";
import { buttonStyles } from "@/components/ui";
import type { ActionState } from "@/lib/forms";

// Resizes the picked image in the browser (keeps uploads small and fast),
// then sends it to the Server Action as WebP.
async function compress(file: File, maxSide: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("encode"))), "image/webp", 0.85),
  );
}

export function ImageUploader({
  action,
  label,
  maxSide = 1600,
  disabled = false,
}: {
  action: (formData: FormData) => Promise<ActionState>;
  label: string;
  maxSide?: number;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ActionState>(null);
  const [pending, start] = useTransition();

  function onPick(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setState({ error: "اختر ملف صورة." });
      return;
    }
    start(async () => {
      try {
        const blob = await compress(file, maxSide);
        const form = new FormData();
        form.append("file", new File([blob], "image.webp", { type: "image/webp" }));
        setState(await action(form));
      } catch {
        setState({ error: "تعذّرت قراءة الصورة، جرّب صورة أخرى." });
      } finally {
        if (input.current) input.current.value = "";
      }
    });
  }

  return (
    <div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-label={label}
        onChange={(e) => onPick(e.target.files?.[0])}
        disabled={disabled || pending}
      />
      <button
        type="button"
        className={buttonStyles.secondary}
        onClick={() => input.current?.click()}
        disabled={disabled || pending}
      >
        {pending ? "جارٍ الرفع…" : label}
      </button>
      {state?.error && (
        <p role="alert" className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p role="status" className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {state.success}
        </p>
      )}
    </div>
  );
}
