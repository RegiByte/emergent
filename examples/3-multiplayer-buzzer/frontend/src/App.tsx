/**
 * Multiplayer Buzzer - Main App
 *
 * This is the entry point that routes between:
 * - Home (choose role)
 * - Host screen
 * - Player screen
 */

import { useState } from "react";
import { HostScreen } from "./HostScreen";
import { PlayerScreen } from "./PlayerScreen";
import "./App.css";

type Screen = "home" | "host" | "player";

export function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [sessionId, setSessionId] = useState("");
  const [playerName, setPlayerName] = useState("");

  if (screen === "host") {
    return <HostScreen onBack={() => setScreen("home")} />;
  }

  if (screen === "player") {
    return (
      <PlayerScreen
        sessionId={sessionId}
        playerName={playerName}
        onBack={() => setScreen("home")}
      />
    );
  }

  return (
    <div className="app">
      <div className="home-screen">
        <div className="home-content">
          <h1 className="title">⚡ Multiplayer Buzzer</h1>
          <p className="subtitle">
            Fair competition with clock synchronization
          </p>

          <div className="home-cards">
            <div className="card">
              <h2>🎮 Host a Game</h2>
              <p>Create a session and display it on the big screen</p>
              <button
                className="btn btn-primary"
                onClick={() => setScreen("host")}
              >
                Host Game
              </button>
            </div>

            <div className="card">
              <h2>📱 Join as Player</h2>
              <p>Enter the session code to join</p>
              <div className="form">
                <input
                  type="text"
                  placeholder="Session Code (e.g., A1B2)"
                  value={sessionId}
                  onChange={(e) => setSessionId(e.target.value.toUpperCase())}
                  maxLength={4}
                  className="input"
                />
                <input
                  type="text"
                  placeholder="Your Name"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  maxLength={20}
                  className="input"
                />
                <button
                  className="btn btn-primary"
                  onClick={() => setScreen("player")}
                  disabled={!sessionId || !playerName}
                >
                  Join Game
                </button>
              </div>
            </div>
          </div>

          <div className="info-section">
            <h3>How It Works</h3>
            <div className="info-grid">
              <div className="info-item">
                <div className="info-icon">🎯</div>
                <div className="info-text">
                  <strong>Fair Competition</strong>
                  <p>
                    Clock synchronization ensures everyone has an equal chance
                  </p>
                </div>
              </div>
              <div className="info-item">
                <div className="info-icon">⚡</div>
                <div className="info-text">
                  <strong>Fast & Responsive</strong>
                  <p>WebRTC peer-to-peer for low-latency gameplay</p>
                </div>
              </div>
              <div className="info-item">
                <div className="info-icon">🔒</div>
                <div className="info-text">
                  <strong>No Account Needed</strong>
                  <p>Just create a session and share the code</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
