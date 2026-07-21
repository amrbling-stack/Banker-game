import { useMemo } from "react";
import type { Company, GameDeed } from "@/types/game";
import type { Player } from "@/types/lobby";
import { CompanyRow } from "@/components/game/CompanyRow";

interface CompaniesPanelProps {
  gameId: string;
  companies: Company[];
  deeds: GameDeed[];
  players: Player[];
  indexPosition: number;
}

const CHAIN_LABELS: Record<string, string> = {
  C1: "Olive Oil",
  C2: "Poultry",
  C3: "Pharmaceuticals",
  C4: "Healthcare",
  C5: "Education",
  C6: "Digital Delivery",
  C7: "Internet & Tech",
  C8: "AI & Cloud",
  C9: "Media",
};

export function CompaniesPanel({ gameId, companies, deeds, players, indexPosition }: CompaniesPanelProps) {
  const companiesById = useMemo(() => new Map(companies.map((c) => [c.id, c])), [companies]);
  const playersById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const deedByCompanyId = useMemo(() => new Map(deeds.map((d) => [d.companyId, d])), [deeds]);

  const groups = useMemo(() => {
    const byChain = new Map<string, Company[]>();
    for (const company of companies) {
      const key = company.chainCode ?? "UTIL";
      const list = byChain.get(key) ?? [];
      list.push(company);
      byChain.set(key, list);
    }
    const order = ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9", "UTIL"];
    return order
      .filter((key) => byChain.has(key))
      .map((key) => ({ key, label: key === "UTIL" ? "Utilities" : CHAIN_LABELS[key], companies: byChain.get(key)! }));
  }, [companies]);

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <div key={group.key} className="flex flex-col gap-2">
          <h3 className="px-1 text-xs font-medium uppercase tracking-[0.15em] text-gold-600">
            {group.label}
          </h3>
          <ul className="flex flex-col gap-2">
            {group.companies.map((company) => {
              const deed = deedByCompanyId.get(company.id);
              if (!deed) return null;
              return (
                <CompanyRow
                  key={company.id}
                  gameId={gameId}
                  company={company}
                  deed={deed}
                  deeds={deeds}
                  companiesById={companiesById}
                  players={players}
                  playersById={playersById}
                  indexPosition={indexPosition}
                />
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
