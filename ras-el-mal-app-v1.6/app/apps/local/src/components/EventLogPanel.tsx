import { useMemo, useState } from "react";
import type { GameState } from "../engine/types";
import { useLang, useMoney } from "../engine/i18n";

interface EventLogPanelProps {
  state: GameState;
}

/**
 * Feedback item #31, finished: "build item 10 as an event log — every
 * action is a recorded event — plus you get a full audit trail... export-
 * able per game." state.eventLog already records every cash movement and
 * every structural change (news draws, index moves, ownership transfers);
 * this panel is the part that was still missing — a readable view of it,
 * plus a one-click export.
 */
export function EventLogPanel({ state }: EventLogPanelProps) {
  const { t, lang } = useLang();
  const { format } = useMoney();
  const [filterPlayerId, setFilterPlayerId] = useState<string>("all");
  const playersById = useMemo(() => new Map(state.players.map((p) => [p.id, p])), [state.players]);

  const entries = useMemo(() => {
    const list =
      filterPlayerId === "all"
        ? state.eventLog
        : state.eventLog.filter((e) => e.playerId === filterPlayerId);
    return [...list].sort((a, b) => b.seq - a.seq); // newest first
  }, [state.eventLog, filterPlayerId]);

  function timeLabel(ts: number) {
    return new Date(ts).toLocaleTimeString(lang === "ar" ? "ar-EG" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function handleExportJson() {
    const blob = new Blob([JSON.stringify(state.eventLog, null, 2)], { type: "application/json" });
    downloadBlob(blob, `ras-el-mal-event-log-${Date.now()}.json`);
  }

  function handleExportCsv() {
    const header = "seq,time,player,reason,delta,balance_after,description";
    const rows = [...state.eventLog].sort((a, b) => a.seq - b.seq).map((e) => {
      const who = e.playerId ? (playersById.get(e.playerId)?.name ?? e.playerId) : "Bank/Market";
      const desc = e.description.replace(/"/g, '""');
      return [
        e.seq,
        new Date(e.createdAt).toISOString(),
        `"${who}"`,
        e.reason,
        e.delta ?? "",
        e.balanceAfter ?? "",
        `"${desc}"`,
      ].join(",");
    });
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    downloadBlob(blob, `ras-el-mal-event-log-${Date.now()}.csv`);
  }

  return (
    <div className="panel">
      <div className="spread" style={{ marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>{t("tabLog")}</h2>
        <div className="row">
          <select value={filterPlayerId} onChange={(e) => setFilterPlayerId(e.target.value)}>
            <option value="all">All players</option>
            {state.players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button className="secondary" onClick={handleExportCsv} title="Download as CSV">
            {t("exportLog")} CSV
          </button>
          <button className="secondary" onClick={handleExportJson} title="Download as JSON">
            {t("exportLog")} JSON
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="subtitle">{t("noEvents")}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>{t("logColTime")}</th>
              <th>{t("logColWho")}</th>
              <th>{t("logColEvent")}</th>
              <th>{t("logColAmount")}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => {
              const who = e.playerId ? playersById.get(e.playerId)?.name ?? "?" : t("bank");
              return (
                <tr key={e.id}>
                  <td style={{ whiteSpace: "nowrap", color: "#888", fontSize: "0.85em" }}>{timeLabel(e.createdAt)}</td>
                  <td>{who}</td>
                  <td>{e.description}</td>
                  <td
                    className={e.delta && e.delta < 0 ? "negative" : undefined}
                    style={{ whiteSpace: "nowrap" }}
                  >
                    {e.delta === null || e.delta === 0 ? "—" : `${e.delta > 0 ? "+" : ""}${format(e.delta)}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
