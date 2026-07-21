import { useMemo, useState } from "react";
import type { GameState } from "../engine/types";
import { COMPANIES } from "../engine/companies";
import { currentBuyPrice, isAuctionGated } from "../engine/calc";
import { SPECIAL_PROJECT_IDS } from "../engine/types";
import type { GameEngine } from "../engine/useGameEngine";
import { playCashTransfer } from "../engine/sound";
import { useMoney } from "../engine/i18n";

interface AuctionPanelProps {
  state: GameState;
  engine: GameEngine;
}

/** Opening bid = 25% of sticker, rounded up to nearest 100. */
function openingBid(stickerPrice: number): number {
  return Math.ceil((stickerPrice * 0.25) / 100) * 100;
}

export function AuctionPanel({ state, engine }: AuctionPanelProps) {
  const { format } = useMoney();
  const deedByCompanyId = useMemo(() => new Map(state.deeds.map((d) => [d.companyId, d])), [state.deeds]);
  const playersById = useMemo(() => new Map(state.players.map((p) => [p.id, p])), [state.players]);

  // Bank-held deeds sorted by company ID (oldest / lowest ID first)
  const bankHeldDeeds = useMemo(
    () => state.deeds.filter((d) => !d.ownerId).sort((a, b) => a.companyId - b.companyId),
    [state.deeds],
  );

  const defaultCompanyId =
    bankHeldDeeds[0]?.companyId ?? COMPANIES[0]?.id ?? 0;

  const [companyId, setCompanyId] = useState<number>(defaultCompanyId);
  const [winnerId, setWinnerId] = useState<string>(
    state.currentPlayerId ?? state.players[0]?.id ?? "",
  );
  const [amount, setAmount] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const deed = deedByCompanyId.get(companyId);
  const currentOwner = deed?.ownerId ? playersById.get(deed.ownerId) : null;
  const company = COMPANIES.find((c) => c.id === companyId);
  const marketPrice = company ? currentBuyPrice(company, state) : 0;
  const minBid = company && !deed?.ownerId ? openingBid(company.stickerPrice) : 0;
  const gated = !deed?.ownerId && isAuctionGated(companyId, state);

  function handleAutoSelect() {
    if (bankHeldDeeds.length === 0) return;
    const oldest = bankHeldDeeds[0];
    setCompanyId(oldest.companyId);
    const co = COMPANIES.find((c) => c.id === oldest.companyId);
    if (co) setAmount(String(openingBid(co.stickerPrice)));
  }

  function handleAward() {
    const result = engine.awardAuction(companyId, winnerId, Number(amount) || 0);
    if (result.ok) {
      setNotice(
        `${playersById.get(winnerId)?.name} won ${company?.nameEn} for ${format(Number(amount) || 0)}` +
          (currentOwner ? ` (paid to ${currentOwner.name})` : " (paid to the bank)"),
      );
      setError(null);
      setAmount("");
      playCashTransfer();
      // Auto-advance to next bank deed
      const nextBankDeed = bankHeldDeeds.find((d) => d.companyId !== companyId);
      if (nextBankDeed) {
        setCompanyId(nextBankDeed.companyId);
        const nextCo = COMPANIES.find((c) => c.id === nextBankDeed.companyId);
        if (nextCo) setAmount(String(openingBid(nextCo.stickerPrice)));
      }
    } else {
      setError(result.message ?? "That didn't work.");
      setNotice(null);
    }
  }

  return (
    <div className="panel">
      <h2>Auction</h2>
      <p className="subtitle">
        Bidding happens out loud at the table — this records the result, moves cash and ownership.
        Works for bank-held or player-listed deeds.
      </p>

      {state.settings.enableLeak && <LeakAuctionBlock state={state} engine={engine} />}

      {/* Quick-select: oldest bank deed */}
      {bankHeldDeeds.length > 0 && (
        <div className="row" style={{ marginBottom: 10, padding: "8px 12px", background: "#f7f6f2", borderRadius: 4 }}>
          <span style={{ fontSize: "0.9em", color: "#555" }}>
            Bank holds <strong>{bankHeldDeeds.length}</strong> deed{bankHeldDeeds.length !== 1 ? "s" : ""} —
            oldest first: <strong>{COMPANIES.find((c) => c.id === bankHeldDeeds[0]?.companyId)?.nameEn}</strong>
            {bankHeldDeeds[0] &&
              (() => {
                const co = COMPANIES.find((c) => c.id === bankHeldDeeds[0].companyId);
                return co ? ` (opening bid ${format(openingBid(co.stickerPrice))})` : "";
              })()}
          </span>
          <button className="secondary" onClick={handleAutoSelect}>
            Use oldest bank deed
          </button>
        </div>
      )}

      <div className="row">
        <label>
          Deed:{" "}
          <select value={companyId} onChange={(e) => setCompanyId(Number(e.target.value))}>
            {COMPANIES.map((c) => {
              const d = deedByCompanyId.get(c.id);
              const owner = d?.ownerId ? playersById.get(d.ownerId)?.name : "Bank";
              const locked = !d?.ownerId && SPECIAL_PROJECT_IDS.has(c.id) && isAuctionGated(c.id, state);
              return (
                <option key={c.id} value={c.id}>
                  {c.nameEn} — {owner}{locked ? " (locked until the board sells out)" : ""}
                </option>
              );
            })}
          </select>
        </label>
        <span className="badge">Currently: {currentOwner ? currentOwner.name : "Bank"}</span>
      </div>

      {gated && (
        <p className="error" style={{ marginTop: 6 }}>
          🔒 The Compound in Sheikh Zayed isn't eligible for auction yet — it unlocks the moment every
          other company on the board has an owner (rulebook §15).
        </p>
      )}

      {/* Price info row */}
      <div className="row" style={{ marginTop: 6, fontSize: "0.88em", color: "#555" }}>
        {company && (
          <>
            <span>Sticker: <strong>{format(company.stickerPrice)}</strong></span>
            <span>Market price: <strong>{format(marketPrice)}</strong></span>
            {!currentOwner && (
              <span style={{ color: "#b85c00" }}>
                Opening bid (25%): <strong>{format(minBid)}</strong>
              </span>
            )}
          </>
        )}
      </div>

      <div className="row" style={{ marginTop: 10 }}>
        <label>
          Winner:{" "}
          <select value={winnerId} onChange={(e) => setWinnerId(e.target.value)}>
            {state.players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <input
          type="number"
          min={0}
          placeholder="Winning bid"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <button className="primary" onClick={handleAward} disabled={!winnerId || !amount || gated}>
          Award deed
        </button>
      </div>

      {notice && <p className="notice">{notice}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The Leak (feedback item #3, experimental) — a one-of-a-kind auction lot,
// separate from the 30 deeds: sold once, ever, then only usable, never
// resold. "Sold by open auction; let the table price it."
// ---------------------------------------------------------------------------

function LeakAuctionBlock({ state, engine }: AuctionPanelProps) {
  const { format } = useMoney();
  const [winnerId, setWinnerId] = useState<string>(state.currentPlayerId ?? state.players[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const playersById = useMemo(() => new Map(state.players.map((p) => [p.id, p])), [state.players]);

  if (state.leak.ownerId !== null) {
    const owner = playersById.get(state.leak.ownerId);
    return (
      <div className="row" style={{ marginBottom: 10, padding: "8px 12px", background: "#f3eefa", borderRadius: 4 }}>
        <span style={{ fontSize: "0.9em", color: "#4a1a8c" }}>
          🕵️ The Leak (التسريب) — claimed by <strong>{owner?.name ?? "?"}</strong>
          {state.leak.used ? " (already used)" : " (not yet used)"}.
        </span>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 14, padding: "10px 12px", background: "#f3eefa", borderRadius: 4 }}>
      <div className="row" style={{ marginBottom: 6 }}>
        <span style={{ fontSize: "0.9em", color: "#4a1a8c" }}>
          🕵️ <strong>The Leak (التسريب)</strong> — one-of-a-kind, single-use: reveals the next news card
          before it's drawn. Not resold once claimed; the holder wears a visible "insider" badge.
        </span>
      </div>
      <div className="row">
        <label>
          Winner:{" "}
          <select value={winnerId} onChange={(e) => setWinnerId(e.target.value)}>
            {state.players.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        <input
          type="number"
          min={0}
          placeholder="Winning bid"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <button
          onClick={() => {
            const r = engine.awardLeak(winnerId, Number(amount) || 0);
            if (r.ok) {
              setNotice(`${playersById.get(winnerId)?.name} won The Leak for ${format(Number(amount) || 0)}`);
              setError(null);
              setAmount("");
              playCashTransfer();
            } else {
              setError(r.message ?? "That didn't work.");
              setNotice(null);
            }
          }}
          disabled={!winnerId || !amount}
        >
          Award The Leak
        </button>
      </div>
      {notice && <p className="notice">{notice}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
