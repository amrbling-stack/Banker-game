import { NEWS_CARD_EFFECTS, NEWS_CARD_LABELS } from "../engine/types";

interface NewsModalProps {
  code: string;
  onDismiss: () => void;
}

const ICON: Record<string, string> = {
  MARKET_UP_1: "📈",
  MARKET_DOWN_1: "📉",
  GAS_FIELD_UP_2: "⛽",
  CRISIS_DOWN_2: "💥",
  CB_RAISE: "🏦",
  CB_CUT: "🏦",
  FLOTATION: "💸",
  GOV_OFFERING: "🏛",
  GULF_INVESTOR: "🤝",
  QUIET_DAY: "😴",
  RECKONING: "⏳",
};

const ACCENT: Record<string, string> = {
  MARKET_UP_1: "#2e7d32",
  GAS_FIELD_UP_2: "#2e7d32",
  CB_CUT: "#2e7d32",
  MARKET_DOWN_1: "#b3261e",
  CRISIS_DOWN_2: "#b3261e",
  CB_RAISE: "#b85c00",
  FLOTATION: "#b3261e",
  RECKONING: "#4a1a8c",
  GOV_OFFERING: "#1a4a8c",
  GULF_INVESTOR: "#1a4a8c",
  QUIET_DAY: "#666",
};

export function NewsModal({ code, onDismiss }: NewsModalProps) {
  const label = NEWS_CARD_LABELS[code] ?? code;
  const effect = NEWS_CARD_EFFECTS[code] ?? "";
  const icon = ICON[code] ?? "📰";
  const accent = ACCENT[code] ?? "#1a1a1a";

  return (
    <div className="modal-backdrop" onClick={onDismiss}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-icon" style={{ color: accent }}>{icon}</div>
        <h2 className="modal-title" style={{ color: accent }}>{label}</h2>
        <p className="modal-effect">{effect}</p>
        <button className="modal-dismiss" onClick={onDismiss}>
          Got it — continue
        </button>
      </div>
    </div>
  );
}
