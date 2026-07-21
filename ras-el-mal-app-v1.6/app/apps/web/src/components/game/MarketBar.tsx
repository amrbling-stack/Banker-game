import { INDEX_STEPS, RATE_STEPS } from "@/types/game";

interface MarketBarProps {
  indexPosition: number;
  ratePosition: number;
  reckoningDrawn: boolean;
}

/**
 * Read-only display of the two market tracks. Both only ever move as a
 * side effect of drawing a news card (see NewsLog), so there are no
 * controls here — just the current state, the way the physical tracker
 * sheet would show it.
 */
export function MarketBar({ indexPosition, ratePosition, reckoningDrawn }: MarketBarProps) {
  const index = INDEX_STEPS[indexPosition] ?? INDEX_STEPS[2];
  const rate = RATE_STEPS[ratePosition] ?? RATE_STEPS[1];

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ledger-950/50">
            Market index
          </p>
          <p className="text-2xl font-semibold text-ledger-950">
            {index.value}{" "}
            <span className="text-xs font-normal uppercase tracking-wide text-ledger-950/50">
              {index.zone}
            </span>
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ledger-950/50">
            Interest rate
          </p>
          <p className="text-2xl font-semibold text-ledger-950">{rate.percent}%</p>
        </div>
      </div>

      {reckoningDrawn && (
        <p className="rounded-card bg-gold-400/20 px-3 py-2 text-center text-xs font-medium text-gold-600">
          THE RECKONING has been drawn — finish this round, play one more full round, then score.
        </p>
      )}
    </div>
  );
}
