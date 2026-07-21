import { INDEX_STEPS } from "@/types/game";
import type { Company, GameDeed, Zone } from "@/types/game";
import type { Player } from "@/types/lobby";

export function zoneForIndex(indexPosition: number): Zone {
  return INDEX_STEPS[indexPosition]?.zone ?? "NORMAL";
}

export function currentMarketPrice(company: Company, indexPosition: number): number {
  return company.priceByIndex[indexPosition] ?? company.priceByIndex[2];
}

export function currentBuyback(company: Company, indexPosition: number): number {
  const zone = zoneForIndex(indexPosition);
  if (zone === "RECESSION") return company.buybackRecession;
  if (zone === "BOOM") return company.buybackBoom;
  return company.buybackNormal;
}

/** How many deeds of this chain a player owns (0 for chainless utilities). */
export function chainCountFor(
  deeds: GameDeed[],
  companiesById: Map<number, Company>,
  playerId: string,
  chainCode: string | null,
): number {
  if (!chainCode) return 0;
  return deeds.filter((d) => {
    if (d.ownerPlayerId !== playerId) return false;
    const c = companiesById.get(d.companyId);
    return c?.chainCode === chainCode;
  }).length;
}

/** Dividend for one deed at GO, including the 1.5x/2x chain bonus. */
export function dividendFor(
  company: Company,
  deed: GameDeed,
  deeds: GameDeed[],
  companiesById: Map<number, Company>,
): number {
  const levelStats =
    deed.devLevel === "FIXED" ? company.levels.KIOSK : company.levels[deed.devLevel];
  if (!levelStats) return 0;

  const owned = deed.ownerPlayerId
    ? chainCountFor(deeds, companiesById, deed.ownerPlayerId, company.chainCode)
    : 0;
  const mult = owned >= 3 ? 2 : owned === 2 ? 1.5 : 1;
  return Math.floor(levelStats.dividend * mult);
}

/** Landing payment for one deed at the current zone, including the 3-of-3 chain bonus. */
export function landingFor(
  company: Company,
  deed: GameDeed,
  indexPosition: number,
  deeds: GameDeed[],
  companiesById: Map<number, Company>,
): number {
  const levelStats =
    deed.devLevel === "FIXED" ? company.levels.KIOSK : company.levels[deed.devLevel];
  if (!levelStats) return 0;

  const zone = zoneForIndex(indexPosition);
  const base =
    zone === "RECESSION" ? levelStats.landingRecession :
    zone === "BOOM" ? levelStats.landingBoom :
    levelStats.landingNormal;

  const owned = deed.ownerPlayerId
    ? chainCountFor(deeds, companiesById, deed.ownerPlayerId, company.chainCode)
    : 0;
  const mult = owned >= 3 ? 2 : 1;
  return Math.floor(base * mult);
}

export interface ScoreLine {
  playerId: string;
  displayName: string;
  lineA: number; // non-speculative invested x index mult
  lineB: number; // speculative invested x spec mult
  lineC: number; // cash
  lineD: number; // debt
  netWorth: number;
}

/** Final net worth per player: A + B + C - D, per the rulebook's worked example. */
export function computeScoring(
  players: Player[],
  deeds: GameDeed[],
  companiesById: Map<number, Company>,
  indexPosition: number,
): ScoreLine[] {
  const step = INDEX_STEPS[indexPosition] ?? INDEX_STEPS[2];

  const lines = players.map((player): ScoreLine => {
    let nonSpecInvested = 0;
    let specInvested = 0;

    for (const deed of deeds) {
      if (deed.ownerPlayerId !== player.id) continue;
      const company = companiesById.get(deed.companyId);
      if (!company) continue;

      const levelStats =
        deed.devLevel === "FIXED" ? company.levels.KIOSK : company.levels[deed.devLevel];
      const invested = levelStats?.invested ?? 0;

      if (company.riskClass === "SPECULATIVE") {
        specInvested += invested;
      } else {
        nonSpecInvested += invested;
      }
    }

    const lineA = Math.round(nonSpecInvested * step.scoreMultNonSpec);
    const lineB = Math.round(specInvested * step.scoreMultSpec);
    const lineC = player.cash;
    const lineD = player.loanNotes * 5000;

    return {
      playerId: player.id,
      displayName: player.displayName,
      lineA,
      lineB,
      lineC,
      lineD,
      netWorth: lineA + lineB + lineC - lineD,
    };
  });

  return lines.sort((a, b) => b.netWorth - a.netWorth || b.lineC - a.lineC);
}
