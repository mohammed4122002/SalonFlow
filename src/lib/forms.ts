export type ActionState = { error?: string; success?: string } | null;

export function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

// Empty optional fields are stored as NULL rather than "".
export function optionalText(formData: FormData, name: string): string | null {
  return text(formData, name) || null;
}

export function numberField(formData: FormData, name: string): number | null {
  const raw = text(formData, name);
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function checkbox(formData: FormData, name: string): boolean {
  return formData.get(name) === "on";
}

// Only allow same-site relative redirects (prevents open redirects via ?next=).
export function safeNextPath(value: string | null | undefined, fallback = "/dashboard"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
