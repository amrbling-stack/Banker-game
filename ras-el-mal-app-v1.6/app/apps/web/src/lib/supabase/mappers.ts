import type { Database } from "./database.types";
import type { Game, Player } from "@/types/lobby";
import type { Company, GameDeed, LedgerEntry, NewsDeckCard } from "@/types/game";

type GameRow = Database["public"]["Tables"]["games"]["Row"];
type PlayerRow = Database["public"]["Tables"]["players"]["Row"];
type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];
type GameDeedRow = Database["public"]["Tables"]["game_deeds"]["Row"];
type LedgerEntryRow = Database["public"]["Tables"]["ledger_entries"]["Row"];
type NewsDeckRow = Database["public"]["Tables"]["news_deck"]["Row"];

export function mapGame(row: GameRow): Game {
  return {
    id: row.id,
    joinCode: row.join_code,
    status: row.status,
    minPlayers: row.min_players,
    maxPlayers: row.max_players,
    hostPlayerId: row.host_player_id,
    startingPlayerId: row.starting_player_id,
    activePlayerId: row.active_player_id,
    indexPosition: row.index_position,
    ratePosition: row.rate_position,
    reckoningDrawn: row.reckoning_drawn,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapPlayer(row: PlayerRow): Player {
  return {
    id: row.id,
    gameId: row.game_id,
    userId: row.user_id,
    seatNumber: row.seat_number,
    displayName: row.display_name,
    startingCash: row.starting_cash,
    isHost: row.is_host,
    playOrder: row.play_order,
    cash: row.cash,
    loanNotes: row.loan_notes,
    joinedAt: row.joined_at,
  };
}

export function mapCompany(row: CompanyRow): Company {
  return {
    id: row.id,
    nameEn: row.name_en,
    nameAr: row.name_ar,
    chainCode: row.chain_code,
    riskClass: row.risk_class,
    stickerPrice: row.sticker_price,
    develops: row.develops,
    priceByIndex: [row.price_70, row.price_85, row.price_100, row.price_115, row.price_130],
    levels: {
      KIOSK: {
        dividend: row.kiosk_dividend,
        landingRecession: row.kiosk_landing_recession,
        landingNormal: row.kiosk_landing_normal,
        landingBoom: row.kiosk_landing_boom,
        invested: row.kiosk_invested,
      },
      SHOP: row.shop_dividend === null ? null : {
        dividend: row.shop_dividend,
        landingRecession: row.shop_landing_recession!,
        landingNormal: row.shop_landing_normal!,
        landingBoom: row.shop_landing_boom!,
        invested: row.shop_invested!,
      },
      CHAIN: row.chain_dividend === null ? null : {
        dividend: row.chain_dividend,
        landingRecession: row.chain_landing_recession!,
        landingNormal: row.chain_landing_normal!,
        landingBoom: row.chain_landing_boom!,
        invested: row.chain_invested!,
      },
    },
    developCostShop: row.develop_cost_shop,
    developCostChain: row.develop_cost_chain,
    buybackRecession: row.buyback_recession,
    buybackNormal: row.buyback_normal,
    buybackBoom: row.buyback_boom,
  };
}

export function mapGameDeed(row: GameDeedRow): GameDeed {
  return {
    id: row.id,
    gameId: row.game_id,
    companyId: row.company_id,
    ownerPlayerId: row.owner_player_id,
    devLevel: row.dev_level,
    updatedAt: row.updated_at,
  };
}

export function mapLedgerEntry(row: LedgerEntryRow): LedgerEntry {
  return {
    id: row.id,
    gameId: row.game_id,
    playerId: row.player_id,
    seq: row.seq,
    delta: row.delta,
    balanceAfter: row.balance_after,
    reason: row.reason,
    description: row.description,
    createdAt: row.created_at,
  };
}

export function mapNewsDeckCard(row: NewsDeckRow): NewsDeckCard {
  return {
    id: row.id,
    gameId: row.game_id,
    drawOrder: row.draw_order,
    code: row.code,
    drawn: row.drawn,
    drawnAt: row.drawn_at,
  };
}
