import { useState } from "react";
import type { GameSettings } from "../engine/types";
import { defaultSettings } from "../engine/types";

interface SetupScreenProps {
  onStart: (names: string[], settings: GameSettings) => void;
}

const MAX_PLAYERS = 6;
const MIN_PLAYERS = 2;

export function SetupScreen({ onStart }: SetupScreenProps) {
  const [names, setNames] = useState<string[]>(["", ""]);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<GameSettings>(defaultSettings());

  function updateName(i: number, value: string) {
    setNames((prev) => prev.map((n, idx) => (idx === i ? value : n)));
  }

  function addPlayer() {
    if (names.length >= MAX_PLAYERS) return;
    setNames((prev) => [...prev, ""]);
  }

  function removePlayer(i: number) {
    if (names.length <= MIN_PLAYERS) return;
    setNames((prev) => prev.filter((_, idx) => idx !== i));
  }

  function toggleSetting(key: keyof GameSettings) {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleStart() {
    const trimmed = names.map((n) => n.trim()).filter(Boolean);
    if (trimmed.length < MIN_PLAYERS) {
      setError(`Enter at least ${MIN_PLAYERS} player names.`);
      return;
    }
    if (trimmed.length > MAX_PLAYERS) {
      setError(`No more than ${MAX_PLAYERS} players.`);
      return;
    }
    const uniqueLower = new Set(trimmed.map((n) => n.toLowerCase()));
    if (uniqueLower.size !== trimmed.length) {
      setError("Player names must be unique.");
      return;
    }
    setError(null);
    onStart(trimmed, settings);
  }

  return (
    <div className="setup-screen">
      <h1>رأس المال — Ras El-Mal</h1>
      <p className="subtitle">
        Digital banker for the physical board game. One laptop, one banker, the whole table.
      </p>

      <div className="panel">
        <h2>Players (2–6)</h2>
        {names.map((name, i) => (
          <div className="name-input-row" key={i}>
            <span className="badge">Seat {i + 1}</span>
            <input
              type="text"
              placeholder={`Player ${i + 1} name`}
              value={name}
              onChange={(e) => updateName(i, e.target.value)}
              maxLength={24}
            />
            {names.length > MIN_PLAYERS && (
              <button className="secondary" onClick={() => removePlayer(i)}>
                Remove
              </button>
            )}
          </div>
        ))}

        {names.length < MAX_PLAYERS && (
          <button className="secondary" onClick={addPlayer}>
            + Add player
          </button>
        )}

        <p className="notice">
          Starting cash: seat 1 gets 35,000 (EGP, in thousands), each later seat gets 1,000 more (up to
          40,000 at seat 6).
        </p>

        {error && <p className="error">{error}</p>}

        <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid #e0ddd0" }}>
          <h3 style={{ margin: "0 0 4px" }}>Experimental features</h3>
          <p style={{ fontSize: "0.85em", color: "#666", margin: "0 0 10px" }}>
            Each of these is new and untested at a real table — the design notes on all three say to
            playtest them on their own, one at a time. Off by default; turn on only the one you're
            testing this session.
          </p>
          <label className="row" style={{ alignItems: "center", fontSize: "0.9em" }}>
            <input type="checkbox" checked={settings.enableLeak} onChange={() => toggleSetting("enableLeak")} />
            🕵️ The Leak (التسريب) — single-use, auctioned insider preview of the next news card
          </label>
          <label className="row" style={{ alignItems: "center", fontSize: "0.9em" }}>
            <input type="checkbox" checked={settings.enableGold} onChange={() => toggleSetting("enableGold")} />
            🪙 Gold — bank-traded hedge, price inverse to the market index, capped at 3 units/player
          </label>
          <label className="row" style={{ alignItems: "center", fontSize: "0.9em" }}>
            <input
              type="checkbox"
              checked={settings.enableGulfOffer}
              onChange={() => toggleSetting("enableGulfOffer")}
            />
            🤝 Gulf investor personal offer — public per-turn dilemma on a speculative holding
          </label>
          <label className="row" style={{ alignItems: "center", fontSize: "0.9em" }}>
            <input
              type="checkbox"
              checked={settings.enableBetaWobble}
              onChange={() => toggleSetting("enableBetaWobble")}
            />
            📈 Beta Wobble (rulebook §19) — small per-company price nudge on top of the index; buy price
            only, nothing else changes
          </label>
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <button onClick={handleStart}>Start game</button>
        </div>
      </div>
    </div>
  );
}
