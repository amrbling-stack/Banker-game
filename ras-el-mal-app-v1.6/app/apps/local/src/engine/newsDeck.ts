const COMPOSITION: [string, number][] = [
  ["MARKET_UP_1", 8],
  ["MARKET_DOWN_1", 8],
  ["GAS_FIELD_UP_2", 1],
  ["CRISIS_DOWN_2", 1],
  ["CB_RAISE", 2],
  ["CB_CUT", 2],
  ["FLOTATION", 1],
  ["GOV_OFFERING", 2],
  ["GULF_INVESTOR", 2],
  ["QUIET_DAY", 2],
];
// Sums to 29 event cards. The Reckoning is the 30th, added separately.

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Builds a shuffled news deck for the given player count: 7 event cards
 * per player, capped at the full 29 (so 5- and 6-player games use every
 * event card), with THE RECKONING inserted at a random position within
 * the bottom quarter of the final deck.
 */
export function buildNewsDeck(playerCount: number): string[] {
  const pool: string[] = [];
  for (const [code, copies] of COMPOSITION) {
    for (let i = 0; i < copies; i++) pool.push(code);
  }

  const k = Math.min(29, Math.max(0, 7 * playerCount));
  const shuffled = shuffle(pool);
  const selected = shuffled.slice(0, k);

  const total = k + 1;
  const bottomQuarter = Math.ceil(total / 4);
  const insertAt = total - 1 - Math.floor(Math.random() * bottomQuarter); // 0-based index into the final deck

  const deck = [...selected];
  deck.splice(insertAt, 0, "RECKONING");
  return deck;
}
