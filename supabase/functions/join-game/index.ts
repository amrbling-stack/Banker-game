// POST /join-game
// Body: { joinCode: string, displayName: string }
// Auth:  required (anonymous Supabase auth session)
// Effect: assigns the caller the next open seat in the lobby (or returns
//         their existing seat if this device already joined).
// Returns: { gameId, playerId, seatNumber }
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

  let body: { joinCode?: string; displayName?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse("invalid JSON body", 400);
  }

  const joinCode = (body.joinCode ?? "").trim().toUpperCase();
  const displayName = (body.displayName ?? "").trim();

  if (!joinCode) {
    return errorResponse("joinCode is required", 422);
  }
  if (!displayName || displayName.length > 24) {
    return errorResponse("displayName is required (max 24 characters)", 422);
  }

  const { data, error } = await client.rpc("join_game", {
    p_join_code: joinCode,
    p_display_name: displayName,
    p_user_id: userId,
  });

  if (error) {
    // Map known error patterns to friendlier status codes.
    const status =
      error.message.includes("no game found") ? 404 :
      error.message.includes("already started") ? 409 :
      error.message.includes("lobby is full") ? 409 :
      error.message.includes("already taken") ? 409 :
      400;
    return errorResponse(error.message, status);
  }

  const row = Array.isArray(data) ? data[0] : data;

  return jsonResponse({
    gameId: row.game_id,
    playerId: row.player_id,
    seatNumber: row.seat_number,
  });
});
