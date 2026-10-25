import type { NextRequest } from "next/server";
import { apiOk, fromDbError, requireKey } from "@/lib/api";
import { createAnonClient } from "@/lib/supabase/anon";

// Active services with duration and price.
export async function GET(req: NextRequest) {
  const key = requireKey(req);
  if (typeof key !== "string") return key;
  const { data, error } = await createAnonClient().rpc("api_services", { p_api_key: key });
  return error ? fromDbError(error) : apiOk(data);
}
