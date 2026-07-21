// Domain types for the game/banking layer (Feature 2).
// Field names are camelCase mirrors of the `companies` / `game_deeds` /
// `ledger_entries` / `news_deck` tables.

export type RiskClass = "DEFENSIVE" | "CYCLICAL" | "SPECULATIVE" | "UTILITY";
export type DevLevel = "KIOSK" | "SHOP" | "CHAIN" | "FIXED";
export type Zone = "RECESSION" | "NORMAL" | "BOOM";

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
  /** Market price at index positions [70, 85, 100, 115, 130]. */
  priceByIndex: [number, number, number, number, number];
  levels: {
    KIOSK: CompanyLevelStats; // also used as the utilities' single FIXED level
    SHOP: CompanyLevelStats | null;
    CHAIN: CompanyLevelStats | null;
  };
  developCostShop: number | null;
  developCostChain: number | null;
  buybackRecession: number;
  buybackNormal: number;
  buybackBoom: number;
}

export interface GameDeed {
  id: string;
  gameId: string;
  companyId: number;
  ownerPlayerId: string | null;
  devLevel: DevLevel;
  updatedAt: string;
}

export interface LedgerEntry {
  id: string;
  gameId: string;
  playerId: string;
  seq: number;
  delta: number;
  balanceAfter: number;
  reason: string;
  description: string | null;
  createdAt: string;
}

export interface NewsDeckCard {
  id: string;
  gameId: string;
  drawOrder: number;
  code: string;
  drawn: boolean;
  drawnAt: string | null;
}

/** The 11 news card codes and how to describe them in the news log. */
export const NEWS_CARD_LABELS: Record<string, string> = {
  MARKET_UP_1: "Market up one step",
  MARKET_DOWN_1: "Market down one step",
  GAS_FIELD_UP_2: "Giant gas field — index up two steps",
  CRISIS_DOWN_2: "Global crisis — index down two steps",
  CB_RAISE: "Central Bank raises rates",
  CB_CUT: "Central Bank cuts rates",
  FLOTATION: "Flotation — everyone's cash halved",
  GOV_OFFERING: "Government offering — auction all bank-held companies",
  GULF_INVESTOR: "Gulf investor (active only at index 115+)",
  QUIET_DAY: "Quiet day — no effect",
  RECKONING: "THE RECKONING — finish this round, play one more, then score",
};

/** Index track: position -> {value, zone, scoring multipliers}. */
export const INDEX_STEPS: {
  position: number;
  value: number;
  zone: Zone;
  scoreMultNonSpec: number;
  scoreMultSpec: number;
}[] = [
  { position: 0, value: 70, zone: "RECESSION", scoreMultNonSpec: 0.70, scoreMultSpec: 0.40 },
  { position: 1, value: 85, zone: "RECESSION", scoreMultNonSpec: 0.85, scoreMultSpec: 0.70 },
  { position: 2, value: 100, zone: "NORMAL", scoreMultNonSpec: 1.00, scoreMultSpec: 1.00 },
  { position: 3, value: 115, zone: "BOOM", scoreMultNonSpec: 1.15, scoreMultSpec: 1.30 },
  { position: 4, value: 130, zone: "BOOM", scoreMultNonSpec: 1.30, scoreMultSpec: 1.60 },
];

/** Rate track: position -> {percent, interest per 5,000 note per lap}. */
export const RATE_STEPS: { position: number; percent: number; interestPerNote: number }[] = [
  { position: 0, percent: 5, interestPerNote: 250 },
  { position: 1, percent: 8, interestPerNote: 400 },
  { position: 2, percent: 11, interestPerNote: 550 },
  { position: 3, percent: 14, interestPerNote: 700 },
];
