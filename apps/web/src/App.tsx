import { Navigate, Route, Routes } from "react-router-dom";
import { HomePage } from "@/pages/HomePage";
import { CreateGamePage } from "@/pages/CreateGamePage";
import { JoinGamePage } from "@/pages/JoinGamePage";
import { LobbyPage } from "@/pages/LobbyPage";
import { GamePage } from "@/pages/GamePage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/create" element={<CreateGamePage />} />
      <Route path="/join" element={<JoinGamePage />} />
      <Route path="/lobby/:gameId" element={<LobbyPage />} />
      <Route path="/game/:gameId" element={<GamePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
