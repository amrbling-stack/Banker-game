import { supabase } from "@/lib/supabase/client";

/**
 * Every function here calls a Postgres RPC directly (no edge function
 * wrapper — see the migration header for why). `supabase.rpc()` attaches
 * the caller's session automatically, and each function checks
 * `auth.uid() is not null` server-side, so this stays safe without an
 * extra HTTP hop. All of it assumes one trusted banker's browser driving
 * the whole game, per the product brief.
 *
 * Each RPC is called with its literal name and its own properly-shaped
 * argument object (not funneled through a generic `fn: string` helper) —
 * the Supabase client is created with `createClient<Database>()`, so
 * `.rpc()` is strictly typed per function name; a widened `string` name or
 * a generic args bag would defeat that typing entirely.
 */

export class GameApiError extends Error {}

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) {
    throw new GameApiError(result.error.message);
  }
  return result.data as T;
}

export interface GoResult {
  news_code: string | null;
  dividend_total: number;
  interest_total: number;
  new_cash: number;
  index_position: number;
  rate_position: number;
  reckoning: boolean;
  deck_empty: boolean;
}

export interface NewsResult {
  code: string | null;
  index_position: number;
  rate_position: number;
  reckoning: boolean;
  deck_empty: boolean;
}

/** The whole GO checklist: draw news, pay this player's dividends, charge interest. */
export async function collectGo(gameId: string, playerId: string): Promise<GoResult> {
  const rows = unwrap(
    await supabase.rpc("collect_go", { p_game_id: gameId, p_player_id: playerId }),
  );
  return rows[0];
}

/** Breaking News board space: draw + resolve one card, no dividends. */
export async function drawBreakingNews(gameId: string): Promise<NewsResult> {
  const rows = unwrap(await supabase.rpc("draw_breaking_news", { p_game_id: gameId }));
  return rows[0];
}

/** Buy at market price, or record an auction's winning price — same action. */
export async function assignCompany(
  gameId: string,
  companyId: number,
  playerId: string,
  price: number,
): Promise<void> {
  unwrap(
    await supabase.rpc("assign_company", {
      p_game_id: gameId,
      p_company_id: companyId,
      p_player_id: playerId,
      p_price: price,
    }),
  );
}

export async function sellToBank(gameId: string, companyId: number): Promise<void> {
  unwrap(await supabase.rpc("sell_to_bank", { p_game_id: gameId, p_company_id: companyId }));
}

export async function developCompany(gameId: string, companyId: number): Promise<void> {
  unwrap(await supabase.rpc("develop_company", { p_game_id: gameId, p_company_id: companyId }));
}

export async function payLanding(
  gameId: string,
  companyId: number,
  payerPlayerId: string,
): Promise<number> {
  const rows = unwrap(
    await supabase.rpc("pay_landing", {
      p_game_id: gameId,
      p_company_id: companyId,
      p_payer_player_id: payerPlayerId,
    }),
  );
  return rows[0].amount;
}

export async function payTax(gameId: string, playerId: string): Promise<number> {
  const rows = unwrap(
    await supabase.rpc("pay_tax", { p_game_id: gameId, p_player_id: playerId }),
  );
  return rows[0].amount;
}

export async function payBank(
  gameId: string,
  playerId: string,
  amount: number,
  label?: string,
): Promise<void> {
  unwrap(
    await supabase.rpc("pay_bank", {
      p_game_id: gameId,
      p_player_id: playerId,
      p_amount: amount,
      p_label: label,
    }),
  );
}

export async function grantBank(
  gameId: string,
  playerId: string,
  amount: number,
  label?: string,
): Promise<void> {
  unwrap(
    await supabase.rpc("grant_bank", {
      p_game_id: gameId,
      p_player_id: playerId,
      p_amount: amount,
      p_label: label,
    }),
  );
}

export async function takeLoan(gameId: string, playerId: string, noteCount: number): Promise<void> {
  unwrap(
    await supabase.rpc("take_loan", {
      p_game_id: gameId,
      p_player_id: playerId,
      p_note_count: noteCount,
    }),
  );
}

export async function repayLoan(gameId: string, playerId: string, noteCount: number): Promise<void> {
  unwrap(
    await supabase.rpc("repay_loan", {
      p_game_id: gameId,
      p_player_id: playerId,
      p_note_count: noteCount,
    }),
  );
}

export async function tradeCash(
  gameId: string,
  fromPlayerId: string,
  toPlayerId: string,
  amount: number,
): Promise<void> {
  unwrap(
    await supabase.rpc("trade_cash", {
      p_game_id: gameId,
      p_from_player_id: fromPlayerId,
      p_to_player_id: toPlayerId,
      p_amount: amount,
    }),
  );
}

export async function finishGame(gameId: string): Promise<void> {
  unwrap(await supabase.rpc("finish_game", { p_game_id: gameId }));
}
