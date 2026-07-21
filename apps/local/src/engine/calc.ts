import { INDEX_STEPS, RATE_STEPS, SPECIAL_PROJECT_IDS } from "./types";
import type { Company, Deed, GameState, Player, Zone } from "./types";
import { COMPANIES } from "./companies";

// ---------------------------------------------------------------------------
// Compound in Sheikh Zayed auction trigger (v1.6, replaces the old v1.3
// 8-news-card gate)
// ---------------------------------------------------------------------------
//
// The Compound in Sheikh Zayed (formerly "National Project") unlocks for
// auction the moment every one of the 30 ordinary board companies has an
// owner -- not on a news-card count. This still solves the original problem
// the v1.3 gate was written for (no uncontested turn-2 snipe on a token bid,
// since the whole board has to sell out first), while tying availability to
// actual market state instead of an arbitrary counter.
export function allOrdinaryDeedsOwned(deeds: Deed[]): boolean {
  const ordinary = deeds.filter((d) => !SPECIAL_PROJECT_IDS.has(d.companyId));
  return ordinary.length > 0 && ordinary.every((d) => d.ownerId !== null);
}

/** Whether a given company is gated (i.e. is a National-Project-style special project not yet eligible for auction). */
export function isAuctionGated(companyId: number, state: Pick<GameState, "nationalProjectUnlocked">): boolean {
  if (!SPECIAL_PROJECT_IDS.has(companyId)) return false;
  return !state.nationalProjectUnlocked;
}

export const COMPANIES_BY_ID = new Map<number, Company>(COMPANIES.map((c) => [c.id, c]));

export function zoneForIndex(indexPosition: number): Zone {
  return INDEX_STEPS[indexPosition]?.zone ?? "NORMAL";
}

export function currentMarketPrice(company: Company, indexPosition: number): number {
  return company.priceByIndex[indexPosition] ?? company.priceByIndex[2];
}

// ---------------------------------------------------------------------------
// Beta Wobble (optional variant, rulebook v1.5 section 19)
// ---------------------------------------------------------------------------
//
// Off by default (settings.enableBetaWobble). Adds a small company-specific
// +/- nudge on top of the index-derived market price -- and ONLY on the buy
// price. Dividends, landings, buybacks, and every scoring figure (invested
// capital is always the printed number, same as the National Project) are
// completely untouched by this variant.
//
// The "roll" is a deterministic pseudo-die derived from the company id and
// how many news cards have been resolved so far, so it reproduces the
// physical rule ("reroll whenever the index moves") without needing extra
// state: it's stable for as long as newsHistory.length doesn't change, and
// changes again the next time a news card is drawn -- exactly like a real
// die sitting next to a card that just flipped.
const BETA_WOBBLE_MAX_PCT: Record<Company["riskClass"], number> = {
  DEFENSIVE: 0.02,
  UTILITY: 0.02,
  CYCLICAL: 0.05,
  SPECULATIVE: 0.10,
};
const WOBBLE_DIE_STEPS = [-1.0, -0.6, -0.2, 0.2, 0.6, 1.0]; // matches the printed 1-6 table

function wobbleDieFace(companyId: number, newsCount: number): number {
  const seed = (companyId * 2654435761 + newsCount * 40503) >>> 0;
  return seed % 6;
}

/** The buy price a player actually pays for an unowned company, including
 * the Beta Wobble nudge if that variant is on. Falls back to the plain
 * index price when the variant is off or the company is a special project
 * (the National Project is never wobbled -- it's auction-priced, not
 * index-priced, per rulebook section 15). */
export function currentBuyPrice(
  company: Company,
  state: Pick<GameState, "indexPosition" | "newsHistory" | "settings">,
): number {
  const base = currentMarketPrice(company, state.indexPosition);
  if (!state.settings.enableBetaWobble || SPECIAL_PROJECT_IDS.has(company.id)) return base;
  const maxPct = BETA_WOBBLE_MAX_PCT[company.riskClass];
  const face = wobbleDieFace(company.id, state.newsHistory.length);
  const pct = WOBBLE_DIE_STEPS[face] * maxPct;
  return Math.max(100, Math.floor((base * (1 + pct)) / 100) * 100);
}

export function currentBuyback(company: Company, indexPosition: number): number {
  const zone = zoneForIndex(indexPosition);
  if (zone === "RECESSION") return company.buybackRecession;
  if (zone === "BOOM") return company.buybackBoom;
  return company.buybackNormal;
}

export function interestPerNote(ratePosition: number): number {
  return RATE_STEPS[ratePosition]?.interestPerNote ?? 0;
}

/** Level stats for a deed's current development level (FIXED reads the kiosk level). */
export function levelStatsFor(company: Company, devLevel: string) {
  if (devLevel === "FIXED" || devLevel === "KIOSK") return company.kiosk;
  if (devLevel === "SHOP") return company.shop;
  if (devLevel === "CHAIN") return company.chain;
  return null;
}

/** How many deeds of this chain a player owns (0 for chainless utilities). */
export function chainCountFor(deeds: Deed[], playerId: string, chainCode: string | null): number {
  if (!chainCode) return 0;
  let count = 0;
  for (const d of deeds) {
    if (d.ownerId !== playerId) continue;
    const c = COMPANIES_BY_ID.get(d.companyId);
    if (c?.chainCode === chainCode) count++;
  }
  return count;
}

export function dividendFor(deed: Deed, deeds: Deed[]): number {
  const company = COMPANIES_BY_ID.get(deed.companyId);
  if (!company || !deed.ownerId) return 0;
  const stats = levelStatsFor(company, deed.devLevel);
  if (!stats) return 0;
  const owned = chainCountFor(deeds, deed.ownerId, company.chainCode);
  const mult = owned >= 3 ? 2 : owned === 2 ? 1.5 : 1;
  return Math.floor(stats.dividend * mult);
}

export function landingFor(deed: Deed, deeds: Deed[], indexPosition: number): number {
  const company = COMPANIES_BY_ID.get(deed.companyId);
  if (!company || !deed.ownerId) return 0;
  const stats = levelStatsFor(company, deed.devLevel);
  if (!stats) return 0;
  const zone = zoneForIndex(indexPosition);
  const base =
    zone === "RECESSION" ? stats.landingRecession : zone === "BOOM" ? stats.landingBoom : stats.landingNormal;
  const owned = chainCountFor(deeds, deed.ownerId, company.chainCode);
  const mult = owned >= 3 ? 2 : 1;
  return Math.floor(base * mult);
}

// ---------------------------------------------------------------------------
// Gold (feedback item #12, experimental)
// ---------------------------------------------------------------------------
//
// "Cash is already index-immune — the only cash threats are Flotation and
// taxes. Gold's real function is a Flotation shelter plus a second
// speculation instrument." Lean version, zero new components:
//   gold price = 20,000 − (index × 100)
// so it's inverse to the market automatically — "flight to safety" for
// free. A spread (buy at +10%, sell at −10%) and a 3-unit-per-player cap
// keep it a partial hedge rather than a perfect one, since a perfect hedge
// would neuter the game's core idea that crashes are supposed to hurt.

export const GOLD_UNIT_CAP = 3;

/** Base gold price for the current index step (10,000 at Normal, 13,000 in deep recession, 7,000 at the top). */
export function goldBasePrice(indexPosition: number): number {
  const value = INDEX_STEPS[indexPosition]?.value ?? 100;
  return 20000 - value * 100;
}

/** What the bank charges a player buying gold (base + 10%, rounded to the nearest 100). */
export function goldBuyPrice(indexPosition: number): number {
  return Math.round((goldBasePrice(indexPosition) * 1.1) / 100) * 100;
}

/** What the bank pays a player selling gold back (base − 10%, rounded to the nearest 100). */
export function goldSellPrice(indexPosition: number): number {
  return Math.round((goldBasePrice(indexPosition) * 0.9) / 100) * 100;
}

export interface ScoreLine {
  playerId: string;
  name: string;
  investedNonSpec: number;
  investedSpec: number;
  lineA: number;
  lineB: number;
  lineC: number;
  lineD: number;
  netWorth: number;
}

/**
 * Final net worth per player: A + B + C - D, matching the rulebook's worked
 * example. When Gold (item #12) is in play, line C becomes cash + gold
 * holdings valued at the current bank sell price — gold is real, spendable
 * value, so it belongs in net worth like cash does.
 */
export function computeScoring(players: Player[], deeds: Deed[], indexPosition: number): ScoreLine[] {
  const step = INDEX_STEPS[indexPosition] ?? INDEX_STEPS[2];
  const goldValue = goldSellPrice(indexPosition);

  const lines = players.map((player): ScoreLine => {
    let nonSpec = 0;
    let spec = 0;

    for (const deed of deeds) {
      if (deed.ownerId !== player.id) continue;
      const company = COMPANIES_BY_ID.get(deed.companyId);
      if (!company) continue;
      const stats = levelStatsFor(company, deed.devLevel);
      const invested = stats?.invested ?? 0;
      if (company.riskClass === "SPECULATIVE") spec += invested;
      else nonSpec += invested;
    }

    const lineA = Math.round(nonSpec * step.scoreMultNonSpec);
    const lineB = Math.round(spec * step.scoreMultSpec);
    const lineC = player.cash + (player.goldUnits ?? 0) * goldValue;
    const lineD = player.loanNotes * 5000;

    return {
      playerId: player.id,
      name: player.name,
      investedNonSpec: nonSpec,
      investedSpec: spec,
      lineA,
      lineB,
      lineC,
      lineD,
      netWorth: lineA + lineB + lineC - lineD,
    };
  });

  return lines.sort((a, b) => b.netWorth - a.netWorth || b.lineC - a.lineC);
}

/**
 * Loan ceiling in notes: half the total INVESTED CAPITAL of a player's owned
 * deeds at their current development level (not sticker price).
 *
 * Rule change v1.2: developing a company raises your ceiling, rewarding
 * builders rather than dip-timers who buy and sit.
 *
 * Example: Pharma Factory at Kiosk → ceiling basis 26,000; developed to
 * Group, basis 65,000, unlocking three more loan notes.
 */
export function loanCeilingNotes(deeds: Deed[], playerId: string): number {
  let investedSum = 0;
  for (const d of deeds) {
    if (d.ownerId !== playerId) continue;
    const c = COMPANIES_BY_ID.get(d.companyId);
    if (!c) continue;
    const stats = levelStatsFor(c, d.devLevel);
    // Fall back to sticker if stats are missing (shouldn't happen in practice)
    investedSum += stats?.invested ?? c.stickerPrice;
  }
  return Math.floor((0.5 * investedSum) / 5000);
}
