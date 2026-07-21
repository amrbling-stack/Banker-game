# Ras El-Mal — Local Banker (no backend)

A fully self-contained companion app for playtesting the physical board
game. One laptop, one browser tab, no accounts, no login, no server, no
network calls of any kind. All state lives in memory and mirrors to
`localStorage` so an accidental refresh doesn't lose the game.

This is intentionally a **separate app** from `apps/web` (the earlier
Supabase-backed multiplayer version) — that one needs a live network
connection to a backend by design, which is fundamentally incompatible
with "no networking." Nothing in `apps/web` or `supabase/` was touched.

## Run it locally

```bash
cd apps/local
npm install
npm run dev
```

Open the printed local URL (usually `http://localhost:5173`). Enter 2–6
player names, click **Start game**, and play — using this screen as the
banker while the physical board, dice, and deed cards stay on the table.

To build a static production bundle:

```bash
npm run build      # outputs to apps/local/dist
npm run preview    # serve that build locally to sanity-check it
```

## Deploy to Vercel (optional)

This is a static Vite app with zero backend — Vercel just serves the
built files.

**Option A — Vercel CLI, from this folder:**
```bash
cd apps/local
npx vercel        # first run links/creates the project, asks a few questions
npx vercel --prod # deploy to production
```

**Option B — Vercel dashboard, importing the whole repo:**
1. Import the repository into Vercel.
2. In Project Settings → General → **Root Directory**, set it to `apps/local`.
3. Framework preset: **Vite**. Build command: `npm run build`. Output
   directory: `dist`. (Vercel usually detects these automatically once the
   root directory is set.)
4. Deploy. No environment variables are needed — there's nothing to
   configure, since the app doesn't talk to anything.

## How a session actually plays out

1. **Setup** — enter names, click Start. Seat 1 gets 25,000, each later
   seat gets 1,000 more.
2. **Pick who goes first** — roll the physical dice, then set the
   "Current player" dropdown at the top to match. That dropdown (plus the
   "Next turn" button) is how you track whose turn it is; movement itself
   stays on the physical board.
3. **Play** — as the physical game unfolds, use the three tabs:
   - **Players & Bank** — GO (draws news + pays dividends + charges
     interest in one click), tax, deposits/withdrawals, loans, transfers.
   - **Properties** — buy at market price, develop, sell to the bank, or
     collect a landing payment — all grouped by chain, with the chain
     bonus and current-zone math already applied.
   - **Auction** — bidding happens out loud at the table; enter the
     winner and the winning amount here and it moves the cash and
     ownership for you. Works for a bank-held deed or a deed a player is
     auctioning off.
4. **Breaking News spaces** — the "Draw news card" button at the top
   resolves one card without touching dividends (that's what GO is for).
5. **THE RECKONING** — once drawn, a banner says so; finish the round,
   play one more, then click **End game & score**.
6. **Reset game** — wipes everything (including localStorage) and returns
   to setup, for the next playtest session.

## What's deliberately simple here

- Auctions record the *winning* bid only — the actual bidding is a
  verbal, physical process at the table; this just needs the outcome.
- Required payments (tax, interest, landing rent) are allowed to take a
  player's cash negative rather than an automated multi-step default
  sequence — the table resolves that physically, like a real ledger.
- "Transfer ownership" moves a deed without automatically moving cash,
  so it composes with a separate bank transfer for trades that involve
  payment.

## New in v1.4

- **Event log** (feedback item #31, finished) — a new **Event Log** tab
  records every cash movement *and* every structural change (news draws,
  index/rate moves, ownership transfers) in one chronological, exportable
  (CSV/JSON) audit trail. Undo already existed; this is the other half of
  that item.
- **Group-level renaming** (item #11) — the top development level is now
  labeled "Group" / "مجموعة" instead of "Chain", so it no longer collides
  with the nine company-chain names. Purely cosmetic: the underlying save
  data and scoring math are unchanged.
- **Currency label + Arabic-Indic numerals toggle** (item #13) — a
  "EGP, in thousands" label plus a one-click toggle between western and
  Arabic-Indic digits everywhere money is shown. No prices were retuned.
- **Three experimental mechanics, off by default** (items #3, #12, #16),
  each behind its own checkbox at setup, per the advisor's repeated note
  that these need their own dedicated playtest sessions:
  - 🕵️ **The Leak** — a one-of-a-kind, single-use item sold by open
    auction; the holder gets a visible "insider" badge and can reveal the
    next news card once, without drawing it.
  - 🪙 **Gold** — a bank-traded hedge, price inverse to the market index
    (20,000 − index×100), with a buy/sell spread and a 3-unit cap. Counted
    in final net worth at the bank's sell price.
  - 🤝 **Gulf investor personal offer** — a public per-turn dilemma:
    occasionally, at a random eligible player's turn start, the app
    announces a fixed above-market offer on one of their speculative
    holdings. Accept or decline, visible to the whole table.

## Verification status

This build was actually compiled and run through the real toolchain —
`npm install`, `npx tsc -b`, and `npm run build` all completed cleanly
with zero errors (previous sessions' sandboxes lacked network access and
had to verify by hand; this one didn't). `npm run dev` / `npm run build`
should work the same way on your machine.
