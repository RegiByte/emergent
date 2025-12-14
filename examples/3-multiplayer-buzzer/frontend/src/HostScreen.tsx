/**
 * Host Screen
 *
 * This is the main screen displayed on the TV/big screen.
 * It shows:
 * - Session code (for players to join)
 * - Connected players
 * - Game state (lobby, buzzing, results)
 * - Winner announcement
 *
 * Uses Braided with lazy initialization - system starts when this component mounts
 */

import { useEffect, useState } from "react";
import { useStore } from "zustand";
import { StartedSystem, startSystem } from "braided";
import { HostSystemBridge, hostSystemConfig, useHostResource } from "./system/system";
import type { GameSnapshot } from "./types";

type HostScreenProps = {
  onBack: () => void;
};

function HostScreenContent({ onBack }: HostScreenProps) {
  // Get resources from Braided (system already started by bridge)
  const store = useHostResource("store");
  const runtime = useHostResource("runtime");
  const transport = useHostResource("transport");

  // Subscribe to transport state
  const [transportState, setTransportState] = useState(transport.getState());

  useEffect(() => {
    setTransportState(transport.getState());
    const unsubscribe = transport.subscribe(() => {
      setTransportState(transport.getState());
    });

    return () => {
      unsubscribe();
    };
  }, [transport]);

  // Subscribe to game state (uses Zustand's useStore - always called!)
  const gameState = useStore(store, (state) => state.snapshot);

  const handleStartGame = () => {
    runtime.dispatch({ type: "game:start" });
  };

  const handleResetGame = () => {
    runtime.dispatch({ type: "game:reset" });
  };

  const playerCount = gameState.players.size;
  const connectedCount = transportState.dataChannels.size;

  return (
    <div className="screen host-screen">
      <header className="host-header">
        <button className="btn btn-back" onClick={onBack}>
          ← Back
        </button>
        <div className="session-info">
          <div className="session-code">
            <span className="label">Session Code:</span>
            <span className="code">{transportState.sessionId}</span>
          </div>
          <div className="player-count">
            {connectedCount} / {playerCount} connected
          </div>
        </div>
      </header>

      <main className="host-main">
        {gameState.phase === "lobby" && (
          <LobbyView
            gameState={gameState}
            onStartGame={handleStartGame}
            playerCount={playerCount}
          />
        )}

        {gameState.phase === "countdown" && (
          <CountdownView gameState={gameState} />
        )}

        {(gameState.phase === "ready" || gameState.phase === "buzzing") && (
          <BuzzingView gameState={gameState} />
        )}

        {gameState.phase === "result" && (
          <ResultView gameState={gameState} onReset={handleResetGame} />
        )}
      </main>
    </div>
  );
}

function LobbyView({
  gameState,
  onStartGame,
  playerCount,
}: {
  gameState: GameSnapshot;
  onStartGame: () => void;
  playerCount: number;
}) {
  return (
    <div className="lobby-view">
      <h1 className="phase-title">⚡ Waiting for Players</h1>
      <p className="phase-subtitle">
        Players can join using the session code above
      </p>

      <div className="players-grid">
        {Array.from(gameState.players.values()).map((player) => (
          <div key={player.id} className="player-card">
            <div className="player-avatar">{player.name[0]}</div>
            <div className="player-name">{player.name}</div>
            <div className="player-status">
              {player.clockOffset !== 0 ? "✓ Synced" : "⏳ Syncing..."}
            </div>
          </div>
        ))}
      </div>

      <button
        className="btn btn-primary btn-large"
        onClick={onStartGame}
        disabled={playerCount < 2}
      >
        {playerCount < 2 ? "Waiting for 2+ players..." : "Start Game"}
      </button>
    </div>
  );
}

function CountdownView({ gameState }: { gameState: GameSnapshot }) {
  const countdownValue = gameState.countdownValue;

  return (
    <div className="countdown-view">
      <h1 className="phase-title">Get Ready!</h1>
      <div className="countdown-number">
        {countdownValue === 0 ? "GO!" : countdownValue}
      </div>
    </div>
  );
}

function BuzzingView({ gameState }: { gameState: GameSnapshot }) {
  const buzzedCount = gameState.buzzSubmissions.length;
  const totalPlayers = gameState.players.size;

  return (
    <div className="buzzing-view">
      <h1 className="phase-title">⚡ BUZZ NOW!</h1>
      <p className="phase-subtitle">First to buzz wins</p>

      <div className="buzz-counter">
        <div className="buzz-count">{buzzedCount}</div>
        <div className="buzz-total">/ {totalPlayers}</div>
      </div>

      <div className="buzz-list">
        {gameState.buzzSubmissions.map((submission, index) => {
          // Calculate relative time from buzz window start
          const relativeTime = gameState.buzzWindowStartedAt
            ? submission.compensatedTime - gameState.buzzWindowStartedAt
            : 0;
          
          return (
            <div key={submission.playerId} className="buzz-item">
              <div className="buzz-rank">#{index + 1}</div>
              <div className="buzz-name">{submission.playerName}</div>
              <div className="buzz-time">
                +{relativeTime.toFixed(0)}ms
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ResultView({
  gameState,
  onReset,
}: {
  gameState: GameSnapshot;
  onReset: () => void;
}) {
  if (!gameState.winner) {
    return null;
  }

  return (
    <div className="result-view">
      <h1 className="phase-title">🎉 Winner!</h1>
      <div className="winner-card">
        <div className="winner-avatar">{gameState.winner.playerName[0]}</div>
        <div className="winner-name">{gameState.winner.playerName}</div>
      </div>

      <div className="results-list">
        <h3>Final Results</h3>
        {gameState.buzzSubmissions.map((submission, index) => {
          // Calculate relative time from buzz window start
          const relativeTime = gameState.buzzWindowStartedAt
            ? submission.compensatedTime - gameState.buzzWindowStartedAt
            : 0;
          
          return (
            <div key={submission.playerId} className="result-item">
              <div className="result-rank">#{index + 1}</div>
              <div className="result-name">{submission.playerName}</div>
              <div className="result-time">
                +{relativeTime.toFixed(0)}ms
              </div>
            </div>
          );
        })}
      </div>

      <button className="btn btn-primary btn-large" onClick={onReset}>
        Play Again
      </button>
    </div>
  );
}

// Wrapper component that starts the host system
export function HostScreen({ onBack }: HostScreenProps) {
  const [system, setSystem] = useState<StartedSystem<
    typeof hostSystemConfig
  > | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let systemInstance: Awaited<
      ReturnType<typeof startSystem<typeof hostSystemConfig>>
    > | null = null;

    const init = async () => {
      try {
        systemInstance = await startSystem(hostSystemConfig);

        if (mounted) {
          console.log("[Host] System started");
          setSystem(systemInstance.system);
        } else {
          // If unmounted during async operation, halt system immediately
          // (Braided will clean up resources)
          console.log(
            "[Host] System started but component unmounted, cleaning up"
          );
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error ? err.message : "Failed to start system"
          );
        }
      }
    };

    init();

    return () => {
      mounted = false;
      // Cleanup will be handled by SystemBridge when it unmounts
      // (we don't manually halt here to avoid double-cleanup)
    };
  }, []);

  if (error) {
    return (
      <div className="screen host-screen">
        <div className="error-message">
          <h2>❌ Error</h2>
          <p>{error}</p>
          <button className="btn" onClick={onBack}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!system) {
    return (
      <div className="screen host-screen">
        <div className="loading">
          <div className="spinner"></div>
          <p>Starting host...</p>
        </div>
      </div>
    );
  }

  return (
    <HostSystemBridge system={system}>
      <HostScreenContent onBack={onBack} />
    </HostSystemBridge>
  );
}
