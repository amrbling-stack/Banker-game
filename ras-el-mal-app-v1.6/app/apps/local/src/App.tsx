import { useGameEngine } from "./engine/useGameEngine";
import { SetupScreen } from "./components/SetupScreen";
import { Dashboard } from "./components/Dashboard";
import { ScoringScreen } from "./components/ScoringScreen";

export function App() {
  const engine = useGameEngine();
  const { state } = engine;

  if (state.status === "SETUP") {
    return <SetupScreen onStart={(names, settings) => engine.newGame(names, settings)} />;
  }

  if (state.status === "FINISHED") {
    return <ScoringScreen state={state} onReset={engine.resetToSetup} />;
  }

  return <Dashboard state={state} engine={engine} />;
}
