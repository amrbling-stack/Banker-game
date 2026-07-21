import { useState } from "react";
import type { NewsDeckCard } from "@/types/game";
import { NEWS_CARD_LABELS } from "@/types/game";
import { drawBreakingNews, GameApiError } from "@/lib/api/gameApi";
import { ErrorBanner } from "@/components/ErrorBanner";

interface NewsLogProps {
  gameId: string;
  news: NewsDeckCard[]; // drawn only, oldest first
}

export function NewsLog({ gameId, news }: NewsLogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recent = [...news].reverse().slice(0, 6);

  async function handleDraw() {
    setBusy(true);
    setError(null);
    try {
      await drawBreakingNews(gameId);
    } catch (err) {
      setError(err instanceof GameApiError ? err.message : "that didn't work");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-ledger-950">Breaking news</h3>
        <button className="btn-secondary" onClick={handleDraw} disabled={busy}>
          Draw card
        </button>
      </div>

      <ErrorBanner message={error} />

      {recent.length === 0 ? (
        <p className="text-xs text-ledger-950/50">No cards drawn yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {recent.map((card) => (
            <li key={card.id} className="font-mono text-xs text-ledger-950/70">
              {NEWS_CARD_LABELS[card.code] ?? card.code}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
