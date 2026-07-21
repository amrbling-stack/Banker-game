import { useState } from "react";
import type { Player } from "@/types/lobby";
import { NEWS_CARD_LABELS } from "@/types/game";
import {
  collectGo,
  payTax,
  takeLoan,
  repayLoan,
  payBank,
  tradeCash,
  GameApiError,
} from "@/lib/api/gameApi";
import { ErrorBanner } from "@/components/ErrorBanner";

interface PlayerCardProps {
  gameId: string;
  player: Player;
  otherPlayers: Player[];
}

const money = new Intl.NumberFormat("en-US");

export function PlayerCard({ gameId, player, otherPlayers }: PlayerCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [loanNotes, setLoanNotes] = useState("1");
  const [repayNotes, setRepayNotes] = useState("1");
  const [bankAmount, setBankAmount] = useState("");
  const [bankLabel, setBankLabel] = useState("");
  const [transferTo, setTransferTo] = useState(otherPlayers[0]?.id ?? "");
  const [transferAmount, setTransferAmount] = useState("");

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof GameApiError ? err.message : "that didn't work");
    } finally {
      setBusy(false);
    }
  }

  async function handleGo() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await collectGo(gameId, player.id);
      const parts: string[] = [];
      if (result.news_code) {
        parts.push(NEWS_CARD_LABELS[result.news_code] ?? result.news_code);
      } else if (result.deck_empty) {
        parts.push("No news cards left in the deck");
      }
      if (result.dividend_total) parts.push(`Dividends +${money.format(result.dividend_total)}`);
      if (result.interest_total) parts.push(`Interest −${money.format(result.interest_total)}`);
      setNotice(parts.join(" · ") || "Nothing to collect");
    } catch (err) {
      setError(err instanceof GameApiError ? err.message : "that didn't work");
    } finally {
      setBusy(false);
    }
  }

  async function handleTax() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const amount = await payTax(gameId, player.id);
      setNotice(amount ? `Paid ${money.format(amount)} tax` : "No tax owed (no cash on hand)");
    } catch (err) {
      setError(err instanceof GameApiError ? err.message : "that didn't work");
    } finally {
      setBusy(false);
    }
  }

  const cashClass = player.cash < 0 ? "text-rose-600" : "text-ledger-950";

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-ledger-950">
            {player.displayName}
            {player.isHost && (
              <span className="ml-2 rounded-full bg-ledger-900/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ledger-900">
                Host
              </span>
            )}
          </p>
          <p className="font-mono text-xs text-ledger-950/50">
            {player.loanNotes > 0 ? `${player.loanNotes} loan note(s)` : "No loans"}
          </p>
        </div>
        <p className={`font-mono text-xl font-semibold ${cashClass}`}>{money.format(player.cash)}</p>
      </div>

      <div className="flex gap-2">
        <button className="btn-primary flex-1" onClick={handleGo} disabled={busy}>
          GO
        </button>
        <button className="btn-secondary flex-1" onClick={handleTax} disabled={busy}>
          Pay tax
        </button>
        <button
          type="button"
          className="btn-secondary px-3"
          onClick={() => setExpanded((v) => !v)}
          aria-label="More actions"
        >
          {expanded ? "–" : "+"}
        </button>
      </div>

      {notice && <p className="text-xs text-ledger-950/60">{notice}</p>}
      <ErrorBanner message={error} />

      {expanded && (
        <div className="flex flex-col gap-4 border-t border-ledger-900/10 pt-3">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-ledger-950/50">Loan</span>
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                className="field-input w-20"
                value={loanNotes}
                onChange={(e) => setLoanNotes(e.target.value)}
              />
              <button
                className="btn-secondary flex-1"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await takeLoan(gameId, player.id, Number(loanNotes) || 0);
                    setNotice(`Took ${loanNotes} loan note(s)`);
                  })
                }
              >
                Take ({Number(loanNotes) * 5000 || 0})
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                className="field-input w-20"
                value={repayNotes}
                onChange={(e) => setRepayNotes(e.target.value)}
              />
              <button
                className="btn-secondary flex-1"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await repayLoan(gameId, player.id, Number(repayNotes) || 0);
                    setNotice(`Repaid ${repayNotes} loan note(s)`);
                  })
                }
              >
                Repay ({Number(repayNotes) * 5000 || 0})
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-ledger-950/50">
              Pay the bank
            </span>
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                placeholder="Amount"
                className="field-input w-24"
                value={bankAmount}
                onChange={(e) => setBankAmount(e.target.value)}
              />
              <input
                type="text"
                placeholder="What for (e.g. Gov. Window)"
                className="field-input flex-1"
                value={bankLabel}
                onChange={(e) => setBankLabel(e.target.value)}
              />
              <button
                className="btn-secondary"
                disabled={busy || !bankAmount}
                onClick={() =>
                  run(async () => {
                    await payBank(gameId, player.id, Number(bankAmount) || 0, bankLabel || undefined);
                    setNotice(`Paid ${money.format(Number(bankAmount))} to the bank`);
                    setBankAmount("");
                    setBankLabel("");
                  })
                }
              >
                Pay
              </button>
            </div>
          </div>

          {otherPlayers.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-ledger-950/50">
                Pay another player
              </span>
              <div className="flex gap-2">
                <select
                  className="field-input flex-1"
                  value={transferTo}
                  onChange={(e) => setTransferTo(e.target.value)}
                >
                  {otherPlayers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.displayName}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  placeholder="Amount"
                  className="field-input w-24"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                />
                <button
                  className="btn-secondary"
                  disabled={busy || !transferAmount || !transferTo}
                  onClick={() =>
                    run(async () => {
                      await tradeCash(gameId, player.id, transferTo, Number(transferAmount) || 0);
                      setNotice(`Paid ${money.format(Number(transferAmount))}`);
                      setTransferAmount("");
                    })
                  }
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
