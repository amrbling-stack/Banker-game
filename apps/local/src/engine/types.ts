// Domain types for the local, single-browser Ras El-Mal companion.
// No backend, no auth — this is the entire data model, held in memory
// and mirrored to localStorage so a page refresh doesn't lose the game.

export type RiskClass = "DEFENSIVE" | "CYCLICAL" | "SPECULATIVE" | "UTILITY";
export type DevLevel = "KIOSK" | "SHOP" | "CHAIN" | "FIXED";
export type Zone = "RECESSION" | "NORMAL" | "BOOM";
export type GameStatus = "SETUP" | "PLAYING" | "FINISHED";

export interface CompanyLevelStats {
  dividend: number;
  landingRecession: number;
  landingNormal: number;
  landingBoom: number;
  invested: number;
}

export interface Company {
  id: number;
  nameEn: string;
  nameAr: string;
  chainCode: string | null;
  riskClass: RiskClass;
  stickerPrice: number;
  develops: boolean;
  priceByIndex: number[]; // [70, 85, 100, 115, 130]
  kiosk: CompanyLevelStats; // utilities' single FIXED level lives here too
  shop: CompanyLevelStats | null;
  chain: CompanyLevelStats | null;
  developCostShop: number | null;
  developCostChain: number | null;
  buybackRecession: number;
  buybackNormal: number;
  buybackBoom: number;
}

export interface Player {
  id: string;
  seat: number;
  name: string;
  cash: number;
  loanNotes: number;
  /** Set by distressedSwap(): dividends are skipped on the next GO. */
  skipNextDividend?: boolean;
  /** Feedback item #12 (Gold, experimental): units of gold held, capped at 3. */
  goldUnits?: number;
}

export interface Deed {
  companyId: number;
  ownerId: string | null;
  devLevel: DevLevel;
}

/**
 * A single recorded event — every cash movement AND every structural change
 * (news drawn, index/rate moved, ownership transferred without payment,
 * etc.) gets one of these. This is item #31 finished properly: "build item
 * 10 as an event log — every action is a recorded event, and undo becomes
 * pop the last event, plus you get a full audit trail." `delta`/`playerId`
 * are null for events that don't move a specific player's cash (a news
 * draw, an index step).
 */
export interface EventLogEntry {
  id: string;
  seq: number;
  playerId: string | null;
  delta: number | null;
  balanceAfter: number | null;
  reason: string;
  description: string;
  createdAt: number;
}

/**
 * Feedback item #16 (Gulf investor personal offer, experimental — flagged
 * for its own playtest session). A public, on-screen dilemma at a random
 * eligible player's turn start: "A Gulf investor calls [name]: [price] for
 * [company] — accept or decline." Deliberately public (one shared screen
 * has no private notifications), fixed generous price, and restricted to
 * SPECULATIVE companies only — widening eligibility would change what the
 * card is for (it's the exit ramp for speculative positions at the top).
 */
export interface GulfOffer {
  playerId: string;
  companyId: number;
  price: number;
}

/**
 * Feedback item #3 (The Leak / التسريب, experimental — the advisor's
 * strongest pushback on the whole list: "playtest without it first"). If
 * built at all: one card, single-use, sold by open auction, with a visible
 * "insider" token on whoever holds it so the table can discount their
 * behavior. Reveals the top of the news queue without drawing it, then is
 * spent forever — not resold, not reusable.
 */
export interface LeakState {
  ownerId: string | null;
  used: boolean;
}

/**
 * Experimental-feature toggles, chosen once at setup (per the playtest
 * protocol: change one thing at a time, and these three are explicitly
 * flagged as needing their own dedicated sessions). All default off.
 */
export interface GameSettings {
  enableLeak: boolean;
  enableGold: boolean;
  enableGulfOffer: boolean;
  /**
   * Optional variant (rulebook v1.5 section 19): a small per-company +/-
   * price nudge on top of the index price, rolled with a virtual d6
   * whenever the index moves. Only ever touches the BUY price of an
   * unowned company -- dividends, landings, buybacks, and every scoring
   * figure are computed exactly as before. Off by default, same as the
   * other three experimental toggles.
   */
  enableBetaWobble: boolean;
}

export function defaultSettings(): GameSettings {
  return { enableLeak: false, enableGold: false, enableGulfOffer: false, enableBetaWobble: false };
}

export interface GameState {
  status: GameStatus;
  players: Player[];
  deeds: Deed[]; // 30, one per company
  indexPosition: number; // 0..4
  ratePosition: number; // 0..3
  reckoningDrawn: boolean;
  /** Turns remaining after Reckoning drawn (null until then; 0 = time to score). */
  reckoningTurnCountdown: number | null;
  currentPlayerId: string | null;
  newsQueue: string[]; // undrawn codes, in draw order
  newsHistory: string[]; // drawn codes, oldest first
  eventLog: EventLogEntry[];
  seq: number; // running counter for event log ids
  settings: GameSettings;
  leak: LeakState;
  pendingGulfOffer: GulfOffer | null;
  /**
   * The Compound in Sheikh Zayed (formerly "National Project") unlocks for
   * auction permanently, exactly once, the moment every one of the 30
   * ordinary board companies has an owner. It stays unlocked even if a
   * deed is later sold back to the bank -- this is a one-way trigger, not
   * a live "are all 30 currently owned" check. Replaces the old v1.3
   * 8-news-card gate.
   */
  nationalProjectUnlocked: boolean;
  /** Transient: true for one render right after the unlock fires, so the
   * UI can show a one-time table-wide notification, then gets cleared. */
  nationalProjectJustUnlocked: boolean;
}

/** Index track: position -> value/zone/scoring multipliers. */
export const INDEX_STEPS = [
  { position: 0, value: 70, zone: "RECESSION" as Zone, scoreMultNonSpec: 0.70, scoreMultSpec: 0.40 },
  { position: 1, value: 85, zone: "RECESSION" as Zone, scoreMultNonSpec: 0.85, scoreMultSpec: 0.70 },
  { position: 2, value: 100, zone: "NORMAL" as Zone, scoreMultNonSpec: 1.00, scoreMultSpec: 1.00 },
  { position: 3, value: 115, zone: "BOOM" as Zone, scoreMultNonSpec: 1.15, scoreMultSpec: 1.30 },
  { position: 4, value: 130, zone: "BOOM" as Zone, scoreMultNonSpec: 1.30, scoreMultSpec: 1.60 },
];

/** Rate track: position -> percent / interest per 5,000 note per lap. */
export const RATE_STEPS = [
  { position: 0, percent: 5, interestPerNote: 250 },
  { position: 1, percent: 8, interestPerNote: 400 },
  { position: 2, percent: 11, interestPerNote: 550 },
  { position: 3, percent: 14, interestPerNote: 700 },
];

/** Short effect descriptions shown in the news modal after a card is drawn. */
export const NEWS_CARD_EFFECTS: Record<string, string> = {
  MARKET_UP_1: "Market Index moves up one step.",
  MARKET_DOWN_1: "Market Index moves down one step.",
  GAS_FIELD_UP_2: "Market Index moves up two steps.",
  CRISIS_DOWN_2: "Market Index moves down two steps.",
  CB_RAISE: "Interest rate rises one step. Loan costs increase at the next GO.",
  CB_CUT: "Interest rate falls one step. Loan costs decrease at the next GO.",
  FLOTATION: "Every player's cash is halved immediately (rounded up to nearest 100).",
  GOV_OFFERING: "Bank auctions every deed it holds, one at a time. Use the Auction tab.",
  GULF_INVESTOR: "Only fires at index 115+. Buyer offers up to 110% of sticker on a speculative company.",
  QUIET_DAY: "Nothing happens. The market is quiet.",
  RECKONING: "Finish this round, play one full final round, then score all players.",
};

export const NEWS_CARD_LABELS: Record<string, string> = {
  MARKET_UP_1: "Property boom — Market Index up one step",
  MARKET_DOWN_1: "Pound slips — Market Index down one step",
  GAS_FIELD_UP_2: "Giant gas field discovered — Index up two steps",
  CRISIS_DOWN_2: "Global economic crisis — Index down two steps",
  CB_RAISE: "Central Bank raises rates",
  CB_CUT: "Central Bank cuts rates",
  FLOTATION: "Flotation — every player's cash is halved",
  GOV_OFFERING: "Government offering — bank auctions everything it holds",
  GULF_INVESTOR: "Gulf investor arrives (only acts if index is 115+)",
  QUIET_DAY: "A quiet day in the markets — no effect",
  RECKONING: "THE RECKONING — finish this round, play one more, then score",
};

export const CHAIN_LABELS: Record<string, string> = {
  C1: "Olive Oil",
  C2: "Poultry",
  C3: "Pharmaceuticals",
  C4: "Healthcare",
  C5: "Education",
  C6: "Digital Delivery",
  C7: "Internet & Tech",
  C8: "AI & Cloud",
  C9: "Media",
};

/** Arabic zone names for the market ticker. */
export const ZONE_LABELS_AR: Record<string, string> = {
  RECESSION: "كساد",
  NORMAL: "عادي",
  BOOM: "طفرة",
};

/** Company IDs that are special projects (no board space, auction-only entry). */
export const SPECIAL_PROJECT_IDS = new Set<number>([40]);

/**
 * Feedback item #11: level-3 was called "Chain" while the nine company
 * sets are *also* called chains — a genuine collision that confuses new
 * players. Kiosk and Shop stay (they're charming and already unambiguous);
 * the top level is renamed to "Group" / "مجموعة" (the natural Egyptian
 * corporate term). The underlying DevLevel string stays "CHAIN" so no save
 * data or scoring math has to change — this is a display-only rename.
 */
export const LEVEL_LABELS: Record<DevLevel, { en: string; ar: string }> = {
  KIOSK: { en: "Kiosk", ar: "كشك" },
  SHOP: { en: "Shop", ar: "محل" },
  CHAIN: { en: "Group", ar: "مجموعة" },
  FIXED: { en: "Utility", ar: "مرفق" },
};
