# Ras El-Mal Companion — MVP

A digital banker for the physical board game. The board, dice, and deed
cards stay on the table; this app tracks every number: cash, deed
ownership, loans, the market index, the interest rate, the news deck,
dividends, landings, and final scoring.

**Design assumptions (deliberate, not gaps):**
- One banker operates one browser for the whole game.
- Players are trusted — this is a bookkeeping tool, not a referee.
- Auctions are decided verbally at the table; the app just records the
  final price via "Assign company."
- Required payments (tax, interest, rent) can take a player's cash
  negative rather than running the full multi-step default sequence —
  the table resolves that physically, same as a real ledger would.

## Project layout

```
supabase/
  migrations/
    0001_lobby_schema.sql   # games, players, lobby RPCs (create/join/leave/start)
    0002_game_schema.sql    # companies (30 seeded deeds), game_deeds, ledger_entries,
                             # news_deck, and every banking/market/scoring RPC
  functions/                 # lobby-only edge functions (create/join/leave/start-game)
apps/web/
  src/
    pages/       HomePage, CreateGamePage, JoinGamePage, LobbyPage, GamePage
    components/  shared UI + components/game/ (MarketBar, PlayerCard, CompanyRow,
                 CompaniesPanel, NewsLog, ScoreBoard)
    hooks/       useAnonymousAuth, useLobby, useGameData, useCompanies
    lib/         Supabase client + mappers, api/lobbyApi.ts (edge functions),
                 api/gameApi.ts (direct RPC calls), gameCalc.ts (pure scoring/pricing math)
    types/       lobby.ts, game.ts
```

## How the game-phase actions work

Feature 1's lobby flow (create/join/start) is untouched. Once the host
starts the game, everyone's lobby screen redirects to `/game/:gameId` —
the banker's dashboard, with three tabs:

- **Players** — each player's cash and loan notes, a **GO** button (draws
  a news card, pays that player's dividends with chain bonus, charges
  loan interest), **Pay tax**, and expandable loan/pay-bank/transfer
  controls.
- **Companies** — all 30 deeds grouped by chain. Tap one to buy it,
  develop it, sell it back to the bank, or collect a landing payment from
  whoever landed on it (with the chain-bonus and market-zone math already
  applied).
- **News** — draw a card for the physical board's Breaking News spaces,
  plus a short history of what's been drawn.

**End game & score** is available any time; once pressed the game locks
and shows the final net-worth scoreboard (A + B + C − D, per the
rulebook's worked example — verified to reproduce it exactly).

## Running it

```bash
# 1. Apply both migrations to your Supabase project, in order
supabase db push   # or: supabase migration up

# 2. Deploy the lobby edge functions (game-phase actions call RPCs directly,
#    no edge functions needed for those)
supabase functions deploy create-game
supabase functions deploy join-game
supabase functions deploy leave-game
supabase functions deploy start-game

# 3. Configure and run the web app
cd apps/web
cp .env.example .env.local   # fill in your project's URL + anon key
npm install
npm run dev
```

Then open the printed local URL, tap **Host a new game**, share the join
code, and once everyone's in, the host rolls the physical dice, tells the
app who won, and taps **Start game**.

## Verification status — please read before trusting this blindly

This sandbox has **no network access**, even to the nominally-allowed
package registries (`npm install` returns `403 Forbidden` on every
attempt, including a fresh retry). That means `npm run build`, `tsc`, and
any actual browser run could not be executed here. I did not skip
verification because of this — instead:

- Every SQL function was re-read end to end against the actual table
  schema it operates on (30 functions, all cross-checked for column names,
  control-flow balance, and return shapes).
- The 30-company seed data was generated programmatically from the
  transcribed deed cards (not hand-typed) and spot-checked against the
  rulebook's own worked scoring example (Nadia's 132,075 net worth
  reproduces exactly).
- The news deck composition sums to 30 cards and the 7-per-player /
  29-card-cap / Reckoning-in-bottom-quarter rule is implemented and
  reasoned through by hand.
- Every `.tsx`/`.ts` file was checked for brace/paren balance, unused
  imports, and React's rules-of-hooks (no hooks after conditional
  returns).
- Three real bugs were found this way and fixed, not left for you to
  discover: (1) the `@/` Vite import alias was declared in tsconfig but
  never registered with Vite's own resolver; (2) a TypeScript closure-
  narrowing gap where a `string | null` route param was used inside a
  nested `async function` after an early-return null check (fixed in both
  the old lobby hook and the new game-data hook); (3) `gameApi.ts`
  originally funneled every RPC call through a generic `fn: string`
  helper, which doesn't type-check against a Supabase client created with
  `createClient<Database>()` — rewritten to call `.rpc()` directly with
  literal function names per call site.

**What I could not do:** actually compile it or click through it. Please
run `npm install && npm run build` as your first step — if anything
surfaces, it'll almost certainly be a small, mechanical fix (a missed
import or a Supabase type-generation nuance), not a structural problem,
given how thoroughly the logic itself was traced by hand.
