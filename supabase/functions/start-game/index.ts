// POST /start-game
// Body: { gameId: string, startingPlayerId: string }
// Auth:  required (anonymous Supabase auth session, must be the host)
// Effect: locks the lobby (2-6 players), assigns play_order clockwise from
//         startingPlayerId (the seat that rolled highest on the physical
//         dice), and flips the game to ACTIVE.
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

  let body: { gameId?: string; startingPlayerId?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse("invalid JSON body", 400);
  }

  if (!body.gameId || !body.startingPlayerId) {
    return errorResponse("gameId and startingPlayerId are required", 422);
  }

  const { error } = await client.rpc("start_game", {
    p_game_id: body.gameId,
    p_starting_player_id: body.startingPlayerId,
    p_user_id: userId,
  });

  if (error) {
    const status =
      error.message.includes("not found") ? 404 :
      error.message.includes("only the host") ? 403 :
      error.message.includes("already started") ? 409 :
      error.message.includes("need at least") ? 422 :
      400;
    return errorResponse(error.message, status);
  }

  return jsonResponse({ ok: true });
});
