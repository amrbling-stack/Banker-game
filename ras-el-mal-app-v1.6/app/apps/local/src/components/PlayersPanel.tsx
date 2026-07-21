import { useState } from "react";
import type { GameState } from "../engine/types";
import { computeScoring, goldBuyPrice, goldSellPrice, GOLD_UNIT_CAP } from "../engine/calc";
import type { ActionResult, GameEngine } from "../engine/useGameEngine";
import { NEWS_CARD_LABELS } from "../engine/types";
import { playCashTransfer } from "../engine/sound";
import { useMoney } from "../engine/i18n";

interface PlayersPanelProps {
  state: GameState;
  engine: GameEngine;
}

export function PlayersPanel({ state, engine }: PlayersPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const scoring = computeScoring(state.players, state.deeds, state.indexPosition);
  const scoreByPlayer = new Map(scoring.map((s) => [s.playerId, s]));

  const canUndo = engine.undoStack.length > 0;

  return (
    <div className="panel">
      <div className="spread" style={{ marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>Players &amp; Bank</h2>
        <button
          className="secondary"
          onClick={engine.undo}
          disabled={!canUndo}
          title={canUndo ? `Undo last action (${engine.undoStack.length} available)` : "Nothing to undo"}
          style={{ fontSize: "0.85em" }}
        >
          ↩ Undo last action
        </button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Seat</th>
            <th>Name</th>
            <th>Cash</th>
            <th>Loan notes</th>
            <th>Debt</th>
            <th>Net worth (est.)</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {state.players.map((player) => {
            const score = scoreByPlayer.get(player.id);
            const isExpanded = expandedId === player.id;
            const isCurrent = state.currentPlayerId === player.id;
            return (
              <PlayerRows
                key={player.id}
                playerId={player.id}
                playerName={player.name}
                seat={player.seat}
                cash={player.cash}
                loanNotes={player.loanNotes}
                goldUnits={player.goldUnits ?? 0}
                netWorth={score?.netWorth ?? 0}
                isCurrent={isCurrent}
                isExpanded={isExpanded}
                skipNextDividend={player.skipNextDividend ?? false}
                otherPlayers={state.players.filter((p) => p.id !== player.id)}
                onToggle={() => setExpandedId(isExpanded ? null : player.id)}
                engine={engine}
                indexPosition={state.indexPosition}
                settings={state.settings}
                leakOwnerId={state.leak.ownerId}
                leakUsed={state.leak.used}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface PlayerRowsProps {
  playerId: string;
  playerName: string;
  seat: number;
  cash: number;
  loanNotes: number;
  goldUnits: number;
  netWorth: number;
  isCurrent: boolean;
  isExpanded: boolean;
  skipNextDividend: boolean;
  otherPlayers: { id: string; name: string }[];
  onToggle: () => void;
  engine: GameEngine;
  indexPosition: number;
  settings: GameState["settings"];
  leakOwnerId: string | null;
  leakUsed: boolean;
}

function PlayerRows({
  playerId,
  playerName,
  seat,
  cash,
  loanNotes,
  goldUnits,
  netWorth,
  isCurrent,
  isExpanded,
  skipNextDividend,
  otherPlayers,
  onToggle,
  engine,
  indexPosition,
  settings,
  leakOwnerId,
  leakUsed,
}: PlayerRowsProps) {
  const { format } = useMoney();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [loanNoteCount, setLoanNoteCount] = useState("1");
  const [repayNoteCount, setRepayNoteCount] = useState("1");
  const [transferTo, setTransferTo] = useState(otherPlayers[0]?.id ?? "");
  const [transferAmount, setTransferAmount] = useState("");
  const [goldUnitsInput, setGoldUnitsInput] = useState("1");
  // Propose-and-confirm (item #19): the app computes the transfer and states
  // it plainly before anything moves, rather than firing on the first tap.
  const [pendingTransfer, setPendingTransfer] = useState(false);

  function report(result: ActionResult, successText: string) {
    if (result.ok) {
      setNotice(successText);
      setError(null);
    } else {
      setError(result.message ?? "That didn't work.");
      setNotice(null);
    }
  }

  function handleGo() {
    const result = engine.collectGo(playerId);
    const parts: string[] = [];
    if (result.code) parts.push(NEWS_CARD_LABELS[result.code] ?? result.code);
    else parts.push("No news cards left in the deck");
    if (result.dividend) parts.push(`Distributions +${format(result.dividend)}`);
    if (result.interest) parts.push(`Interest −${format(result.interest)}`);
    setNotice(parts.join(" · "));
    setError(null);
    if (result.dividend || result.interest) playCashTransfer();
  }

  function handleTax() {
    const amount = engine.payTax(playerId);
    setNotice(amount ? `Paid ${format(amount)} tax` : "No tax owed");
    setError(null);
    if (amount) playCashTransfer();
  }

  const goldBuy = goldBuyPrice(indexPosition);
  const goldSell = goldSellPrice(indexPosition);
  const isInsider = settings.enableLeak && leakOwnerId === playerId;

  return (
    <>
      <tr style={isCurrent ? { background: "#fff8e6" } : undefined}>
        <td>{seat}</td>
        <td>
          {playerName}{" "}
          {isCurrent && <span className="badge gold">Current</span>}
          {isInsider && (
            <span className="badge" style={{ background: "#4a1a8c", color: "#fff", marginLeft: 4 }} title={leakUsed ? "Held The Leak (used)" : "Holds The Leak"}>
              🕵️ Insider
            </span>
          )}
          {skipNextDividend && (
            <span className="badge" style={{ background: "#b85c00", color: "#fff", marginLeft: 4 }}>
              Distributions forfeited
            </span>
          )}
        </td>
        <td className={cash < 0 ? "negative" : undefined}>{format(cash)}</td>
        <td>{loanNotes}</td>
        <td>{format(loanNotes * 5000)}</td>
        <td>{format(netWorth)}</td>
        <td>
          <button className="secondary" onClick={onToggle}>
            {isExpanded ? "Hide" : "Actions"}
          </button>
        </td>
      </tr>

      {isExpanded && (
        <tr className="expand-row">
          <td colSpan={7}>
            <div className="row" style={{ marginBottom: 10 }}>
              <button className="success" onClick={handleGo}>GO — draw news, pay dividends, charge interest</button>
              <button className="warning" onClick={handleTax}>
                Pay 10% tax
              </button>
            </div>

            {notice && <p className="notice">{notice}</p>}
            {error && <p className="error">{error}</p>}

            <div className="row">
              <span>Bank → Player:</span>
              <input
                type="number"
                min={1}
                placeholder="Amount"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
              />
              <button
                className="secondary"
                onClick={() => {
                  engine.deposit(playerId, Number(depositAmount) || 0, "Bank deposit");
                  setNotice(`Deposited ${format(Number(depositAmount) || 0)}`);
                  setDepositAmount("");
                  playCashTransfer();
                }}
              >
                Deposit
              </button>
            </div>

            <div className="row">
              <span>Player → Bank:</span>
              <input
                type="number"
                min={1}
                placeholder="Amount"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
              />
              <button
                className="secondary"
                onClick={() => {
                  engine.withdraw(playerId, Number(withdrawAmount) || 0, "Bank payment");
                  setNotice(`Paid ${format(Number(withdrawAmount) || 0)} to the bank`);
                  setWithdrawAmount("");
                  playCashTransfer();
                }}
              >
                Withdraw
              </button>
            </div>

            {otherPlayers.length > 0 && (
              <div className="row" style={{ flexWrap: "wrap" }}>
                <span>Pay another player:</span>
                <select
                  value={transferTo}
                  onChange={(e) => {
                    setTransferTo(e.target.value);
                    setPendingTransfer(false);
                  }}
                  disabled={pendingTransfer}
                >
                  {otherPlayers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  placeholder="Amount"
                  value={transferAmount}
                  onChange={(e) => {
                    setTransferAmount(e.target.value);
                    setPendingTransfer(false);
                  }}
                  disabled={pendingTransfer}
                />
                {!pendingTransfer ? (
                  <button
                    className="secondary"
                    disabled={!transferTo || !(Number(transferAmount) > 0)}
                    onClick={() => setPendingTransfer(true)}
                  >
                    Send
                  </button>
                ) : (
                  <>
                    <span className="notice" style={{ margin: 0 }}>
                      {playerName} pays {format(Number(transferAmount) || 0)} to{" "}
                      {otherPlayers.find((p) => p.id === transferTo)?.name} — confirm?
                    </span>
                    <button
                      onClick={() => {
                        engine.transfer(playerId, transferTo, Number(transferAmount) || 0, "Player transfer");
                        setNotice(
                          `Paid ${format(Number(transferAmount) || 0)} to ${
                            otherPlayers.find((p) => p.id === transferTo)?.name
                          }`,
                        );
                        setTransferAmount("");
                        setPendingTransfer(false);
                        playCashTransfer();
                      }}
                    >
                      Confirm
                    </button>
                    <button className="secondary" onClick={() => setPendingTransfer(false)}>
                      Cancel
                    </button>
                  </>
                )}
              </div>
            )}

            <div className="row">
              <span>Loan:</span>
              <input
                type="number"
                min={1}
                value={loanNoteCount}
                onChange={(e) => setLoanNoteCount(e.target.value)}
              />
              <button
                className="secondary"
                onClick={() =>
                  report(
                    engine.takeLoan(playerId, Number(loanNoteCount) || 0),
                    `Took ${loanNoteCount} note(s) (${format((Number(loanNoteCount) || 0) * 5000)})`,
                  )
                }
              >
                Take note(s)
              </button>
              <input
                type="number"
                min={1}
                value={repayNoteCount}
                onChange={(e) => setRepayNoteCount(e.target.value)}
              />
              <button
                className="secondary"
                onClick={() =>
                  report(
                    engine.repayLoan(playerId, Number(repayNoteCount) || 0),
                    `Repaid ${repayNoteCount} note(s)`,
                  )
                }
              >
                Repay note(s)
              </button>
            </div>

            <div className="row" style={{ borderTop: "1px solid #e0ddd0", paddingTop: 8, marginTop: 4 }}>
              <span style={{ fontSize: "0.85em", color: "#666" }}>
                Distressed swap — cancel 1 note, forfeit next GO dividends:
              </span>
              <button
                className="secondary"
                style={{ color: "#b85c00" }}
                onClick={() =>
                  report(
                    engine.distressedSwap(playerId),
                    "Distressed swap: 1 note cancelled. Distributions forfeited at next GO.",
                  )
                }
              >
                Swap note for dividends
              </button>
            </div>

            {settings.enableGold && (
              <div className="row" style={{ borderTop: "1px solid #e0ddd0", paddingTop: 8, marginTop: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.85em", color: "#666" }}>
                  🪙 Gold — {goldUnits}/{GOLD_UNIT_CAP} held. Buy {format(goldBuy)} · Sell {format(goldSell)}.
                  Bank trades only, on your turn:
                </span>
                {isCurrent ? (
                  <>
                    <input
                      type="number"
                      min={1}
                      max={GOLD_UNIT_CAP}
                      value={goldUnitsInput}
                      onChange={(e) => setGoldUnitsInput(e.target.value)}
                      style={{ width: 60 }}
                    />
                    <button
                      className="secondary"
                      onClick={() =>
                        report(
                          engine.buyGold(playerId, Number(goldUnitsInput) || 0),
                          `Bought ${goldUnitsInput} unit(s) of gold for ${format(goldBuy * (Number(goldUnitsInput) || 0))}`,
                        )
                      }
                    >
                      Buy gold
                    </button>
                    <button
                      className="secondary"
                      onClick={() =>
                        report(
                          engine.sellGold(playerId, Number(goldUnitsInput) || 0),
                          `Sold ${goldUnitsInput} unit(s) of gold for ${format(goldSell * (Number(goldUnitsInput) || 0))}`,
                        )
                      }
                    >
                      Sell gold
                    </button>
                  </>
                ) : (
                  <span style={{ fontSize: "0.8em", color: "#999" }}>Only on this player's turn</span>
                )}
              </div>
            )}

            {settings.enableLeak && isInsider && !leakUsed && (
              <div className="row" style={{ borderTop: "1px solid #e0ddd0", paddingTop: 8, marginTop: 8 }}>
                <span style={{ fontSize: "0.85em", color: "#666" }}>
                  🕵️ Holds The Leak — single use, reveals the next news card without drawing it:
                </span>
                <button
                  className="secondary"
                  style={{ color: "#4a1a8c" }}
                  onClick={() => {
                    const r = engine.useLeak(playerId);
                    report(r, r.ok ? "The Leak used — see the reveal." : (r.message ?? "That didn't work."));
                  }}
                >
                  Use The Leak
                </button>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
