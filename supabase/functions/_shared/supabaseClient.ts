// deno-lint-ignore-file no-explicit-any
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Builds a Supabase client scoped to the calling request's JWT (the
 * anonymous-auth session created client-side), so `auth.uid()` inside our
 * RPC functions resolves to the caller's own user id — never a value the
 * client could spoof by passing an arbitrary user_id in the request body.
 *
 * All RPCs in this feature still take p_user_id as an explicit parameter
 * for clarity and testability, but the edge function always fills it in
 * from this authenticated identity, never from the request body.
 */
export function getRequestClient(req: Request): {
  client: SupabaseClient;
  authHeader: string | null;
} {
  const authHeader = req.headers.get("Authorization");

  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: {
        headers: authHeader ? { Authorization: authHeader } : {},
      },
    },
  );

  return { client, authHeader };
}

export async function requireUserId(req: Request): Promise<{
  client: SupabaseClient;
  userId: string;
} | { errorResponse: true; message: string; status: number }> {
  const { client, authHeader } = getRequestClient(req);

  if (!authHeader) {
    return { errorResponse: true, message: "missing authorization header", status: 401 };
  }

  const { data, error } = await client.auth.getUser();

  if (error || !data?.user) {
    return { errorResponse: true, message: "invalid or expired session", status: 401 };
  }

  return { client, userId: data.user.id };
}
