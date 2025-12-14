/**
 * Player Screen
 *
 * This is the screen displayed on each player's phone.
 * It shows:
 * - Connection status
 * - Clock sync status
 * - Buzz button (big and responsive)
 * - Game phase
 *
 * Note: Player uses simpler initialization (just transport, no full Braided system)
 * since player config is dynamic (sessionId/playerName from props)
 */

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPlayerTransport } from "./system/transport-player";

const SIGNALING_SERVER_URL = "http://localhost:8000";

type PlayerScreenProps = {
  sessionId: string;
  playerName: string;
  onBack: () => void;
};

export function PlayerScreen({
  sessionId,
  playerName,
  onBack,
}: PlayerScreenProps) {
  const [transport, setTransport] = useState<ReturnType<
    typeof createPlayerTransport
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasBuzzed, setHasBuzzed] = useState(false);

  // Initialize transport
  useEffect(() => {
    let mounted = true;
    let transportInstance: ReturnType<typeof createPlayerTransport> | null =
      null;

    const init = async () => {
      try {
        transportInstance = createPlayerTransport({
          signalingServerUrl: SIGNALING_SERVER_URL,
          sessionId,
          playerName,
        });

        await transportInstance.start();

        if (mounted) {
          setTransport(transportInstance);
        } else {
          // If unmounted during async operation, clean up immediately
          transportInstance.dispose();
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to connect");
        }
      }
    };

    init();

    return () => {
      mounted = false;
      // Dispose the instance from this effect's closure
      transportInstance?.dispose();
    };
  }, [sessionId, playerName]);

  // Subscribe to transport state
  const state = useSyncExternalStore(
    (callback) => transport?.subscribe(callback) ?? (() => {}),
    () => transport?.getState() ?? null
  );

  // Reset buzz state when game resets
  useEffect(() => {
    if (state?.snapshot?.phase === "lobby") {
      setHasBuzzed(false);
    }
  }, [state?.snapshot?.phase]);

  const handleBuzz = () => {
    if (!transport || hasBuzzed) return;
    transport.buzz();
    setHasBuzzed(true);
  };

  if (error) {
    return (
      <div className="screen player-screen">
        <div className="error-message">
          <h2>❌ Connection Failed</h2>
          <p>{error}</p>
          <button className="btn" onClick={onBack}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!transport || !state) {
    return (
      <div className="screen player-screen">
        <div className="loading">
          <div className="spinner"></div>
          <p>Connecting...</p>
        </div>
      </div>
    );
  }

  const snapshot = state.snapshot;
  const phase = snapshot?.phase ?? "lobby";
  const isMyTurn = phase === "ready" || phase === "buzzing";
  const canBuzz = isMyTurn && !hasBuzzed && state.clockSyncReady;
  const countdownValue = snapshot?.countdownValue;

  // Find if I'm the winner
  const winner = snapshot?.winner;
  const amIWinner = winner?.playerId === state.peerId;

  return (
    <div className="screen player-screen">
      <header className="player-header">
        <button className="btn btn-back" onClick={onBack}>
          ← Leave
        </button>
        <div className="player-info">
          <div className="player-name-display">{state.playerName}</div>
          <div className="connection-status">
            {state.isConnected ? (
              <>
                <span className="status-dot status-connected"></span>
                Connected
              </>
            ) : (
              <>
                <span className="status-dot status-disconnected"></span>
                Disconnected
              </>
            )}
          </div>
        </div>
      </header>

      <main className="player-main">
        {phase === "lobby" && (
          <div className="player-phase">
            <h2>⏳ Waiting to Start</h2>
            <p>The host will start the game soon</p>
            {!state.clockSyncReady && (
              <div className="sync-status">
                <div className="spinner-small"></div>
                <span>Syncing clock...</span>
              </div>
            )}
            {state.clockSyncReady && (
              <div className="sync-status synced">
                <span>✓ Clock synced</span>
                <span className="sync-offset">
                  Offset: {state.clockOffset.toFixed(0)}ms
                </span>
              </div>
            )}
          </div>
        )}

        {phase === "countdown" && (
          <div className="player-phase">
            <h2>Get Ready!</h2>
            <div className="countdown-number">
              {countdownValue === 0 ? "GO!" : countdownValue}
            </div>
          </div>
        )}

        {(phase === "ready" || phase === "buzzing") && (
          <div className="player-phase">
            <h2>⚡ Get Ready!</h2>
            <button
              className={`buzz-button ${hasBuzzed ? "buzzed" : ""} ${
                !canBuzz ? "disabled" : ""
              }`}
              onClick={handleBuzz}
              disabled={!canBuzz}
            >
              {hasBuzzed ? "✓ Buzzed!" : "BUZZ"}
            </button>
            {!state.clockSyncReady && (
              <p className="buzz-warning">
                ⚠️ Clock not synced - buzz may be inaccurate
              </p>
            )}
            {hasBuzzed && (
              <p className="buzz-feedback">Waiting for other players...</p>
            )}
          </div>
        )}

        {phase === "result" && (
          <div className="player-phase">
            {amIWinner ? (
              <>
                <h2>🎉 You Won!</h2>
                <p className="result-message">You were the fastest!</p>
              </>
            ) : (
              <>
                <h2>Better luck next time!</h2>
                <p className="result-message">
                  Winner: <strong>{winner?.playerName}</strong>
                </p>
              </>
            )}
          </div>
        )}
      </main>

      <footer className="player-footer">
        <div className="session-code-display">
          Session: <strong>{state.sessionId}</strong>
        </div>
      </footer>
    </div>
  );
}
