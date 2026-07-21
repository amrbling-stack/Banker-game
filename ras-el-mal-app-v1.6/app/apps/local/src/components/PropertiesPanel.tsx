import { useMemo, useState } from "react";
import type { Deed, GameState } from "../engine/types";
import { CHAIN_LABELS, LEVEL_LABELS, SPECIAL_PROJECT_IDS } from "../engine/types";
import { COMPANIES } from "../engine/companies";
import { chainCountFor, currentBuyPrice, currentBuyback, landingFor, levelStatsFor } from "../engine/calc";
import type { GameEngine } from "../engine/useGameEngine";
import { useLang, useMoney } from "../engine/i18n";

interface PropertiesPanelProps {
  state: GameState;
  engine: GameEngine;
}

export function PropertiesPanel({ state, engine }: PropertiesPanelProps) {
  const deedByCompanyId = useMemo(() => new Map(state.deeds.map((d) => [d.companyId, d])), [state.deeds]);
  const playersById = useMemo(() => new Map(state.players.map((p) => [p.id, p])), [state.players]);

  const { groups, specialProjects } = useMemo(() => {
    const byChain = new Map<string, typeof COMPANIES>();
    const specials: typeof COMPANIES = [];
    for (const c of COMPANIES) {
      if (SPECIAL_PROJECT_IDS.has(c.id)) {
        specials.push(c);
        continue;
      }
      const key = c.chainCode ?? "UTIL";
      const list = byChain.get(key) ?? [];
      list.push(c);
      byChain.set(key, list);
    }
    const order = ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9", "UTIL"];
    const grps = order
      .filter((k) => byChain.has(k))
      .map((k) => ({ key: k, label: k === "UTIL" ? "Utilities" : CHAIN_LABELS[k], companies: byChain.get(k)! }));
    return { groups: grps, specialProjects: specials };
  }, []);

  return (
    <div className="panel">
      <h2>Listings</h2>
      <table>
        <thead>
          <tr>
            <th>Company</th>
            <th>Owner</th>
            <th>Level</th>
            <th>Invested capital</th>
            <th>Price / Trading fee</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <PropertyGroup
              key={group.key}
              label={group.label}
              companies={group.companies}
              deedByCompanyId={deedByCompanyId}
              deeds={state.deeds}
              players={state.players}
              playersById={playersById}
              indexPosition={state.indexPosition}
              wobbleState={state}
              engine={engine}
            />
          ))}
        </tbody>
      </table>

      {specialProjects.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ borderBottom: "2px solid #b4935a", paddingBottom: 4, color: "#3d5a44" }}>
            🏛 The Compound in Sheikh Zayed — auction-only, no board space
          </h3>
          <p style={{ fontSize: "0.85em", color: "#666", margin: "4px 0 12px" }}>
            This mega-asset never appears as a landing space, so there's no trading fee to track. It
            enters play only through the Auction tab, and only once every other company on the board has
            an owner (rulebook §15) — a gated compound rather than an arbitrary countdown. Priced at
            Group-level defensive distribution on a large sticker — a way to park cash where the payoff is
            really the final index multiplier, not the yield.
          </p>
          <table>
            <thead>
              <tr>
                <th>Project</th>
                <th>Owner</th>
                <th>Sticker</th>
                <th>Invested capital (fixed)</th>
                <th>Distribution / lap</th>
                <th>Bank buys at</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {specialProjects.map((company) => {
                const deed = deedByCompanyId.get(company.id);
                if (!deed) return null;
                const owner = deed.ownerId ? playersById.get(deed.ownerId) : null;
                const buyback = currentBuyback(company, state.indexPosition);
                return (
                  <NationalProjectRow
                    key={company.id}
                    company={company}
                    deed={deed}
                    owner={owner ?? null}
                    buyback={buyback}
                    unlocked={state.nationalProjectUnlocked}
                    players={state.players}
                    engine={engine}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface PropertyGroupProps {
  label: string;
  companies: typeof COMPANIES;
  deedByCompanyId: Map<number, Deed>;
  deeds: Deed[];
  players: GameState["players"];
  playersById: Map<string, GameState["players"][number]>;
  indexPosition: number;
  wobbleState: Pick<GameState, "indexPosition" | "newsHistory" | "settings">;
  engine: GameEngine;
}

function PropertyGroup({
  label,
  companies,
  deedByCompanyId,
  deeds,
  players,
  playersById,
  indexPosition,
  wobbleState,
  engine,
}: PropertyGroupProps) {
  return (
    <>
      <tr className="chain-header">
        <td colSpan={6}>{label}</td>
      </tr>
      {companies.map((company) => {
        const deed = deedByCompanyId.get(company.id);
        if (!deed) return null;
        return (
          <PropertyRow
            key={company.id}
            company={company}
            deed={deed}
            deeds={deeds}
            players={players}
            playersById={playersById}
            indexPosition={indexPosition}
            wobbleState={wobbleState}
            engine={engine}
          />
        );
      })}
    </>
  );
}

interface PropertyRowProps {
  company: (typeof COMPANIES)[number];
  deed: Deed;
  deeds: Deed[];
  players: GameState["players"];
  playersById: Map<string, GameState["players"][number]>;
  indexPosition: number;
  wobbleState: Pick<GameState, "indexPosition" | "newsHistory" | "settings">;
  engine: GameEngine;
}

function PropertyRow({ company, deed, deeds, players, playersById, indexPosition, wobbleState, engine }: PropertyRowProps) {
  const { lang } = useLang();
  const { format } = useMoney();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // currentBuyPrice applies the Beta Wobble nudge (rulebook v1.5 section 19)
  // when that optional variant is on; it's the plain index price otherwise.
  // Landings, buybacks, dividends, and scoring never use this -- only what
  // a player actually pays to buy an unowned company.
  const marketPrice = currentBuyPrice(company, wobbleState);
  const buyback = currentBuyback(company, indexPosition);
  const owner = deed.ownerId ? playersById.get(deed.ownerId) : null;
  const chainOwned = deed.ownerId ? chainCountFor(deeds, deed.ownerId, company.chainCode) : 0;
  const landingPreview = deed.ownerId ? landingFor(deed, deeds, indexPosition) : 0;
  const investedCapital = owner ? (levelStatsFor(company, deed.devLevel)?.invested ?? 0) : 0;

  const [buyerId, setBuyerId] = useState(players[0]?.id ?? "");
  const [buyPrice, setBuyPrice] = useState(String(marketPrice));
  const [payerId, setPayerId] = useState("");
  const [newOwnerId, setNewOwnerId] = useState(players[0]?.id ?? "");

  const canDevelop = company.develops && deed.devLevel !== "CHAIN" && Boolean(owner);
  const developCost = deed.devLevel === "KIOSK" ? company.developCostShop : company.developCostChain;
  const payerOptions = players.filter((p) => p.id !== deed.ownerId);
  const levelLabel = LEVEL_LABELS[deed.devLevel][lang];

  function report(ok: boolean, message: string | undefined, successText: string) {
    if (ok) {
      setNotice(successText);
      setError(null);
    } else {
      setError(message ?? "That didn't work.");
      setNotice(null);
    }
  }

  return (
    <>
      <tr>
        <td>{company.nameEn}</td>
        <td>
          {owner ? owner.name : <span className="badge">Bank</span>}
          {chainOwned >= 2 && <span className="badge" style={{ marginLeft: 6 }}>chain x{chainOwned}</span>}
        </td>
        <td>{levelLabel}</td>
        <td>{owner ? format(investedCapital) : "—"}</td>
        <td>{owner ? `Fee ${format(landingPreview)}` : `Buy ${format(marketPrice)}`}</td>
        <td>
          <button className="secondary" onClick={() => setOpen((v) => !v)}>
            {open ? "Hide" : "Actions"}
          </button>
        </td>
      </tr>

      {open && (
        <tr className="expand-row">
          <td colSpan={6}>
            {notice && <p className="notice">{notice}</p>}
            {error && <p className="error">{error}</p>}

            {!owner && (
              <div className="row">
                <span>Buy at market price ({format(marketPrice)}):</span>
                <select value={buyerId} onChange={(e) => setBuyerId(e.target.value)}>
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <input type="number" min={0} value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)} />
                <button
                  className="primary"
                  onClick={() => {
                    const r = engine.buyDeed(company.id, buyerId, Number(buyPrice) || 0);
                    report(r.ok, r.message, `Sold to ${playersById.get(buyerId)?.name}`);
                  }}
                >
                  Buy
                </button>
              </div>
            )}

            {owner && (
              <>
                {payerOptions.length > 0 && (
                  <div className="row">
                    <span>Trading fee ({format(landingPreview)}):</span>
                    <select value={payerId} onChange={(e) => setPayerId(e.target.value)}>
                      <option value="">Who landed here?</option>
                      {payerOptions.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <button
                      className="success"
                      onClick={() => {
                        const r = engine.payLanding(company.id, payerId);
                        report(r.ok, r.message, `Collected ${format(r.amount ?? 0)} from ${playersById.get(payerId)?.name}`);
                        setPayerId("");
                      }}
                      disabled={!payerId}
                    >
                      Collect
                    </button>
                  </div>
                )}

                <div className="row">
                  {canDevelop && (
                    <button
                      className="secondary"
                      onClick={() => {
                        const r = engine.developCompany(company.id);
                        report(r.ok, r.message, `Developed to ${deed.devLevel === "KIOSK" ? LEVEL_LABELS.SHOP[lang] : LEVEL_LABELS.CHAIN[lang]}`);
                      }}
                    >
                      Develop ({format(developCost ?? 0)})
                    </button>
                  )}
                  <button
                    className="secondary"
                    onClick={() => {
                      const r = engine.sellToBank(company.id);
                      report(r.ok, undefined, `Sold to the bank for ${format(r.amount ?? 0)}`);
                    }}
                  >
                    Sell to bank ({format(buyback)})
                  </button>
                </div>

                {players.length > 1 && (
                  <div className="row">
                    <span>Transfer ownership (trade, no payment moved automatically):</span>
                    <select value={newOwnerId} onChange={(e) => setNewOwnerId(e.target.value)}>
                      {players.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <button
                      className="secondary"
                      onClick={() => {
                        const r = engine.transferDeed(company.id, newOwnerId);
                        report(r.ok, r.message, `Transferred to ${playersById.get(newOwnerId)?.name}`);
                      }}
                    >
                      Transfer
                    </button>
                  </div>
                )}
              </>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Compound in Sheikh Zayed row (formerly "National Project")
// ---------------------------------------------------------------------------

interface NationalProjectRowProps {
  company: (typeof COMPANIES)[number];
  deed: Deed;
  owner: GameState["players"][number] | null;
  buyback: number;
  unlocked: boolean;
  players: GameState["players"];
  engine: GameEngine;
}

function NationalProjectRow({ company, owner, buyback, unlocked, players, engine }: NationalProjectRowProps) {
  const { format } = useMoney();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [newOwnerId, setNewOwnerId] = useState(players[0]?.id ?? "");
  const playersById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  function report(ok: boolean, errMsg: string | undefined, successText: string) {
    if (ok) { setNotice(successText); setError(null); }
    else { setError(errMsg ?? "That didn't work."); setNotice(null); }
  }

  const dividend = company.kiosk?.dividend ?? 0;
  const invested = company.kiosk?.invested ?? 0;

  return (
    <>
      <tr style={{ background: "#f5f0e8" }}>
        <td><strong>{company.nameEn}</strong> <span style={{ color: "#888", fontSize: "0.85em" }}>{company.nameAr}</span></td>
        <td>{owner ? owner.name : <span style={{ color: "#888" }}>Bank (unowned)</span>}</td>
        <td>{format(company.stickerPrice)}</td>
        <td>{format(invested)}</td>
        <td>{format(dividend)}</td>
        <td>{format(buyback)}</td>
        <td><button className="secondary" onClick={() => setIsExpanded((x) => !x)}>{isExpanded ? "Hide" : "Actions"}</button></td>
      </tr>
      {isExpanded && (
        <tr className="expand-row">
          <td colSpan={7}>
            {notice && <p className="notice">{notice}</p>}
            {error && <p className="error">{error}</p>}

            {!owner && (
              <p style={{ fontSize: "0.88em", color: "#666" }}>
                {!unlocked
                  ? "🔒 Not eligible for auction yet — unlocks the moment every other company on the board has an owner."
                  : "Eligible for auction. Use the Auction tab to run the bidding and record the winner — there's no direct-buy option for this card."}
              </p>
            )}

            {owner && (
              <>
                <div className="row">
                  <button className="secondary" onClick={() => {
                    const r = engine.sellToBank(company.id);
                    report(r.ok, undefined, `Sold to the bank for ${format(r.amount ?? 0)}`);
                  }}>Sell to bank ({format(buyback)})</button>
                </div>
                {players.length > 1 && (
                  <div className="row">
                    <span>Transfer ownership:</span>
                    <select value={newOwnerId} onChange={(e) => setNewOwnerId(e.target.value)}>
                      {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <button className="secondary" onClick={() => {
                      const r = engine.transferDeed(company.id, newOwnerId);
                      report(r.ok, r.message, `Transferred to ${playersById.get(newOwnerId)?.name}`);
                    }}>Transfer</button>
                  </div>
                )}
              </>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
