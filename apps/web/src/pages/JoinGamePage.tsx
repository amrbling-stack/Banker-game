import { FormEvent, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageShell } from "@/components/PageShell";
import { ErrorBanner } from "@/components/ErrorBanner";
import { useAnonymousAuth } from "@/hooks/useAnonymousAuth";
import { joinGame, LobbyApiError } from "@/lib/api/lobbyApi";
import { saveLobbySession } from "@/lib/api/lobbySession";

export function JoinGamePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { userId, loading: authLoading, error: authError } = useAnonymousAuth();

  const [joinCode, setJoinCode] = useState(searchParams.get("code") ?? "");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!userId) return;

    setSubmitting(true);
    setError(null);

    try {
      const result = await joinGame(joinCode.trim(), displayName.trim());
      saveLobbySession({
        gameId: result.gameId,
        playerId: result.playerId,
        joinCode: joinCode.trim().toUpperCase(),
      });
      navigate(`/lobby/${result.gameId}`);
    } catch (err) {
      setError(err instanceof LobbyApiError ? err.message : "could not join that game");
    } finally {
      setSubmitting(false);
    }
  }

  const disabled =
    authLoading || submitting || joinCode.trim().length === 0 || displayName.trim().length === 0;

  return (
    <PageShell
      eyebrow="Join a game"
      title="Enter the table"
      subtitle="Ask the host for the 6-character code shown on their screen."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ledger-950/80">Join code</span>
          <input
            className="field-input font-mono uppercase tracking-[0.2em]"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="K7QX4P"
            maxLength={6}
            autoFocus
            autoComplete="off"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ledger-950/80">Your name</span>
          <input
            className="field-input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Rana"
            maxLength={24}
            autoComplete="off"
          />
        </label>

        <ErrorBanner message={error ?? authError} />

        <button type="submit" className="btn-primary" disabled={disabled}>
          {submitting ? "Joining…" : "Join lobby"}
        </button>
      </form>
    </PageShell>
  );
}
