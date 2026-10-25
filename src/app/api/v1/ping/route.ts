import type { NextRequest } from "next/server";
import { apiOk, fromDbError, requireKey } from "@/lib/api";
import { createAnonClient } from "@/lib/supabase/anon";

// Connection test for n8n: returns the salon name when the key is valid.
export async function GET(req: NextRequest) {
  const key = requireKey(req);
  if (typeof key !== "string") return key;
  const { data, error } = await createAnonClient().rpc("api_salon_info", { p_api_key: key });
  if (error) return fromDbError(error);
  const salon = data as { id: string; name: string };
  return apiOk({ connected: true, salon: { id: salon.id, name: salon.name } });
}
