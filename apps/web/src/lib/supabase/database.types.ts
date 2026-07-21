// Hand-maintained subset of the Supabase generated types, scoped to the
// tables this app touches. Regenerate with `supabase gen types typescript`
// once this drifts too far to maintain by hand.

export type GameStatusRow =
  | "SETUP"
  | "ACTIVE"
  | "ENDGAME_COUNTDOWN"
  | "SCORING"
  | "COMPLETE";

export type RiskClassRow = "DEFENSIVE" | "CYCLICAL" | "SPECULATIVE" | "UTILITY";
export type DevLevelRow = "KIOSK" | "SHOP" | "CHAIN" | "FIXED";

export interface Database {
  public: {
    Tables: {
      games: {
        Row: {
          id: string;
          join_code: string;
          status: GameStatusRow;
          min_players: number;
          max_players: number;
          host_player_id: string | null;
          starting_player_id: string | null;
          active_player_id: string | null;
          rules_version: string;
          index_position: number;
          rate_position: number;
          reckoning_drawn: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: never; // writes only happen through RPCs
        Update: never;
      };
      players: {
        Row: {
          id: string;
          game_id: string;
          user_id: string;
          seat_number: number;
          display_name: string;
          starting_cash: number;
          is_host: boolean;
          play_order: number | null;
          cash: number;
          loan_notes: number;
          joined_at: string;
        };
        Insert: never;
        Update: never;
      };
      companies: {
        Row: {
          id: number;
          name_en: string;
          name_ar: string;
          chain_code: string | null;
          risk_class: RiskClassRow;
          sticker_price: number;
          develops: boolean;
          price_70: number;
          price_85: number;
          price_100: number;
          price_115: number;
          price_130: number;
          kiosk_dividend: number;
          kiosk_landing_recession: number;
          kiosk_landing_normal: number;
          kiosk_landing_boom: number;
          kiosk_invested: number;
          shop_dividend: number | null;
          shop_landing_recession: number | null;
          shop_landing_normal: number | null;
          shop_landing_boom: number | null;
          shop_invested: number | null;
          chain_dividend: number | null;
          chain_landing_recession: number | null;
          chain_landing_normal: number | null;
          chain_landing_boom: number | null;
          chain_invested: number | null;
          develop_cost_shop: number | null;
          develop_cost_chain: number | null;
          buyback_recession: number;
          buyback_normal: number;
          buyback_boom: number;
        };
        Insert: never;
        Update: never;
      };
      game_deeds: {
        Row: {
          id: string;
          game_id: string;
          company_id: number;
          owner_player_id: string | null;
          dev_level: DevLevelRow;
          updated_at: string;
        };
        Insert: never;
        Update: never;
      };
      ledger_entries: {
        Row: {
          id: string;
          game_id: string;
          player_id: string;
          seq: number;
          delta: number;
          balance_after: number;
          reason: string;
          description: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
      };
      news_deck: {
        Row: {
          id: string;
          game_id: string;
          draw_order: number;
          code: string;
          drawn: boolean;
          drawn_at: string | null;
        };
        Insert: never;
        Update: never;
      };
    };
    Functions: {
      create_game: {
        Args: { p_display_name: string; p_user_id: string };
        Returns: { game_id: string; player_id: string; join_code: string }[];
      };
      join_game: {
        Args: { p_join_code: string; p_display_name: string; p_user_id: string };
        Returns: { game_id: string; player_id: string; seat_number: number }[];
      };
      leave_game: {
        Args: { p_player_id: string; p_user_id: string };
        Returns: void;
      };
      start_game: {
        Args: { p_game_id: string; p_starting_player_id: string; p_user_id: string };
        Returns: void;
      };
      collect_go: {
        Args: { p_game_id: string; p_player_id: string };
        Returns: {
          news_code: string | null;
          dividend_total: number;
          interest_total: number;
          new_cash: number;
          index_position: number;
          rate_position: number;
          reckoning: boolean;
          deck_empty: boolean;
        }[];
      };
      draw_breaking_news: {
        Args: { p_game_id: string };
        Returns: {
          code: string | null;
          index_position: number;
          rate_position: number;
          reckoning: boolean;
          deck_empty: boolean;
        }[];
      };
      assign_company: {
        Args: { p_game_id: string; p_company_id: number; p_player_id: string; p_price: number };
        Returns: void;
      };
      sell_to_bank: {
        Args: { p_game_id: string; p_company_id: number };
        Returns: void;
      };
      develop_company: {
        Args: { p_game_id: string; p_company_id: number };
        Returns: void;
      };
      pay_landing: {
        Args: { p_game_id: string; p_company_id: number; p_payer_player_id: string };
        Returns: { amount: number }[];
      };
      pay_tax: {
        Args: { p_game_id: string; p_player_id: string };
        Returns: { amount: number }[];
      };
      pay_bank: {
        Args: { p_game_id: string; p_player_id: string; p_amount: number; p_label?: string };
        Returns: void;
      };
      grant_bank: {
        Args: { p_game_id: string; p_player_id: string; p_amount: number; p_label?: string };
        Returns: void;
      };
      take_loan: {
        Args: { p_game_id: string; p_player_id: string; p_note_count: number };
        Returns: void;
      };
      repay_loan: {
        Args: { p_game_id: string; p_player_id: string; p_note_count: number };
        Returns: void;
      };
      trade_cash: {
        Args: { p_game_id: string; p_from_player_id: string; p_to_player_id: string; p_amount: number };
        Returns: void;
      };
      finish_game: {
        Args: { p_game_id: string };
        Returns: void;
      };
    };
  };
}
