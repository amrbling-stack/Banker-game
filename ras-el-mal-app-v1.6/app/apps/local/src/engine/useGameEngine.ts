import { useCallback, useEffect, useRef, useState } from "react";
import type { GameSettings, GameState } from "./types";
import { loadState, saveState, clearState } from "./persistence";
import * as engine from "./gameEngine";

export interface ActionResult {
  ok: boolean;
  message?: string;
  amount?: number;
}

const MAX_UNDO = 20;

/**
 * v1.3 additions:
 * - undoStack: keeps the last MAX_UNDO pre-action states so any transaction
 *   can be reversed with one click. The undo stack is in-memory only
 *   (not persisted) — a page refresh clears it, which is correct because
 *   the saved state IS the current state.
 * - lastNewsCode / dismissNews: drives the news modal. Set whenever a card
 *   is drawn (standalone draw or via GO). Cleared by the modal's dismiss.
 *
 * v1.4 additions:
 * - state.eventLog is now the full audit trail (item #31): every cash
 *   movement and every structural change (news draws, index moves,
 *   ownership transfers) is a recorded entry, and undo is exactly "go back
 *   to the state before the last commit" — the free lunch the feedback
 *   promised.
 * - Gold / The Leak / Gulf personal offer actions (items #12, #3, #16),
 *   all gated behind state.settings, chosen once at setup.
 */
export function useGameEngine() {
  const [state, setStateRaw] = useState<GameState>(() => loadState() ?? engine.emptyState());
  const [undoStack, setUndoStack] = useState<GameState[]>([]);
  const [lastNewsCode, setLastNewsCode] = useState<string | null>(null);
  const [lastLeakReveal, setLastLeakReveal] = useState<string | null>(null);

  // Keep a ref so action callbacks can read current state without being
  // re-created on every render (avoids stale-closure bugs while still
  // allowing synchronous reads).
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
    saveState(state);
  }, [state]);

  /** Commit a new state, pushing the previous one onto the undo stack. */
  function commit(newState: GameState) {
    const prev = stateRef.current;
    setUndoStack((s) => [...s.slice(-(MAX_UNDO - 1)), prev]);
    setStateRaw(newState);
  }

  // ---------------------------------------------------------------------------
  // Meta
  // ---------------------------------------------------------------------------

  const newGame = useCallback((names: string[], settings?: GameSettings) => {
    setUndoStack([]);
    setStateRaw(engine.createGame(names, settings));
  }, []);

  const resetToSetup = useCallback(() => {
    clearState();
    setUndoStack([]);
    setStateRaw(engine.resetGame());
  }, []);

  const undo = useCallback(() => {
    setUndoStack((stack) => {
      if (stack.length === 0) return stack;
      const prev = stack[stack.length - 1];
      setStateRaw(prev);
      return stack.slice(0, -1);
    });
  }, []);

  const dismissNews = useCallback(() => {
    setLastNewsCode(null);
  }, []);

  const dismissLeakReveal = useCallback(() => {
    setLastLeakReveal(null);
  }, []);

  // ---------------------------------------------------------------------------
  // Turn management (no undo — trivially reversible)
  // ---------------------------------------------------------------------------

  const setCurrentPlayer = useCallback((playerId: string) => {
    setStateRaw((s) => engine.setCurrentPlayer(s, playerId));
  }, []);

  const dismissNationalProjectUnlock = useCallback(() => {
    setStateRaw((s) => engine.dismissNationalProjectUnlock(s));
  }, []);

  const nextPlayer = useCallback(() => {
    setStateRaw((s) => engine.nextPlayer(s));
  }, []);

  // ---------------------------------------------------------------------------
  // Cash / bank actions
  // ---------------------------------------------------------------------------

  const deposit = useCallback((playerId: string, amount: number, note?: string) => {
    commit(engine.deposit(stateRef.current, playerId, amount, note));
  }, []);

  const withdraw = useCallback((playerId: string, amount: number, note?: string) => {
    commit(engine.withdraw(stateRef.current, playerId, amount, note));
  }, []);

  const transfer = useCallback((fromId: string, toId: string, amount: number, note?: string) => {
    commit(engine.transfer(stateRef.current, fromId, toId, amount, note));
  }, []);

  const payTax = useCallback((playerId: string): number => {
    const result = engine.payTax(stateRef.current, playerId);
    commit(result.state);
    return result.amount;
  }, []);

  // ---------------------------------------------------------------------------
  // Loans
  // ---------------------------------------------------------------------------

  const takeLoan = useCallback((playerId: string, noteCount: number): ActionResult => {
    const r = engine.takeLoan(stateRef.current, playerId, noteCount);
    if (r.ok) commit(r.state);
    return { ok: r.ok, message: r.message };
  }, []);

  const repayLoan = useCallback((playerId: string, noteCount: number): ActionResult => {
    const r = engine.repayLoan(stateRef.current, playerId, noteCount);
    if (r.ok) commit(r.state);
    return { ok: r.ok, message: r.message };
  }, []);

  const distressedSwap = useCallback((playerId: string): ActionResult => {
    const r = engine.distressedSwap(stateRef.current, playerId);
    if (r.ok) commit(r.state);
    return { ok: r.ok, message: r.message };
  }, []);

  // ---------------------------------------------------------------------------
  // Gold (experimental)
  // ---------------------------------------------------------------------------

  const buyGold = useCallback((playerId: string, units: number): ActionResult => {
    const r = engine.buyGold(stateRef.current, playerId, units);
    if (r.ok) commit(r.state);
    return { ok: r.ok, message: r.message };
  }, []);

  const sellGold = useCallback((playerId: string, units: number): ActionResult => {
    const r = engine.sellGold(stateRef.current, playerId, units);
    if (r.ok) commit(r.state);
    return { ok: r.ok, message: r.message };
  }, []);

  // ---------------------------------------------------------------------------
  // The Leak (experimental)
  // ---------------------------------------------------------------------------

  const awardLeak = useCallback((winnerId: string, amount: number): ActionResult => {
    const r = engine.awardLeak(stateRef.current, winnerId, amount);
    if (r.ok) commit(r.state);
    return { ok: r.ok, message: r.message };
  }, []);

  const useLeak = useCallback((playerId: string): ActionResult & { code?: string } => {
    const r = engine.useLeak(stateRef.current, playerId);
    if (r.ok) {
      commit(r.state);
      if (r.code) setLastLeakReveal(r.code);
    }
    return { ok: r.ok, message: r.message, code: r.code };
  }, []);

  // ---------------------------------------------------------------------------
  // Gulf personal offer (experimental)
  // ---------------------------------------------------------------------------

  const acceptGulfOffer = useCallback((): ActionResult => {
    const r = engine.acceptGulfOffer(stateRef.current);
    if (r.ok) commit(r.state);
    return { ok: r.ok, message: r.message };
  }, []);

  const declineGulfOffer = useCallback((): ActionResult => {
    const r = engine.declineGulfOffer(stateRef.current);
    if (r.ok) commit(r.state);
    return { ok: r.ok };
  }, []);

  // ---------------------------------------------------------------------------
  // Properties
  // ---------------------------------------------------------------------------

  const buyDeed = useCallback((companyId: number, playerId: string, price: number): ActionResult => {
    const r = engine.buyDeed(stateRef.current, companyId, playerId, price);
    if (r.ok) commit(r.state);
    return { ok: r.ok, message: r.message };
  }, []);

  const awardAuction = useCallback((companyId: number, winnerId: string, amount: number): ActionResult => {
    const r = engine.awardAuction(stateRef.current, companyId, winnerId, amount);
    if (r.ok) commit(r.state);
    return { ok: r.ok, message: r.message };
  }, []);

  const sellToBank = useCallback((companyId: number): ActionResult => {
    const r = engine.sellToBank(stateRef.current, companyId);
    if (r.ok) commit(r.state);
    return { ok: r.ok, amount: r.amount };
  }, []);

  const transferDeed = useCallback((companyId: number, toPlayerId: string): ActionResult => {
    const r = engine.transferDeedOwnership(stateRef.current, companyId, toPlayerId);
    if (r.ok) commit(r.state);
    return { ok: r.ok, message: r.message };
  }, []);

  const developCompany = useCallback((companyId: number): ActionResult => {
    const r = engine.developCompany(stateRef.current, companyId);
    if (r.ok) commit(r.state);
    return { ok: r.ok, message: r.message };
  }, []);

  const payLanding = useCallback((companyId: number, payerId: string): ActionResult => {
    const r = engine.payLandingAction(stateRef.current, companyId, payerId);
    if (r.ok) commit(r.state);
    return { ok: r.ok, message: r.message, amount: r.amount };
  }, []);

  // ---------------------------------------------------------------------------
  // News & GO
  // ---------------------------------------------------------------------------

  const drawNews = useCallback((): string | null => {
    const r = engine.drawNews(stateRef.current);
    commit(r.state);
    if (r.code) setLastNewsCode(r.code);
    return r.code;
  }, []);

  const collectGo = useCallback((playerId: string): engine.GoResult => {
    const r = engine.collectGo(stateRef.current, playerId);
    commit(r.state);
    if (r.result.code) setLastNewsCode(r.result.code);
    return r.result;
  }, []);

  // ---------------------------------------------------------------------------
  // End game
  // ---------------------------------------------------------------------------

  const finishGame = useCallback(() => {
    setStateRaw((s) => engine.finishGame(s));
  }, []);

  return {
    state,
    undoStack,
    lastNewsCode,
    lastLeakReveal,
    newGame,
    resetToSetup,
    undo,
    dismissNews,
    dismissLeakReveal,
    setCurrentPlayer,
    dismissNationalProjectUnlock,
    nextPlayer,
    deposit,
    withdraw,
    transfer,
    payTax,
    takeLoan,
    repayLoan,
    distressedSwap,
    buyGold,
    sellGold,
    awardLeak,
    useLeak,
    acceptGulfOffer,
    declineGulfOffer,
    buyDeed,
    awardAuction,
    sellToBank,
    transferDeed,
    developCompany,
    payLanding,
    drawNews,
    collectGo,
    finishGame,
  };
}

export type GameEngine = ReturnType<typeof useGameEngine>;
