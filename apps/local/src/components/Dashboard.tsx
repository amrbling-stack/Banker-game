import { useEffect, useMemo, useState } from "react";
import type { GameState } from "../engine/types";
import { COMPANIES } from "../engine/companies";
import { NEWS_CARD_LABELS } from "../engine/types";
import type { GameEngine } from "../engine/useGameEngine";
import { MarketBar } from "./MarketBar";
import { PlayersPanel } from "./PlayersPanel";
import { PropertiesPanel } from "./PropertiesPanel";
import { AuctionPanel } from "./AuctionPanel";
import { NewsModal } from "./NewsModal";
import { EventLogPanel } from "./EventLogPanel";
import { useLang, useMoney } from "../engine/i18n";
import { playNewsSting } from "../engine/sound";

type Tab = "players" | "properties" | "auction" | "log";

interface DashboardProps {
  state: GameState;
  engine: GameEngine;
}

export function Dashboard({ state, engine }: DashboardProps) {
  const [tab, setTab] = useState<Tab>("players");
  const { t } = useLang();
  const { format } = useMoney();

  // Count deeds per player for the status bar
  const deedCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of state.deeds) {
      if (d.ownerId) counts.set(d.ownerId, (counts.get(d.ownerId) ?? 0) + 1);
    }
    return counts;
  }, [state.deeds]);

  // News-card sting plays exactly once per drawn card, whenever the modal appears.
  useEffect(() => {
    if (engine.lastNewsCode) playNewsSting();
  }, [engine.lastNewsCode]);

  const gulfOfferCompany = state.pendingGulfOffer
    ? COMPANIES.find((c) => c.id === state.pendingGulfOffer!.companyId)
    : null;
  const gulfOfferPlayer = state.pendingGulfOffer
    ? state.players.find((p) => p.id === state.pendingGulfOffer!.playerId)
    : null;

  return (
    <div className="page">
      <MarketBar state={state} engine={engine} />

      {/* Always-visible player status bar */}
      <div className="status-bar">
        {state.players.map((p) => {
          const isCurrent = p.id === state.currentPlayerId;
          const deeds = deedCounts.get(p.id) ?? 0;
          const isInsider = state.settings.enableLeak && state.leak.ownerId === p.id;
          return (
            <div
              key={p.id}
              className={"status-card" + (isCurrent ? " status-card--current" : "")}
              title={`Seat ${p.seat} · ${p.name}`}
            >
              <div className="status-name">
                {isCurrent && <span className="status-turn-dot" title="Current turn" />}
                {p.name}
                {isInsider && (
                  <span title={state.leak.used ? "Held The Leak (used)" : "Holds The Leak"} style={{ marginLeft: 4 }}>
                    🕵️
                  </span>
                )}
              </div>
              <div className={`status-cash${p.cash < 0 ? " negative" : ""}`}>{format(p.cash)}</div>
              <div className="status-meta">
                {deeds > 0 && <span title="Deeds owned">🏢 {deeds}</span>}
                {p.loanNotes > 0 && (
                  <span title="Loan notes outstanding" style={{ color: "#b85c00" }}>
                    🎫 {p.loanNotes}
                  </span>
                )}
                {(p.goldUnits ?? 0) > 0 && (
                  <span title="Gold units held" style={{ color: "#b8960c" }}>
                    🪙 {p.goldUnits}
                  </span>
                )}
                {p.skipNextDividend && (
                  <span title="Distributions forfeited this lap" style={{ color: "#b3261e" }}>⚠</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="tabs">
        <button className={tab === "players" ? "active" : ""} onClick={() => setTab("players")}>
          {t("tabPlayers")}
        </button>
        <button className={tab === "properties" ? "active" : ""} onClick={() => setTab("properties")}>
          {t("tabProperties")}
        </button>
        <button className={tab === "auction" ? "active" : ""} onClick={() => setTab("auction")}>
          {t("tabAuction")}
        </button>
        <button className={tab === "log" ? "active" : ""} onClick={() => setTab("log")}>
          {t("tabLog")}
        </button>
      </div>

      {tab === "players" && <PlayersPanel state={state} engine={engine} />}
      {tab === "properties" && <PropertiesPanel state={state} engine={engine} />}
      {tab === "auction" && <AuctionPanel state={state} engine={engine} />}
      {tab === "log" && <EventLogPanel state={state} />}

      {/* News modal — shown whenever a card is drawn */}
      {engine.lastNewsCode && (
        <NewsModal code={engine.lastNewsCode} onDismiss={engine.dismissNews} />
      )}

      {/* The Leak reveal — shown once, right after it's spent */}
      {engine.lastLeakReveal && (
        <div className="modal-backdrop" onClick={engine.dismissLeakReveal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon" style={{ color: "#4a1a8c" }}>🕵️</div>
            <h2 className="modal-title" style={{ color: "#4a1a8c" }}>The Leak</h2>
            <p className="modal-effect">
              Next card is: <strong>{NEWS_CARD_LABELS[engine.lastLeakReveal] ?? engine.lastLeakReveal}</strong>
              <br />
              <span style={{ fontSize: "0.85em", color: "#888" }}>
                Shown to whoever's looking at this screen — that's the deal with one shared display.
              </span>
            </p>
            <button className="modal-dismiss" onClick={engine.dismissLeakReveal}>
              Got it — continue
            </button>
          </div>
        </div>
      )}

      {/* Compound in Sheikh Zayed unlock — fires once, the moment the board sells out */}
      {state.nationalProjectJustUnlocked && (
        <div className="modal-backdrop" onClick={engine.dismissNationalProjectUnlock}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon" style={{ color: "#8a6a2a" }}>🏛</div>
            <h2 className="modal-title" style={{ color: "#8a6a2a" }}>The board has sold out</h2>
            <p className="modal-effect">
              Every company on the board now has an owner. The Compound in Sheikh Zayed is open for
              auction — head to the Auction tab whenever someone wants to call it.
            </p>
            <button className="modal-dismiss" onClick={engine.dismissNationalProjectUnlock}>
              Got it — continue
            </button>
          </div>
        </div>
      )}

      {/* Gulf investor personal offer (experimental, item #16) — a public dilemma */}
      {state.pendingGulfOffer && gulfOfferCompany && gulfOfferPlayer && (
        <div className="modal-backdrop">
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon" style={{ color: "#1a4a8c" }}>🤝</div>
            <h2 className="modal-title" style={{ color: "#1a4a8c" }}>Gulf investor calls {gulfOfferPlayer.name}</h2>
            <p className="modal-effect">
              {format(state.pendingGulfOffer.price)} for {gulfOfferCompany.nameEn} ({gulfOfferCompany.nameAr})
              — accept or decline?
            </p>
            <div className="row" style={{ justifyContent: "center" }}>
              <button className="success" onClick={engine.acceptGulfOffer}>Accept</button>
              <button className="secondary" onClick={engine.declineGulfOffer}>Decline</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
