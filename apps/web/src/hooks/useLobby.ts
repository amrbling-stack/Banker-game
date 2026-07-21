import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { mapGame, mapPlayer } from "@/lib/supabase/mappers";
import type { Database } from "@/lib/supabase/database.types";
import type { Game, Player } from "@/types/lobby";

type GameRow = Database["public"]["Tables"]["games"]["Row"];
type PlayerRow = Database["public"]["Tables"]["players"]["Row"];

interface LobbyState {
  game: Game | null;
  players: Player[];
  loading: boolean;
  error: string | null;
}

export function useLobby(gameId: string | null): LobbyState {
  const [state, setState] = useState<LobbyState>({
    game: null,
    players: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!gameId) {
      setState({ game: null, players: [], loading: false, error: null });
      return;
    }

    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    const currentGameId = gameId;

    async function loadInitial() {
      const [gameRes, playersRes] = await Promise.all([
        supabase.from("games").select("*").eq("id", currentGameId).single(),
        supabase
          .from("players")
          .select("*")
          .eq("game_id", currentGameId)
          .order("seat_number", { ascending: true }),
      ]);

      if (cancelled) return;

      if (gameRes.error || !gameRes.data) {
        setState({
          game: null,
          players: [],
          loading: false,
          error: gameRes.error?.message ?? "game not found",
        });
        return;
      }

      setState({
        game: mapGame(gameRes.data),
        players: (playersRes.data ?? []).map(mapPlayer),
        loading: false,
        error: playersRes.error?.message ?? null,
      });
    }

    loadInitial();

    const channel = supabase
      .channel(`lobby:${gameId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` },
        (payload: any) => {
          if (payload.eventType === "DELETE") return;
          setState((s) => ({ ...s, game: mapGame(payload.new as GameRow) }));
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `game_id=eq.${gameId}` },
        (payload: any) => {
          setState((s) => {
            if (payload.eventType === "DELETE") {
              const deletedId = (payload.old as { id?: string }).id;
              return { ...s, players: s.players.filter((p) => p.id !== deletedId) };
            }

            const updated = mapPlayer(payload.new as PlayerRow);
            const exists = s.players.some((p) => p.id === updated.id);
            const next = exists
              ? s.players.map((p) => (p.id === updated.id ? updated : p))
              : [...s.players, updated];

            next.sort((a, b) => a.seatNumber - b.seatNumber);
            return { ...s, players: next };
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  return state;
}
