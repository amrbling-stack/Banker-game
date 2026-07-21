import type { Deed, EventLogEntry, GameSettings, GameState, Player } from "./types";
import { defaultSettings, NEWS_CARD_LABELS, SPECIAL_PROJECT_IDS } from "./types";
import { COMPANIES } from "./companies";
import {
  COMPANIES_BY_ID,
  allOrdinaryDeedsOwned,
  chainCountFor,
  currentBuyback,
  currentMarketPrice,
  dividendFor,
  goldBuyPrice,
  goldSellPrice,
  GOLD_UNIT_CAP,
  interestPerNote,
  isAuctionGated,
  loanCeilingNotes,
  zoneForIndex,
} from "./calc";
import { buildNewsDeck } from "./newsDeck";

/**
 * Feedback item #16 (experimental): chance, each time a turn advances to an
 * eligible player, that a Gulf investor offer fires. The advisor's note
 * only said "random qualifying target" without a number — 20% is a
 * deliberately modest starting point, tunable per the playtest protocol
 * (one variable at a time) once this sees a real table.
 */
const GULF_OFFER_CHANCE = 0.2;

export function emptyState(): GameState {
  return {
    status: "SETUP",
    players: [],
    deeds: [],
    indexPosition: 2,
    ratePosition: 1,
    reckoningDrawn: false,
    reckoningTurnCountdown: null,
    currentPlayerId: null,
    newsQueue: [],
    newsHistory: [],
    eventLog: [],
    seq: 0,
    settings: defaultSettings(),
    leak: { ownerId: null, used: false },
    pendingGulfOffer: null,
    nationalProjectUnlocked: false,
    nationalProjectJustUnlocked: false,
  };
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/**
 * Appends one event to the log and returns the updated log + counter.
 * Used for BOTH money-moving events (playerId + non-zero delta) and
 * structural events (playerId null or delta null) — see EventLogEntry.
 */
function pushEvent(
  state: GameState,
  entry: { playerId: string | null; delta: number | null; balanceAfter: number | null; reason: string; description: string },
): { eventLog: EventLogEntry[]; seq: number } {
  const seq = state.seq + 1;
  const full: EventLogEntry = { id: uid(), seq, createdAt: Date.now(), ...entry };
  return { eventLog: [...state.eventLog, full], seq };
}

/** Adds one cash-moving event and returns the updated player list + log (does not mutate). */
function applyDelta(
  state: GameState,
  playerId: string,
  delta: number,
  reason: string,
  description: string,
): { players: Player[]; eventLog: EventLogEntry[]; seq: number } {
  const players = state.players.map((p) => (p.id === playerId ? { ...p, cash: p.cash + delta } : p));
  const newBalance = players.find((p) => p.id === playerId)!.cash;
  const { eventLog, seq } = pushEvent(state, {
    playerId,
    delta,
    balanceAfter: newBalance,
    reason,
    description,
  });
  return { players, eventLog, seq };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

export function createGame(names: string[], settings?: GameSettings): GameState {
  const trimmed = names.map((n) => n.trim()).filter(Boolean);
  // v1.2: starting cash raised to 35,000 base (was 25,000).
  // Seat order bonus (+1,000/seat) is unchanged.
  const players: Player[] = trimmed.map((name, i) => ({
    id: uid(),
    seat: i + 1,
    name,
    cash: 35000 + 1000 * i,
    loanNotes: 0,
    skipNextDividend: false,
    goldUnits: 0,
  }));

  const deeds: Deed[] = COMPANIES.map((c) => ({
    companyId: c.id,
    ownerId: null,
    devLevel: c.develops ? "KIOSK" : "FIXED",
  }));

  const eventLog: EventLogEntry[] = players.map((p, i) => ({
    id: uid(),
    seq: i + 1,
    playerId: p.id,
    delta: p.cash,
    balanceAfter: p.cash,
    reason: "SETUP",
    description: "Starting cash",
    createdAt: Date.now(),
  }));

  return {
    status: "PLAYING",
    players,
    deeds,
    indexPosition: 2,
    ratePosition: 1,
    reckoningDrawn: false,
    reckoningTurnCountdown: null,
    currentPlayerId: players[0]?.id ?? null,
    newsQueue: buildNewsDeck(players.length),
    newsHistory: [],
    eventLog,
    seq: players.length,
    settings: settings ?? defaultSettings(),
    leak: { ownerId: null, used: false },
    pendingGulfOffer: null,
    nationalProjectUnlocked: false,
    nationalProjectJustUnlocked: false,
  };
}

export function setCurrentPlayer(state: GameState, playerId: string): GameState {
  return { ...state, currentPlayerId: playerId };
}

/** Picks a random eligible target for a Gulf offer (owns >=1 unowned-by-bank SPECULATIVE deed), or null. */
function pickGulfTarget(state: GameState, playerId: string): { companyId: number; price: number } | null {
  const eligible = state.deeds.filter((d) => {
    if (d.ownerId !== playerId) return false;
    const c = COMPANIES_BY_ID.get(d.companyId);
    return c?.riskClass === "SPECULATIVE";
  });
  if (eligible.length === 0) return null;
  const pick = eligible[Math.floor(Math.random() * eligible.length)];
  const company = COMPANIES_BY_ID.get(pick.companyId)!;
  const market = currentMarketPrice(company, state.indexPosition);
  const price = Math.round((market * 1.2) / 100) * 100;
  return { companyId: pick.companyId, price };
}

export function nextPlayer(state: GameState): GameState {
  if (state.players.length === 0) return state;
  const idx = state.players.findIndex((p) => p.id === state.currentPlayerId);
  const next = state.players[(idx + 1) % state.players.length];
  const reckoningTurnCountdown =
    state.reckoningTurnCountdown === null ? null : Math.max(0, state.reckoningTurnCountdown - 1);

  let pendingGulfOffer = state.pendingGulfOffer;
  if (
    state.settings.enableGulfOffer &&
    !pendingGulfOffer &&
    state.status === "PLAYING" &&
    Math.random() < GULF_OFFER_CHANCE
  ) {
    const target = pickGulfTarget(state, next.id);
    if (target) pendingGulfOffer = { playerId: next.id, ...target };
  }

  return { ...state, currentPlayerId: next.id, reckoningTurnCountdown, pendingGulfOffer };
}

// ---------------------------------------------------------------------------
// Bank: deposit / withdraw / transfer / tax
// ---------------------------------------------------------------------------

export function deposit(state: GameState, playerId: string, amount: number, note = "Deposit"): GameState {
  if (amount <= 0) return state;
  const { players, eventLog, seq } = applyDelta(state, playerId, amount, "ADJUSTMENT", note);
  return { ...state, players, eventLog, seq };
}

export function withdraw(state: GameState, playerId: string, amount: number, note = "Withdrawal"): GameState {
  if (amount <= 0) return state;
  const { players, eventLog, seq } = applyDelta(state, playerId, -amount, "ADJUSTMENT", note);
  return { ...state, players, eventLog, seq };
}

export function transfer(
  state: GameState,
  fromId: string,
  toId: string,
  amount: number,
  note = "Transfer",
): GameState {
  if (amount <= 0 || fromId === toId) return state;
  const step1 = applyDelta(state, fromId, -amount, "TRADE", `Paid: ${note}`);
  const midState = { ...state, players: step1.players, eventLog: step1.eventLog, seq: step1.seq };
  const step2 = applyDelta(midState, toId, amount, "TRADE", `Received: ${note}`);
  return { ...state, players: step2.players, eventLog: step2.eventLog, seq: step2.seq };
}

export function payTax(state: GameState, playerId: string): { state: GameState; amount: number } {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return { state, amount: 0 };
  const tax = player.cash <= 0 ? 0 : Math.floor((player.cash * 0.1) / 100) * 100;
  if (tax === 0) return { state, amount: 0 };
  const { players, eventLog, seq } = applyDelta(state, playerId, -tax, "TAX", "10% tax");
  return { state: { ...state, players, eventLog, seq }, amount: tax };
}

// ---------------------------------------------------------------------------
// Loans
// ---------------------------------------------------------------------------

export function takeLoan(
  state: GameState,
  playerId: string,
  noteCount: number,
): { state: GameState; ok: boolean; message?: string } {
  const player = state.players.find((p) => p.id === playerId);
  if (!player || noteCount <= 0) return { state, ok: false, message: "Invalid request" };

  const ceiling = loanCeilingNotes(state.deeds, playerId);
  if (player.loanNotes + noteCount > ceiling) {
    return { state, ok: false, message: `Loan ceiling reached: at most ${ceiling} note(s) against current holdings` };
  }

  const amount = noteCount * 5000;
  const { players, eventLog, seq } = applyDelta(state, playerId, amount, "LOAN_TAKE", `${noteCount} note(s)`);
  const withNotes = players.map((p) => (p.id === playerId ? { ...p, loanNotes: p.loanNotes + noteCount } : p));
  return { state: { ...state, players: withNotes, eventLog, seq }, ok: true };
}

export function repayLoan(
  state: GameState,
  playerId: string,
  noteCount: number,
): { state: GameState; ok: boolean; message?: string } {
  const player = state.players.find((p) => p.id === playerId);
  if (!player || noteCount <= 0) return { state, ok: false, message: "Invalid request" };
  if (noteCount > player.loanNotes) return { state, ok: false, message: "You do not hold that many notes" };

  const amount = noteCount * 5000;
  if (amount > player.cash) return { state, ok: false, message: "Insufficient funds to repay" };

  const { players, eventLog, seq } = applyDelta(state, playerId, -amount, "LOAN_REPAY", `${noteCount} note(s)`);
  const withNotes = players.map((p) => (p.id === playerId ? { ...p, loanNotes: p.loanNotes - noteCount } : p));
  return { state: { ...state, players: withNotes, eventLog, seq }, ok: true };
}

/**
 * Distressed swap (v1.2, rule #25):
 * Cancel ONE loan note immediately, in exchange for forfeiting the entire
 * next dividend collection at GO. Pain now, no long installment tail.
 * Only available when the player holds at least one note.
 */
export function distressedSwap(
  state: GameState,
  playerId: string,
): { state: GameState; ok: boolean; message?: string } {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return { state, ok: false, message: "Player not found" };
  if (player.loanNotes < 1) return { state, ok: false, message: "No loan notes to swap" };
  if (player.skipNextDividend) {
    return { state, ok: false, message: "A distressed swap is already pending for this player" };
  }

  // Cancel one note (no cash changes — the forfeit is the payment)
  const players = state.players.map((p) =>
    p.id === playerId ? { ...p, loanNotes: p.loanNotes - 1, skipNextDividend: true } : p,
  );
  const { eventLog, seq } = pushEvent(
    { ...state, players },
    {
      playerId,
      delta: 0,
      balanceAfter: player.cash,
      reason: "DISTRESSED_SWAP",
      description: "Distressed swap: 1 note cancelled; next dividends forfeited",
    },
  );
  return { state: { ...state, players, eventLog, seq }, ok: true };
}

// ---------------------------------------------------------------------------
// Gold (feedback item #12, experimental — off by default via GameSettings)
// ---------------------------------------------------------------------------

export function buyGold(
  state: GameState,
  playerId: string,
  units: number,
): { state: GameState; ok: boolean; message?: string } {
  if (!state.settings.enableGold) return { state, ok: false, message: "Gold trading is not enabled for this game" };
  const player = state.players.find((p) => p.id === playerId);
  if (!player || units <= 0) return { state, ok: false, message: "Invalid request" };
  const held = player.goldUnits ?? 0;
  if (held + units > GOLD_UNIT_CAP) {
    return { state, ok: false, message: `Cap is ${GOLD_UNIT_CAP} unit(s) of gold per player` };
  }
  const price = goldBuyPrice(state.indexPosition);
  const cost = price * units;
  if (player.cash < cost) return { state, ok: false, message: "Insufficient funds" };

  const { players, eventLog, seq } = applyDelta(state, playerId, -cost, "GOLD_BUY", `${units} unit(s) of gold`);
  const withGold = players.map((p) => (p.id === playerId ? { ...p, goldUnits: held + units } : p));
  return { state: { ...state, players: withGold, eventLog, seq }, ok: true };
}

export function sellGold(
  state: GameState,
  playerId: string,
  units: number,
): { state: GameState; ok: boolean; message?: string } {
  if (!state.settings.enableGold) return { state, ok: false, message: "Gold trading is not enabled for this game" };
  const player = state.players.find((p) => p.id === playerId);
  if (!player || units <= 0) return { state, ok: false, message: "Invalid request" };
  const held = player.goldUnits ?? 0;
  if (units > held) return { state, ok: false, message: "You do not hold that much gold" };

  const price = goldSellPrice(state.indexPosition);
  const proceeds = price * units;
  const { players, eventLog, seq } = applyDelta(state, playerId, proceeds, "GOLD_SELL", `${units} unit(s) of gold`);
  const withGold = players.map((p) => (p.id === playerId ? { ...p, goldUnits: held - units } : p));
  return { state: { ...state, players: withGold, eventLog, seq }, ok: true };
}

// ---------------------------------------------------------------------------
// The Leak (feedback item #3, experimental — off by default)
// ---------------------------------------------------------------------------

/** Auctions The Leak into play — single-use, sold once, ever. Proceeds go to the bank. */
export function awardLeak(
  state: GameState,
  winnerId: string,
  amount: number,
): { state: GameState; ok: boolean; message?: string } {
  if (!state.settings.enableLeak) return { state, ok: false, message: "The Leak is not enabled for this game" };
  if (state.leak.ownerId !== null) return { state, ok: false, message: "The Leak has already been claimed" };
  const winner = state.players.find((p) => p.id === winnerId);
  if (!winner) return { state, ok: false, message: "Not found" };
  if (amount < 0) return { state, ok: false, message: "Invalid amount" };
  if (winner.cash < amount) return { state, ok: false, message: "Insufficient funds" };

  const { players, eventLog, seq } = applyDelta(state, winnerId, -amount, "LEAK_AUCTION", "Won The Leak (التسريب) at auction");
  return {
    state: { ...state, players, eventLog, seq, leak: { ownerId: winnerId, used: false } },
    ok: true,
  };
}

/** Spends The Leak: reveals the next news card without drawing or resolving it. Single-use, then gone. */
export function useLeak(
  state: GameState,
  playerId: string,
): { state: GameState; ok: boolean; code?: string; message?: string } {
  if (!state.settings.enableLeak) return { state, ok: false, message: "The Leak is not enabled for this game" };
  if (state.leak.ownerId !== playerId) return { state, ok: false, message: "You do not hold The Leak" };
  if (state.leak.used) return { state, ok: false, message: "The Leak has already been used" };
  if (state.newsQueue.length === 0) return { state, ok: false, message: "No cards left to preview" };

  const code = state.newsQueue[0];
  const player = state.players.find((p) => p.id === playerId)!;
  const { eventLog, seq } = pushEvent(state, {
    playerId,
    delta: 0,
    balanceAfter: player.cash,
    reason: "LEAK_USE",
    description: `The Leak used: revealed "${NEWS_CARD_LABELS[code] ?? code}" as the next card`,
  });
  return {
    state: { ...state, eventLog, seq, leak: { ...state.leak, used: true } },
    ok: true,
    code,
  };
}

// ---------------------------------------------------------------------------
// Gulf investor personal offer (feedback item #16, experimental — off by default)
// ---------------------------------------------------------------------------

export function acceptGulfOffer(state: GameState): { state: GameState; ok: boolean; message?: string } {
  const offer = state.pendingGulfOffer;
  if (!offer) return { state, ok: false, message: "No offer pending" };
  const deed = state.deeds.find((d) => d.companyId === offer.companyId);
  const company = COMPANIES_BY_ID.get(offer.companyId);
  if (!deed || !company || deed.ownerId !== offer.playerId) {
    return { state: { ...state, pendingGulfOffer: null }, ok: false, message: "Offer no longer valid" };
  }

  const { players, eventLog, seq } = applyDelta(
    state,
    offer.playerId,
    offer.price,
    "GULF_OFFER_ACCEPT",
    `Gulf investor: sold ${company.nameEn}`,
  );
  const deeds = state.deeds.map((d) =>
    d.companyId === offer.companyId ? { ...d, ownerId: null, devLevel: "KIOSK" as const } : d,
  );
  return {
    state: { ...state, players, eventLog, seq, deeds, pendingGulfOffer: null },
    ok: true,
  };
}

export function declineGulfOffer(state: GameState): { state: GameState; ok: boolean } {
  const offer = state.pendingGulfOffer;
  if (!offer) return { state, ok: false };
  const player = state.players.find((p) => p.id === offer.playerId);
  const company = COMPANIES_BY_ID.get(offer.companyId);
  const { eventLog, seq } = pushEvent(state, {
    playerId: offer.playerId,
    delta: 0,
    balanceAfter: player?.cash ?? null,
    reason: "GULF_OFFER_DECLINE",
    description: `Gulf investor offer declined for ${company?.nameEn ?? "a company"}`,
  });
  return { state: { ...state, eventLog, seq, pendingGulfOffer: null }, ok: true };
}

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

/** Call after any deed ownership change lands. If it was the last of the 30
 * ordinary companies being bought, fires the one-time Compound in Sheikh
 * Zayed unlock (and the transient notification flag) for the Dashboard to
 * surface. Safe to call unconditionally -- no-ops once already unlocked. */
function checkNationalProjectUnlock(state: GameState): GameState {
  if (state.nationalProjectUnlocked) return state;
  if (!allOrdinaryDeedsOwned(state.deeds)) return state;
  const { eventLog, seq } = pushEvent(state, {
    playerId: null,
    delta: null,
    balanceAfter: null,
    reason: "NATIONAL_PROJECT_UNLOCKED",
    description: "Every company on the board has an owner — the Compound in Sheikh Zayed is now open for auction.",
  });
  return { ...state, eventLog, seq, nationalProjectUnlocked: true, nationalProjectJustUnlocked: true };
}

/** Dismisses the one-time Sheikh Zayed unlock notification modal. */
export function dismissNationalProjectUnlock(state: GameState): GameState {
  return { ...state, nationalProjectJustUnlocked: false };
}

export function buyDeed(
  state: GameState,
  companyId: number,
  playerId: string,
  price: number,
): { state: GameState; ok: boolean; message?: string } {
  const deed = state.deeds.find((d) => d.companyId === companyId);
  const company = COMPANIES_BY_ID.get(companyId);
  const player = state.players.find((p) => p.id === playerId);
  if (!deed || !company || !player) return { state, ok: false, message: "Not found" };
  if (deed.ownerId) return { state, ok: false, message: "Already owned" };
  if (SPECIAL_PROJECT_IDS.has(companyId)) {
    return { state, ok: false, message: "The Compound in Sheikh Zayed enters play by auction only — use the Auction tab." };
  }
  if (price < 0) return { state, ok: false, message: "Invalid price" };
  if (player.cash < price) return { state, ok: false, message: "Insufficient funds" };

  const { players, eventLog, seq } = applyDelta(state, playerId, -price, "BUY_COMPANY", company.nameEn);
  const deeds = state.deeds.map((d) =>
    d.companyId === companyId
      ? { ...d, ownerId: playerId, devLevel: company.develops ? ("KIOSK" as const) : ("FIXED" as const) }
      : d,
  );
  const next = checkNationalProjectUnlock({ ...state, players, eventLog, seq, deeds });
  return { state: next, ok: true };
}

/** Records an auction result: works whether the deed was bank-held (proceeds to bank)
 * or owned by another player (proceeds to that player) — the physical table runs the
 * actual bidding; this just records who won at what price. */
export function awardAuction(
  state: GameState,
  companyId: number,
  winnerId: string,
  amount: number,
): { state: GameState; ok: boolean; message?: string } {
  const deed = state.deeds.find((d) => d.companyId === companyId);
  const company = COMPANIES_BY_ID.get(companyId);
  const winner = state.players.find((p) => p.id === winnerId);
  if (!deed || !company || !winner) return { state, ok: false, message: "Not found" };
  if (deed.ownerId === winnerId) return { state, ok: false, message: "Already the owner" };
  if (amount < 0) return { state, ok: false, message: "Invalid amount" };
  if (winner.cash < amount) return { state, ok: false, message: "Insufficient funds" };
  if (!deed.ownerId && isAuctionGated(companyId, state)) {
    return {
      state,
      ok: false,
      message: "The Compound in Sheikh Zayed can't be auctioned yet — it unlocks once every other company on the board has an owner.",
    };
  }

  let working = state;
  if (deed.ownerId) {
    // Seller-listed auction: proceeds go to the previous owner.
    working = transfer(working, winnerId, deed.ownerId, amount, `Auction: ${company.nameEn}`);
  } else {
    // Bank auction: proceeds go to the bank (winner is simply debited).
    const { players, eventLog, seq } = applyDelta(working, winnerId, -amount, "AUCTION_WIN_PAY", company.nameEn);
    working = { ...working, players, eventLog, seq };
  }

  const deeds = working.deeds.map((d) =>
    d.companyId === companyId
      ? { ...d, ownerId: winnerId, devLevel: company.develops ? ("KIOSK" as const) : ("FIXED" as const) }
      : d,
  );
  const next = checkNationalProjectUnlock({ ...working, deeds });
  return { state: next, ok: true };
}

export function sellToBank(
  state: GameState,
  companyId: number,
): { state: GameState; ok: boolean; amount?: number } {
  const deed = state.deeds.find((d) => d.companyId === companyId);
  const company = COMPANIES_BY_ID.get(companyId);
  if (!deed || !company || !deed.ownerId) return { state, ok: false };
  const ownerId = deed.ownerId;

  const price = currentBuyback(company, state.indexPosition);
  const { players, eventLog, seq } = applyDelta(state, ownerId, price, "BANK_BUYBACK", company.nameEn);
  const deeds = state.deeds.map((d) =>
    d.companyId === companyId
      ? { ...d, ownerId: null, devLevel: company.develops ? ("KIOSK" as const) : ("FIXED" as const) }
      : d,
  );
  return { state: { ...state, players, eventLog, seq, deeds }, ok: true, amount: price };
}

export function transferDeedOwnership(
  state: GameState,
  companyId: number,
  toPlayerId: string,
): { state: GameState; ok: boolean; message?: string } {
  const deed = state.deeds.find((d) => d.companyId === companyId);
  const company = COMPANIES_BY_ID.get(companyId);
  if (!deed || !deed.ownerId) return { state, ok: false, message: "Deed is not owned" };
  if (deed.ownerId === toPlayerId) return { state, ok: false, message: "Already the owner" };
  const fromId = deed.ownerId;

  const deeds = state.deeds.map((d) => (d.companyId === companyId ? { ...d, ownerId: toPlayerId } : d));
  const fromPlayer = state.players.find((p) => p.id === fromId);
  const toPlayer = state.players.find((p) => p.id === toPlayerId);
  const { eventLog, seq } = pushEvent(state, {
    playerId: toPlayerId,
    delta: null,
    balanceAfter: null,
    reason: "TRANSFER_OWNERSHIP",
    description: `${company?.nameEn ?? "Deed"} transferred from ${fromPlayer?.name ?? "?"} to ${toPlayer?.name ?? "?"} (no payment moved automatically)`,
  });
  return { state: { ...state, deeds, eventLog, seq }, ok: true };
}

export function developCompany(
  state: GameState,
  companyId: number,
): { state: GameState; ok: boolean; message?: string } {
  const deed = state.deeds.find((d) => d.companyId === companyId);
  const company = COMPANIES_BY_ID.get(companyId);
  if (!deed || !company || !deed.ownerId) return { state, ok: false, message: "Deed is not owned" };
  if (!company.develops) return { state, ok: false, message: "This company can never be developed" };
  const ownerId = deed.ownerId;

  let cost: number | null;
  let next: "SHOP" | "CHAIN";
  if (deed.devLevel === "KIOSK") {
    cost = company.developCostShop;
    next = "SHOP";
  } else if (deed.devLevel === "SHOP") {
    cost = company.developCostChain;
    next = "CHAIN";
  } else {
    return { state, ok: false, message: "Already fully developed" };
  }
  if (cost === null) return { state, ok: false, message: "No develop cost on file" };

  const player = state.players.find((p) => p.id === ownerId)!;
  if (player.cash < cost) return { state, ok: false, message: "Insufficient funds" };

  const { players, eventLog, seq } = applyDelta(state, ownerId, -cost, "DEVELOP", `${company.nameEn} -> ${next}`);
  const deeds = state.deeds.map((d) => (d.companyId === companyId ? { ...d, devLevel: next } : d));
  return { state: { ...state, players, eventLog, seq, deeds }, ok: true };
}

export function payLandingAction(
  state: GameState,
  companyId: number,
  payerId: string,
): { state: GameState; ok: boolean; amount?: number; message?: string } {
  const deed = state.deeds.find((d) => d.companyId === companyId);
  const company = COMPANIES_BY_ID.get(companyId);
  if (!deed || !company || !deed.ownerId) return { state, ok: false, message: "Deed is not owned" };
  if (deed.ownerId === payerId) return { state, ok: false, message: "You own this company" };
  const ownerId = deed.ownerId;

  const stats =
    deed.devLevel === "FIXED" || deed.devLevel === "KIOSK"
      ? company.kiosk
      : deed.devLevel === "SHOP"
        ? company.shop
        : company.chain;
  if (!stats) return { state, ok: false, message: "No income data" };

  const zone = zoneForIndex(state.indexPosition);
  const base = zone === "RECESSION" ? stats.landingRecession : zone === "BOOM" ? stats.landingBoom : stats.landingNormal;
  const owned = chainCountFor(state.deeds, ownerId, company.chainCode);
  const mult = owned >= 3 ? 2 : 1;
  const amount = Math.floor(base * mult);

  const next = transfer(state, payerId, ownerId, amount, `Landing: ${company.nameEn}`);
  return { state: next, ok: true, amount };
}

// ---------------------------------------------------------------------------
// News & GO
// ---------------------------------------------------------------------------

function resolveNewsCard(state: GameState): { state: GameState; code: string | null } {
  if (state.newsQueue.length === 0) return { state, code: null };

  const [code, ...rest] = state.newsQueue;
  let indexPosition = state.indexPosition;
  let ratePosition = state.ratePosition;
  let players = state.players;
  let eventLog = state.eventLog;
  let seq = state.seq;

  if (code === "MARKET_UP_1") indexPosition = Math.min(4, indexPosition + 1);
  else if (code === "MARKET_DOWN_1") indexPosition = Math.max(0, indexPosition - 1);
  else if (code === "GAS_FIELD_UP_2") indexPosition = Math.min(4, indexPosition + 2);
  else if (code === "CRISIS_DOWN_2") indexPosition = Math.max(0, indexPosition - 2);
  else if (code === "CB_RAISE") ratePosition = Math.min(3, ratePosition + 1);
  else if (code === "CB_CUT") ratePosition = Math.max(0, ratePosition - 1);
  else if (code === "FLOTATION") {
    for (const p of state.players) {
      const newCash = Math.ceil(p.cash / 2 / 100) * 100;
      const delta = newCash - p.cash;
      seq += 1;
      const entry: EventLogEntry = {
        id: uid(),
        seq,
        playerId: p.id,
        delta,
        balanceAfter: newCash,
        reason: "FLOTATION",
        description: "Flotation: cash halved",
        createdAt: Date.now(),
      };
      eventLog = [...eventLog, entry];
      players = players.map((pp) => (pp.id === p.id ? { ...pp, cash: newCash } : pp));
    }
  }
  // GOV_OFFERING / GULF_INVESTOR / QUIET_DAY: no automatic money movement —
  // the table resolves these physically using Buy / Auction / Sell controls.

  const reckoningDrawn = state.reckoningDrawn || code === "RECKONING";

  // When RECKONING is drawn, compute remaining turns:
  // = turns left in current round (players after current) + one full round
  let reckoningTurnCountdown = state.reckoningTurnCountdown;
  if (code === "RECKONING" && reckoningTurnCountdown === null) {
    const currentIdx = state.players.findIndex((p) => p.id === state.currentPlayerId);
    const remainingInRound = state.players.length - (currentIdx + 1);
    reckoningTurnCountdown = remainingInRound + state.players.length;
  }

  // Record the draw itself as an event, with the index/rate move folded in
  // so the log reads as a full account of what happened, not just money.
  let logNote = NEWS_CARD_LABELS[code] ?? code;
  if (indexPosition !== state.indexPosition) {
    logNote += ` (Index ${indexPosition > state.indexPosition ? "↑" : "↓"} to step ${indexPosition})`;
  }
  if (ratePosition !== state.ratePosition) {
    logNote += ` (Rate ${ratePosition > state.ratePosition ? "↑" : "↓"} to step ${ratePosition})`;
  }
  const drawLog = pushEvent(
    { ...state, eventLog, seq },
    { playerId: null, delta: null, balanceAfter: null, reason: "NEWS_DRAW", description: `Drew: ${logNote}` },
  );
  eventLog = drawLog.eventLog;
  seq = drawLog.seq;

  return {
    state: {
      ...state,
      players,
      eventLog,
      seq,
      indexPosition,
      ratePosition,
      reckoningDrawn,
      reckoningTurnCountdown,
      newsQueue: rest,
      newsHistory: [...state.newsHistory, code],
    },
    code,
  };
}

export function drawNews(state: GameState): { state: GameState; code: string | null } {
  return resolveNewsCard(state);
}

export interface GoResult {
  code: string | null;
  dividend: number;
  interest: number;
}

/** The whole GO checklist: draw news, pay this player's dividends (with chain bonus), charge loan interest. */
export function collectGo(state: GameState, playerId: string): { state: GameState; result: GoResult } {
  const { state: afterNews, code } = resolveNewsCard(state);

  const player = afterNews.players.find((p) => p.id === playerId)!;

  // v1.2 distressed swap: if the player forfeited their next dividend
  // collection, skip it and clear the flag.
  let dividend = 0;
  let working = afterNews;

  if (player.skipNextDividend) {
    // Clear the flag — dividend stays 0 this lap.
    const players = working.players.map((p) =>
      p.id === playerId ? { ...p, skipNextDividend: false } : p,
    );
    const { eventLog, seq } = pushEvent(
      { ...working, players },
      {
        playerId,
        delta: 0,
        balanceAfter: player.cash,
        reason: "DISTRESSED_SWAP_SKIP",
        description: "Distressed swap: dividends forfeited this lap",
      },
    );
    working = { ...working, players, eventLog, seq };
  } else {
    for (const deed of afterNews.deeds) {
      if (deed.ownerId !== playerId) continue;
      dividend += dividendFor(deed, afterNews.deeds);
    }
    if (dividend !== 0) {
      const { players, eventLog, seq } = applyDelta(working, playerId, dividend, "DIVIDEND", "GO dividends");
      working = { ...working, players, eventLog, seq };
    }
  }

  const currentPlayer = working.players.find((p) => p.id === playerId)!;
  const interest = currentPlayer.loanNotes * interestPerNote(working.ratePosition);
  if (interest !== 0) {
    const { players, eventLog, seq } = applyDelta(working, playerId, -interest, "INTEREST", "Loan interest");
    working = { ...working, players, eventLog, seq };
  }

  return { state: working, result: { code, dividend, interest } };
}

// ---------------------------------------------------------------------------
// End game / reset
// ---------------------------------------------------------------------------

export function finishGame(state: GameState): GameState {
  return { ...state, status: "FINISHED" };
}

export function resetGame(): GameState {
  return emptyState();
}
