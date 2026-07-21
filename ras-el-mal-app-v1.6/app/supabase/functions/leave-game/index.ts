// POST /leave-game
// Body: { playerId: string }
// Auth:  required (anonymous Supabase auth session)
// Effect: removes the caller's own player row from a lobby that hasn't
//         started yet. Reassigns host to the lowest remaining seat.
// Returns: { ok: true }
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/supabaseClient.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return errorResponse("method not allowed", 405);
  }

  const auth = await requireUserId(req);
  if ("errorResponse" in auth) {
    return errorResponse(auth.message, auth.status);
  }
  const { client, userId } = auth;

  let body: { playerId?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse("invalid JSON body", 400);
  }

  if (!body.playerId) {
    return errorResponse("playerId is required", 422);
  }

  const { error } = await client.rpc("leave_game", {
    p_player_id: body.playerId,
    p_user_id: userId,
  });

  if (error) {
    const status =
      error.message.includes("not found") ? 404 :
      error.message.includes("only remove yourself") ? 403 :
      error.message.includes("already started") ? 409 :
      400;
    return errorResponse(error.message, status);
  }

  return jsonResponse({ ok: true });
});
