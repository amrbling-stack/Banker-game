import { useEffect, useRef, useState } from "react";
import { INDEX_STEPS, RATE_STEPS, ZONE_LABELS_AR } from "../engine/types";
import type { GameState } from "../engine/types";
import type { GameEngine } from "../engine/useGameEngine";
import { useLang, useMoney, type StringKey } from "../engine/i18n";
import { isMuted, setMuted, playReckoningAlarm } from "../engine/sound";

interface MarketBarProps {
  state: GameState;
  engine: GameEngine;
}

function delta(curr: number, prev: number | null) {
  if (prev === null || prev === curr) return null;
  return curr > prev ? "up" : "down";
}

export function MarketBar({ state, engine }: MarketBarProps) {
  const { t, toggleLang, arabicNumerals, toggleNumerals } = useLang();
  const { format } = useMoney();
  const index = INDEX_STEPS[state.indexPosition] ?? INDEX_STEPS[2];
  const rate = RATE_STEPS[state.ratePosition] ?? RATE_STEPS[1];

  // Track previous values to show movement arrows on the ticker
  const prevIndexPos = useRef<number | null>(null);
  const prevRatePos = useRef<number | null>(null);
  const [indexDelta, setIndexDelta] = useState<"up" | "down" | null>(null);
  const [rateDelta, setRateDelta] = useState<"up" | "down" | null>(null);
  const [muted, setMutedState] = useState(() => isMuted());

  useEffect(() => {
    const di = delta(state.indexPosition, prevIndexPos.current);
    const dr = delta(state.ratePosition, prevRatePos.current);
    if (di) setIndexDelta(di);
    if (dr) setRateDelta(dr);
    prevIndexPos.current = state.indexPosition;
    prevRatePos.current = state.ratePosition;
    // Clear arrows after 4 seconds
    const t = setTimeout(() => { setIndexDelta(null); setRateDelta(null); }, 4000);
    return () => clearTimeout(t);
  }, [state.indexPosition, state.ratePosition]);

  // Fire the Reckoning alarm exactly once, the moment it's drawn.
  const reckoningAnnounced = useRef(false);
  useEffect(() => {
    if (state.reckoningDrawn && !reckoningAnnounced.current) {
      reckoningAnnounced.current = true;
      playReckoningAlarm();
    }
    if (!state.reckoningDrawn) reckoningAnnounced.current = false;
  }, [state.reckoningDrawn]);

  const canUndo = engine.undoStack.length > 0;

  function handleToggleMute() {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  }

  return (
    <div className="panel market-bar">
      {/* ── Row 1: Title + controls ── */}
      <div className="spread">
        <div>
          <h1>رأس المال — Ras El-Mal</h1>
          <p className="subtitle">
            {t("appTitle")} · {state.players.length} {t("subtitlePlayers")} · {t("currencyLabel")}
          </p>
        </div>
        <div className="row">
          <button className="secondary" onClick={toggleLang} title="Switch language / تبديل اللغة">
            {t("language")}
          </button>
          <button className="secondary" onClick={toggleNumerals} title={t("numeralsToggleTitle")}>
            {arabicNumerals ? t("numeralsArabic") : t("numeralsWestern")}
          </button>
          <button className="secondary" onClick={handleToggleMute} title="Toggle sound effects">
            {muted ? t("soundOff") : t("soundOn")}
          </button>
          <button
            className="secondary"
            onClick={engine.undo}
            disabled={!canUndo}
            title={canUndo ? `Undo last action (${engine.undoStack.length} available)` : "Nothing to undo"}
          >
            {t("undo")}
          </button>
          <button className="info" onClick={engine.finishGame}>
            {t("endGame")}
          </button>
          <button className="danger" onClick={engine.resetToSetup}>
            {t("resetGame")}
          </button>
        </div>
      </div>

      {/* ── Row 2: Market ticker ── */}
      <div className="ticker-row">
        <TickerCell
          label={t("marketIndex")}
          value={String(index.value)}
          sub={ZONE_LABELS_AR[index.zone] + " · " + index.zone}
          direction={indexDelta}
          highlight={index.zone === "BOOM" ? "gold" : index.zone === "RECESSION" ? "red" : undefined}
        />
        <TickerCell
          label={t("interestRate")}
          value={rate.percent + "%"}
          sub={`${format(rate.interestPerNote)} ${t("perNotePerLap")}`}
          direction={rateDelta}
          highlight={rateDelta === "up" ? "red" : rateDelta === "down" ? "green" : undefined}
        />
        <div className="ticker-cell">
          <span className="ticker-label">{t("newsDeck")}</span>
          <span className="ticker-value">{state.newsQueue.length}</span>
          <span className="ticker-sub">{t("cardsLeft")}</span>
        </div>
        {state.reckoningDrawn && (
          <ReckoningCell countdown={state.reckoningTurnCountdown} t={t} />
        )}
      </div>

      {/* ── Row 3: Turn controls ── */}
      <div className="row" style={{ marginTop: 10 }}>
        <label>
          {t("currentPlayer")}{" "}
          <select
            value={state.currentPlayerId ?? ""}
            onChange={(e) => engine.setCurrentPlayer(e.target.value)}
          >
            {state.players.map((p) => (
              <option key={p.id} value={p.id}>
                Seat {p.seat} · {p.name}
              </option>
            ))}
          </select>
        </label>
        <button className="secondary" onClick={engine.nextPlayer}>
          {t("nextTurn")}
        </button>
        <button className="primary" onClick={engine.drawNews}>
          {t("drawNews")}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface TickerCellProps {
  label: string;
  value: string;
  sub: string;
  direction?: "up" | "down" | null;
  highlight?: "gold" | "red" | "green";
}

function TickerCell({ label, value, sub, direction, highlight }: TickerCellProps) {
  const arrow = direction === "up" ? " ▲" : direction === "down" ? " ▼" : "";
  const arrowColor = direction === "up" ? "#2e7d32" : "#b3261e";
  const bg =
    highlight === "gold" ? "#fff8e6" :
    highlight === "red"  ? "#fef0f0" :
    highlight === "green"? "#f0fef4" :
    "#f7f6f2";

  return (
    <div className="ticker-cell" style={{ background: bg }}>
      <span className="ticker-label">{label}</span>
      <span className="ticker-value">
        {value}
        {arrow && <span style={{ color: arrowColor, fontSize: "0.7em", marginLeft: 2 }}>{arrow}</span>}
      </span>
      <span className="ticker-sub">{sub}</span>
    </div>
  );
}

function ReckoningCell({ countdown, t }: { countdown: number | null; t: (key: StringKey) => string }) {
  if (countdown === null) {
    return (
      <div className="ticker-cell reckoning-cell">
        <span className="ticker-label">{t("reckoning")}</span>
        <span className="ticker-value">⏳</span>
        <span className="ticker-sub">Finish round + 1 more</span>
      </div>
    );
  }
  if (countdown <= 0) {
    return (
      <div className="ticker-cell reckoning-cell reckoning-end">
        <span className="ticker-label">{t("timeToScore")}</span>
        <span className="ticker-value" style={{ fontSize: "1.4em" }}>🏁</span>
        <span className="ticker-sub">Click End game &amp; score</span>
      </div>
    );
  }
  return (
    <div className="ticker-cell reckoning-cell">
      <span className="ticker-label">⏳ {t("reckoning")}</span>
      <span className="ticker-value" style={{ fontSize: "2em" }}>{countdown}</span>
      <span className="ticker-sub">{t("turnsRemaining")}</span>
    </div>
  );
}
