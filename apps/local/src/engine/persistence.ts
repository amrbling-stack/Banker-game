import type { GameState } from "./types";
import { defaultSettings } from "./types";

const STORAGE_KEY = "ras-el-mal:local-game";

export function loadState(): GameState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameState & { ledger?: unknown[] };

    // v1.3 migration: add reckoningTurnCountdown if missing (old saves)
    if (parsed.reckoningTurnCountdown === undefined) {
      (parsed as GameState).reckoningTurnCountdown = null;
    }

    // v1.4 migration: rename `ledger` -> `eventLog` (same shape, plus
    // playerId/delta may now be null on newer entries — old entries are
    // still valid, they just never had null fields).
    if (parsed.eventLog === undefined) {
      (parsed as GameState).eventLog = (parsed.ledger as GameState["eventLog"]) ?? [];
    }
    delete (parsed as { ledger?: unknown[] }).ledger;

    // v1.4 migration: experimental-feature scaffolding, all off by default
    // for any game that was created before these existed.
    if (parsed.settings === undefined) {
      (parsed as GameState).settings = defaultSettings();
    }
    if (parsed.leak === undefined) {
      (parsed as GameState).leak = { ownerId: null, used: false };
    }
    if (parsed.pendingGulfOffer === undefined) {
      (parsed as GameState).pendingGulfOffer = null;
    }
    if (Array.isArray(parsed.players)) {
      parsed.players = parsed.players.map((p) => ({ goldUnits: 0, ...p }));
    }

    return parsed as GameState;
  } catch {
    return null;
  }
}

export function saveState(state: GameState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage can fail (private browsing, quota) — the game keeps working
    // in memory for the rest of the session either way.
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
