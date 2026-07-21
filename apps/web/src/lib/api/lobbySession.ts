import type { LobbySession } from "@/types/lobby";

const STORAGE_KEY = "ras-el-mal:lobby-session";

export function saveLobbySession(session: LobbySession): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function loadLobbySession(): LobbySession | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LobbySession;
  } catch {
    return null;
  }
}

export function clearLobbySession(): void {
  localStorage.removeItem(STORAGE_KEY);
}
