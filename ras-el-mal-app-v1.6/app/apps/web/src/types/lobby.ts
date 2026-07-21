// Domain types for Feature 1: Player Creation & Game Lobby.
// Field names mirror the `games` / `players` database tables (camelCase).

export type GameStatus =
  | "SETUP"
  | "ACTIVE"
  | "ENDGAME_COUNTDOWN"
  | "SCORING"
  | "COMPLETE";

export interface Game {
  id: string;
  joinCode: string;
  status: GameStatus;
  minPlayers: number;
  maxPlayers: number;
  hostPlayerId: string | null;
  startingPlayerId: string | null;
  activePlayerId: string | null;
  indexPosition: number; // 0..4 -> 70/85/100/115/130
  ratePosition: number; // 0..3 -> 5/8/11/14%
  reckoningDrawn: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Player {
  id: string;
  gameId: string;
  userId: string;
  seatNumber: number;
  displayName: string;
  startingCash: number;
  isHost: boolean;
  playOrder: number | null;
  cash: number;
  loanNotes: number;
  joinedAt: string;
}

/** What the browser persists locally so a refresh rejoins the same seat. */
export interface LobbySession {
  gameId: string;
  playerId: string;
  joinCode: string;
}

export interface CreateGameResult {
  gameId: string;
  playerId: string;
  joinCode: string;
}

export interface JoinGameResult {
  gameId: string;
  playerId: string;
  seatNumber: number;
}
