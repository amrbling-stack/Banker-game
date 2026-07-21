// POST /create-game
// Body: { displayName: string }
// Auth:  required (anonymous Supabase auth session)
// Effect: creates a new game in SETUP status with the caller as seat 1 / host.
// Returns: { gameId, playerId, joinCode }
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

  let body: { displayName?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse("invalid JSON body", 400);
  }

  const displayName = (body.displayName ?? "").trim();
  if (!displayName || displayName.length > 24) {
    return errorResponse("displayName is required (max 24 characters)", 422);
  }

  const { data, error } = await client.rpc("create_game", {
    p_display_name: displayName,
    p_user_id: userId,
  });

  if (error) {
    return errorResponse(error.message, 400);
  }

  const row = Array.isArray(data) ? data[0] : data;

  return jsonResponse({
    gameId: row.game_id,
    playerId: row.player_id,
    joinCode: row.join_code,
  });
});
