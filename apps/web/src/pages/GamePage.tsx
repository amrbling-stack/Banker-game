import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageShell } from "@/components/PageShell";
import { ErrorBanner } from "@/components/ErrorBanner";
import { MarketBar } from "@/components/game/MarketBar";
import { PlayerCard } from "@/components/game/PlayerCard";
import { CompaniesPanel } from "@/components/game/CompaniesPanel";
import { NewsLog } from "@/components/game/NewsLog";
import { ScoreBoard } from "@/components/game/ScoreBoard";
import { useAnonymousAuth } from "@/hooks/useAnonymousAuth";
import { useGameData } from "@/hooks/useGameData";
import { useCompanies } from "@/hooks/useCompanies";
import { computeScoring } from "@/lib/gameCalc";
import { finishGame, GameApiError } from "@/lib/api/gameApi";

type Tab = "players" | "companies" | "news";

export function GamePage() {
  const { gameId = "" } = useParams();
  const navigate = useNavigate();
  useAnonymousAuth();

  const { game, players, deeds, news, loading, error } = useGameData(gameId);
  const { companies, loading: companiesLoading } = useCompanies();

  const [tab, setTab] = useState<Tab>("players");
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  const companiesById = useMemo(() => new Map(companies.map((c) => [c.id, c])), [companies]);

  const scoring = useMemo(() => {
    if (!game) return [];
    return computeScoring(players, deeds, companiesById, game.indexPosition);
  }, [game, players, deeds, companiesById]);

  // Shouldn't normally happen (Lobby only sends players here once ACTIVE),
  // but guard against a stale link without triggering a render-phase
  // navigation.
  useEffect(() => {
    if (game && game.status === "SETUP") {
      navigate(`/lobby/${game.id}`, { replace: true });
    }
  }, [game, navigate]);

  async function handleFinish() {
    if (!game) return;
    setFinishing(true);
    setFinishError(null);
    try {
      await finishGame(game.id);
    } catch (err) {
      setFinishError(err instanceof GameApiError ? err.message : "could not finish the game");
    } finally {
      setFinishing(false);
    }
  }

  if (loading || companiesLoading) {
    return (
      <PageShell title="Loading game…">
        <p className="text-sm text-ledger-950/60">Fetching the table.</p>
      </PageShell>
    );
  }

  if (!game) {
    return (
      <PageShell title="Game not found">
        <ErrorBanner message={error ?? "This game doesn't exist."} />
        <button className="btn-secondary" onClick={() => navigate("/")}>
          Back home
        </button>
      </PageShell>
    );
  }

  if (game.status === "SETUP") {
    // The effect above is already redirecting; render nothing this tick.
    return null;
  }

  if (game.status === "COMPLETE") {
    return (
      <PageShell eyebrow="Final scoring" title="Game over">
        <ScoreBoard lines={scoring} />
      </PageShell>
    );
  }

  return (
    <PageShell
      eyebrow={game.status === "ENDGAME_COUNTDOWN" ? "Final stretch" : "In play"}
      title="Ras El-Mal"
    >
      <MarketBar
        indexPosition={game.indexPosition}
        ratePosition={game.ratePosition}
        reckoningDrawn={game.reckoningDrawn}
      />

      <div className="flex gap-1 rounded-card border border-ledger-900/10 bg-white/60 p-1">
        {(["players", "companies", "news"] as Tab[]).map((t) => (
          <button
            key={t}
            className={`flex-1 rounded-card py-2 text-sm font-medium capitalize transition ${
              tab === t ? "bg-ledger-900 text-parchment-50" : "text-ledger-950/60"
            }`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "players" && (
        <div className="flex flex-col gap-3">
          {players.map((player) => (
            <PlayerCard
              key={player.id}
              gameId={game.id}
              player={player}
              otherPlayers={players.filter((p) => p.id !== player.id)}
            />
          ))}
        </div>
      )}

      {tab === "companies" && (
        <CompaniesPanel
          gameId={game.id}
          companies={companies}
          deeds={deeds}
          players={players}
          indexPosition={game.indexPosition}
        />
      )}

      {tab === "news" && <NewsLog gameId={game.id} news={news} />}

      <ErrorBanner message={finishError} />
      <button className="btn-primary mt-2" onClick={handleFinish} disabled={finishing}>
        {finishing ? "Finishing…" : "End game & score"}
      </button>
    </PageShell>
  );
}
