import type { Player } from "@/types/lobby";

interface PlayerSeatRowProps {
  player: Player;
  isYou: boolean;
}

const currencyFormatter = new Intl.NumberFormat("en-US");

export function PlayerSeatRow({ player, isYou }: PlayerSeatRowProps) {
  return (
    <li className="flex items-center justify-between rounded-card border border-ledger-900/10 bg-white/60 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ledger-900 font-mono text-sm text-parchment-50">
          {player.seatNumber}
        </span>
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-ledger-950">
            {player.displayName}
            {isYou && (
              <span className="rounded-full bg-gold-400/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gold-600">
                You
              </span>
            )}
            {player.isHost && (
              <span className="rounded-full bg-ledger-900/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ledger-900">
                Host
              </span>
            )}
          </p>
          <p className="font-mono text-xs text-ledger-950/50">
            Starts with {currencyFormatter.format(player.startingCash)}
          </p>
        </div>
      </div>
    </li>
  );
}
