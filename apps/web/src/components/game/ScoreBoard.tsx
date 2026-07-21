import type { ScoreLine } from "@/lib/gameCalc";

interface ScoreBoardProps {
  lines: ScoreLine[];
}

const money = new Intl.NumberFormat("en-US");

export function ScoreBoard({ lines }: ScoreBoardProps) {
  return (
    <div className="flex flex-col gap-3">
      {lines.map((line, i) => (
        <div key={line.playerId} className="card flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-ledger-950">
              {i === 0 && "🏆 "}
              {line.displayName}
            </p>
            <p className="font-mono text-xl font-semibold text-ledger-950">
              {money.format(line.netWorth)}
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2 font-mono text-[11px] text-ledger-950/50">
            <span>A {money.format(line.lineA)}</span>
            <span>B {money.format(line.lineB)}</span>
            <span>C {money.format(line.lineC)}</span>
            <span>D −{money.format(line.lineD)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
