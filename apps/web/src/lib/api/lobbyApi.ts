import { supabase } from "@/lib/supabase/client";
import type { CreateGameResult, JoinGameResult } from "@/types/lobby";

/**
 * Thin wrappers around the lobby edge functions. `supabase.functions.invoke`
 * automatically attaches the caller's auth JWT, which is what lets the
 * server-side RPCs trust `auth.uid()` instead of a client-supplied id.
 */

export class LobbyApiError extends Error {}

async function invoke<T>(functionName: string, body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke(functionName, {
    body,
  });

  if (error) {
    // FunctionsHttpError carries the JSON { error: string } body we return
    // from each edge function; surface that message when we can find it.
    const message =
      (error as { context?: { error?: string } }).context?.error ??
      error.message ??
      "something went wrong";
    throw new LobbyApiError(message);
  }

  if (data && typeof data === "object" && "error" in data) {
    throw new LobbyApiError(String((data as { error: unknown }).error));
  }

  return data as T;
}

export function createGame(displayName: string): Promise<CreateGameResult> {
  return invoke<CreateGameResult>("create-game", { displayName });
}

export function joinGame(
  joinCode: string,
  displayName: string,
): Promise<JoinGameResult> {
  return invoke<JoinGameResult>("join-game", { joinCode, displayName });
}

export function leaveGame(playerId: string): Promise<{ ok: true }> {
  return invoke<{ ok: true }>("leave-game", { playerId });
}

export function startGame(
  gameId: string,
  startingPlayerId: string,
): Promise<{ ok: true }> {
  return invoke<{ ok: true }>("start-game", { gameId, startingPlayerId });
}
