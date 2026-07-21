import { useState } from "react";
import type { Company, GameDeed } from "@/types/game";
import type { Player } from "@/types/lobby";
import { currentMarketPrice, currentBuyback, landingFor, chainCountFor } from "@/lib/gameCalc";
import { assignCompany, sellToBank, developCompany, payLanding, GameApiError } from "@/lib/api/gameApi";
import { ErrorBanner } from "@/components/ErrorBanner";

interface CompanyRowProps {
  gameId: string;
  company: Company;
  deed: GameDeed;
  deeds: GameDeed[];
  companiesById: Map<number, Company>;
  players: Player[];
  playersById: Map<string, Player>;
  indexPosition: number;
}

const money = new Intl.NumberFormat("en-US");

const LEVEL_LABEL: Record<string, string> = {
  KIOSK: "Kiosk",
  SHOP: "Shop",
  CHAIN: "Chain",
  FIXED: "Utility",
};

export function CompanyRow({
  gameId,
  company,
  deed,
  deeds,
  companiesById,
  players,
  playersById,
  indexPosition,
}: CompanyRowProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const marketPrice = currentMarketPrice(company, indexPosition);
  const [buyerId, setBuyerId] = useState(players[0]?.id ?? "");
  const [buyPrice, setBuyPrice] = useState(String(marketPrice));
  const [payerId, setPayerId] = useState("");

  const owner = deed.ownerPlayerId ? playersById.get(deed.ownerPlayerId) : null;
  const chainOwned = deed.ownerPlayerId
    ? chainCountFor(deeds, companiesById, deed.ownerPlayerId, company.chainCode)
    : 0;

  const canDevelop = company.develops && deed.devLevel !== "CHAIN" && Boolean(owner);
  const developCost = deed.devLevel === "KIOSK" ? company.developCostShop : company.developCostChain;
  const buyback = currentBuyback(company, indexPosition);
  const landingPreview = deed.ownerPlayerId
    ? landingFor(company, deed, indexPosition, deeds, companiesById)
    : 0;

  const payerOptions = players.filter((p) => p.id !== deed.ownerPlayerId);

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

  return (
    <li className="rounded-card border border-ledger-900/10 bg-white/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div>
          <p className="text-sm font-medium text-ledger-950">{company.nameEn}</p>
          <p className="font-mono text-xs text-ledger-950/50">
            {owner ? `${owner.displayName} · ${LEVEL_LABEL[deed.devLevel]}` : "Bank-held"}
            {chainOwned >= 2 && ` · chain x${chainOwned}`}
          </p>
        </div>
        <p className="font-mono text-sm text-ledger-950/70">
          {owner ? money.format(landingPreview) : money.format(marketPrice)}
        </p>
      </button>

      {open && (
        <div className="flex flex-col gap-3 border-t border-ledger-900/10 px-4 py-3">
          {notice && <p className="text-xs text-ledger-950/60">{notice}</p>}
          <ErrorBanner message={error} />

          {!owner && players.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-ledger-950/50">
                Assign (buy at market, or record an auction result)
              </span>
              <div className="flex gap-2">
                <select
                  className="field-input flex-1"
                  value={buyerId}
                  onChange={(e) => setBuyerId(e.target.value)}
                >
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.displayName}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  className="field-input w-24"
                  value={buyPrice}
                  onChange={(e) => setBuyPrice(e.target.value)}
                />
                <button
                  className="btn-primary"
                  disabled={busy || !buyerId}
                  onClick={() =>
                    run(async () => {
                      await assignCompany(gameId, company.id, buyerId, Number(buyPrice) || 0);
                      setNotice(`Assigned to ${playersById.get(buyerId)?.displayName ?? "player"}`);
                    })
                  }
                >
                  Confirm
                </button>
              </div>
              <p className="text-[11px] text-ledger-950/40">Market price right now: {money.format(marketPrice)}</p>
            </div>
          )}

          {owner ? (
            <>
              {payerOptions.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-ledger-950/50">
                    Landing payment ({money.format(landingPreview)})
                  </span>
                  <div className="flex gap-2">
                    <select
                      className="field-input flex-1"
                      value={payerId}
                      onChange={(e) => setPayerId(e.target.value)}
                    >
                      <option value="">Who landed here?</option>
                      {payerOptions.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.displayName}
                        </option>
                      ))}
                    </select>
                    <button
                      className="btn-primary"
                      disabled={busy || !payerId}
                      onClick={() =>
                        run(async () => {
                          const amount = await payLanding(gameId, company.id, payerId);
                          setNotice(`Collected ${money.format(amount)} from ${playersById.get(payerId)?.displayName}`);
                          setPayerId("");
                        })
                      }
                    >
                      Collect
                    </button>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                {canDevelop && (
                  <button
                    className="btn-secondary flex-1"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        await developCompany(gameId, company.id);
                        setNotice(`Developed to ${deed.devLevel === "KIOSK" ? "Shop" : "Chain"}`);
                      })
                    }
                  >
                    Develop ({money.format(developCost ?? 0)})
                  </button>
                )}
                <button
                  className="btn-secondary flex-1"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await sellToBank(gameId, company.id);
                      setNotice(`Sold to the bank for ${money.format(buyback)}`);
                    })
                  }
                >
                  Sell to bank ({money.format(buyback)})
                </button>
              </div>
            </>
          ) : null}
        </div>
      )}
    </li>
  );
}
