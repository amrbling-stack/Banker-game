import type { GameState } from "../engine/types";
import { computeScoring } from "../engine/calc";
import { useMoney } from "../engine/i18n";

interface ScoringScreenProps {
  state: GameState;
  onReset: () => void;
}

export function ScoringScreen({ state, onReset }: ScoringScreenProps) {
  const { format } = useMoney();
  const lines = computeScoring(state.players, state.deeds, state.indexPosition);
  const goldInPlay = state.settings.enableGold;

  return (
    <div className="page">
      <h1>Final scoring</h1>
      <p className="subtitle">
        Net worth = A (defensive/cyclical/utility, index-adjusted) + B (speculative, index-adjusted) +
        C ({goldInPlay ? "cash + gold, at bank sell price" : "cash"}) − D (debt).
      </p>

      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Player</th>
              <th>Invested (non-spec)</th>
              <th>Invested (speculative)</th>
              <th>A (adjusted)</th>
              <th>B (adjusted)</th>
              <th>C ({goldInPlay ? "cash + gold" : "cash"})</th>
              <th>D (debt)</th>
              <th>Net worth</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={line.playerId} className={i === 0 ? "score-first" : undefined}>
                <td>{i + 1}{i === 0 ? " 🏆" : ""}</td>
                <td>{line.name}</td>
                <td>{format(line.investedNonSpec)}</td>
                <td>{format(line.investedSpec)}</td>
                <td>{format(line.lineA)}</td>
                <td>{format(line.lineB)}</td>
                <td>{format(line.lineC)}</td>
                <td>−{format(line.lineD)}</td>
                <td><strong>{format(line.netWorth)}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button onClick={onReset}>Start a new game</button>
    </div>
  );
}
