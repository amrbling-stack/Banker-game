import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { mapGame, mapPlayer, mapGameDeed, mapLedgerEntry, mapNewsDeckCard } from "@/lib/supabase/mappers";
import type { Database } from "@/lib/supabase/database.types";
import type { Game, Player } from "@/types/lobby";
import type { GameDeed, LedgerEntry, NewsDeckCard } from "@/types/game";

type GameRow = Database["public"]["Tables"]["games"]["Row"];
type PlayerRow = Database["public"]["Tables"]["players"]["Row"];
type GameDeedRow = Database["public"]["Tables"]["game_deeds"]["Row"];
type LedgerEntryRow = Database["public"]["Tables"]["ledger_entries"]["Row"];
type NewsDeckRow = Database["public"]["Tables"]["news_deck"]["Row"];

interface GameDataState {
  game: Game | null;
  players: Player[];
  deeds: GameDeed[];
  ledger: LedgerEntry[];
  news: NewsDeckCard[];
  loading: boolean;
  error: string | null;
}

export function useGameData(gameId: string | null): GameDataState {
  const [state, setState] = useState<GameDataState>({
    game: null,
    players: [],
    deeds: [],
    ledger: [],
    news: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!gameId) {
      setState({ game: null, players: [], deeds: [], ledger: [], news: [], loading: false, error: null });
      return;
    }

    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    const currentGameId = gameId;

    async function loadInitial() {
      const [gameRes, playersRes, deedsRes, ledgerRes, newsRes] = await Promise.all([
        supabase.from("games").select("*").eq("id", currentGameId).single(),
        supabase.from("players").select("*").eq("game_id", currentGameId).order("seat_number"),
        supabase.from("game_deeds").select("*").eq("game_id", currentGameId),
        supabase.from("ledger_entries").select("*").eq("game_id", currentGameId).order("seq"),
        supabase
          .from("news_deck")
          .select("*")
          .eq("game_id", currentGameId)
          .eq("drawn", true)
          .order("draw_order"),
      ]);

      if (cancelled) return;

      if (gameRes.error || !gameRes.data) {
        setState((s) => ({ ...s, loading: false, error: gameRes.error?.message ?? "game not found" }));
        return;
      }

      setState({
        game: mapGame(gameRes.data),
        players: (playersRes.data ?? []).map(mapPlayer),
        deeds: (deedsRes.data ?? []).map(mapGameDeed),
        ledger: (ledgerRes.data ?? []).map(mapLedgerEntry),
        news: (newsRes.data ?? []).map(mapNewsDeckCard),
        loading: false,
        error: null,
      });
    }

    loadInitial();

    const channel = supabase
      .channel(`game:${gameId}`)
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_deeds", filter: `game_id=eq.${gameId}` },
        (payload: any) => {
          setState((s) => {
            if (payload.eventType === "DELETE") {
              const deletedId = (payload.old as { id?: string }).id;
              return { ...s, deeds: s.deeds.filter((d) => d.id !== deletedId) };
            }
            const updated = mapGameDeed(payload.new as GameDeedRow);
            const exists = s.deeds.some((d) => d.id === updated.id);
            const next = exists
              ? s.deeds.map((d) => (d.id === updated.id ? updated : d))
              : [...s.deeds, updated];
            return { ...s, deeds: next };
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ledger_entries", filter: `game_id=eq.${gameId}` },
        (payload: any) => {
          const inserted = mapLedgerEntry(payload.new as LedgerEntryRow);
          setState((s) => ({ ...s, ledger: [...s.ledger, inserted].sort((a, b) => a.seq - b.seq) }));
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "news_deck", filter: `game_id=eq.${gameId}` },
        (payload: any) => {
          if (payload.eventType === "DELETE") return;
          const updated = mapNewsDeckCard(payload.new as NewsDeckRow);
          if (!updated.drawn) return;
          setState((s) => {
            const exists = s.news.some((n) => n.id === updated.id);
            const next = exists
              ? s.news.map((n) => (n.id === updated.id ? updated : n))
              : [...s.news, updated];
            next.sort((a, b) => a.drawOrder - b.drawOrder);
            return { ...s, news: next };
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
