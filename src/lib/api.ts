import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { BOOKING_ERRORS, bookingErrorCode } from "@/lib/booking";

// Integration API (used by n8n). Authentication: the salon's API key in
//   Authorization: Bearer sf_live_...   (or the X-API-Key header)
// The key is passed to SECURITY DEFINER functions that resolve the salon;
// it is never logged.

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function apiKeyFrom(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return req.headers.get("x-api-key")?.trim() || null;
}

export function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } });
}

export function apiOk(data: unknown, status = 200) {
  return NextResponse.json({ ok: true, data }, { status, headers: { "Cache-Control": "no-store" } });
}

export function badRequest(message: string) {
  return apiError(400, "BAD_REQUEST", message);
}

/** Maps database errors to HTTP responses without leaking internals. */
export function fromDbError(error: { message?: string; code?: string }) {
  const code = bookingErrorCode(error);
  if (code) return apiError(BOOKING_ERRORS[code].status, code, BOOKING_ERRORS[code].message);
  if (error.code === "22P02" || error.code === "22007" || error.code === "22008") {
    return badRequest("قيمة غير صالحة في الطلب.");
  }
  console.error(`[api] database error ${error.code ?? ""}`);
  return apiError(500, "INTERNAL", "حدث خطأ غير متوقع.");
}

export function requireKey(req: NextRequest): string | NextResponse {
  const key = apiKeyFrom(req);
  if (!key) return apiError(401, "UNAUTHORIZED", BOOKING_ERRORS.UNAUTHORIZED.message);
  return key;
}
