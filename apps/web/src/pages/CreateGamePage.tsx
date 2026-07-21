import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "@/components/PageShell";
import { ErrorBanner } from "@/components/ErrorBanner";
import { useAnonymousAuth } from "@/hooks/useAnonymousAuth";
import { createGame, LobbyApiError } from "@/lib/api/lobbyApi";
import { saveLobbySession } from "@/lib/api/lobbySession";

export function CreateGamePage() {
  const navigate = useNavigate();
  const { userId, loading: authLoading, error: authError } = useAnonymousAuth();
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!userId) return;

    setSubmitting(true);
    setError(null);

    try {
      const result = await createGame(displayName.trim());
      saveLobbySession({
        gameId: result.gameId,
        playerId: result.playerId,
        joinCode: result.joinCode,
      });
      navigate(`/lobby/${result.gameId}`);
    } catch (err) {
      setError(err instanceof LobbyApiError ? err.message : "could not create the game");
    } finally {
      setSubmitting(false);
    }
  }

  const disabled = authLoading || submitting || displayName.trim().length === 0;

  return (
    <PageShell
      eyebrow="New game"
      title="Who's hosting?"
      subtitle="You'll get a join code to share with the table. Seat 1 always starts with 25,000."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ledger-950/80">Your name</span>
          <input
            className="field-input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Omar"
            maxLength={24}
            autoFocus
            autoComplete="off"
          />
        </label>

        <ErrorBanner message={error ?? authError} />

        <button type="submit" className="btn-primary" disabled={disabled}>
          {submitting ? "Creating…" : "Create lobby"}
        </button>
      </form>
    </PageShell>
  );
}
