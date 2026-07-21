import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageShell } from "@/components/PageShell";
import { ErrorBanner } from "@/components/ErrorBanner";
import { JoinCodeBadge } from "@/components/JoinCodeBadge";
import { PlayerSeatRow } from "@/components/PlayerSeatRow";
import { useAnonymousAuth } from "@/hooks/useAnonymousAuth";
import { useLobby } from "@/hooks/useLobby";
import { leaveGame, startGame, LobbyApiError } from "@/lib/api/lobbyApi";
import { clearLobbySession, loadLobbySession } from "@/lib/api/lobbySession";

export function LobbyPage() {
  const { gameId = "" } = useParams();
  const navigate = useNavigate();
  const { userId } = useAnonymousAuth();
  const { game, players, loading, error } = useLobby(gameId);

  const session = useMemo(() => loadLobbySession(), []);
  const me = players.find((p) => p.userId === userId) ?? null;

  const [startingPlayerId, setStartingPlayerId] = useState<string>("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [starting, setStarting] = useState(false);

  // A device that lands here without ever having joined this game (e.g. a
  // stale bookmark) gets sent back to the front door rather than a blank
  // lobby.
  useEffect(() => {
    if (!loading && !game) {
      navigate("/", { replace: true });
    }
  }, [loading, game, navigate]);

  // Once the host starts the game, everyone's lobby screen moves on to the
  // actual play screen automatically.
  useEffect(() => {
    if (game && game.status !== "SETUP") {
      navigate(`/game/${game.id}`, { replace: true });
    }
  }, [game, navigate]);

  // Default the "who rolled highest" selector to the host once players load.
  useEffect(() => {
    if (!startingPlayerId && players.length > 0) {
      setStartingPlayerId(players[0].id);
    }
  }, [players, startingPlayerId]);

  async function handleLeave() {
    if (!me) return;
    setLeaving(true);
    setActionError(null);
    try {
      await leaveGame(me.id);
      clearLobbySession();
      navigate("/");
    } catch (err) {
      setActionError(err instanceof LobbyApiError ? err.message : "could not leave the lobby");
    } finally {
      setLeaving(false);
    }
  }

  async function handleStart() {
    if (!game || !startingPlayerId) return;
    setStarting(true);
    setActionError(null);
    try {
      await startGame(game.id, startingPlayerId);
    } catch (err) {
      setActionError(err instanceof LobbyApiError ? err.message : "could not start the game");
    } finally {
      setStarting(false);
    }
  }

  if (loading) {
    return (
      <PageShell title="Loading lobby…">
        <p className="text-sm text-ledger-950/60">Fetching the table.</p>
      </PageShell>
    );
  }

  if (!game) {
    return null; // redirect effect above will fire
  }

  const isHost = me?.isHost ?? false;
  const canStart =
    isHost &&
    game.status === "SETUP" &&
    players.length >= game.minPlayers &&
    players.length <= game.maxPlayers &&
    Boolean(startingPlayerId);

  return (
    <PageShell
      eyebrow={game.status === "SETUP" ? "Lobby" : "Game underway"}
      title={game.status === "SETUP" ? "Waiting for the table" : "Ras El-Mal is live"}
      subtitle={
        game.status === "SETUP"
          ? `${players.length} of ${game.maxPlayers} seats filled · needs ${game.minPlayers}–${game.maxPlayers} to start`
          : "Continue play on the physical board. This screen now tracks the game."
      }
    >
      {game.status === "SETUP" && <JoinCodeBadge code={session?.joinCode ?? game.joinCode} />}

      <ul className="flex flex-col gap-2">
        {players.map((p) => (
          <PlayerSeatRow key={p.id} player={p} isYou={p.id === me?.id} />
        ))}
      </ul>

      <ErrorBanner message={error ?? actionError} />

      {game.status === "SETUP" && isHost && (
        <div className="card mt-2 flex flex-col gap-3">
          <p className="text-sm font-medium text-ledger-950">
            Roll the dice at the table, then tell the app who rolled highest.
          </p>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide text-ledger-950/50">
              Starting player
            </span>
            <select
              className="field-input"
              value={startingPlayerId}
              onChange={(e) => setStartingPlayerId(e.target.value)}
            >
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  Seat {p.seatNumber} · {p.displayName}
                </option>
              ))}
            </select>
          </label>
          <button className="btn-primary" onClick={handleStart} disabled={!canStart || starting}>
            {starting ? "Starting…" : "Start game"}
          </button>
          {players.length < game.minPlayers && (
            <p className="text-xs text-ledger-950/50">
              Waiting for at least {game.minPlayers} players to join.
            </p>
          )}
        </div>
      )}

      {game.status === "SETUP" && !isHost && (
        <p className="text-center text-sm text-ledger-950/60">
          Waiting for the host to start the game…
        </p>
      )}

      {game.status === "SETUP" && me && (
        <button className="btn-secondary mt-auto" onClick={handleLeave} disabled={leaving}>
          {leaving ? "Leaving…" : "Leave lobby"}
        </button>
      )}
    </PageShell>
  );
}
