/**
 * WebSocket Chat - Main App
 *
 * This is the entry point that manages:
 * - System lifecycle (Braided resources)
 * - Screen routing (home, create, join, chat)
 */

import { useState } from "react";
import "./App.css";
import { ChatRoom } from "./ChatRoom";
import { useSystem, type ChatSystem } from "./system/system";

type Screen = "home" | "creating" | "joining" | "chat";

export function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [userName, setUserName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [error, setError] = useState("");

  // Start the chat system (Z-axis comes alive!)
  const system = useSystem() as ChatSystem | null;

  // Handle create room
  const handleCreateRoom = async () => {
    if (!userName.trim()) {
      setError("Please enter your name");
      return;
    }

    if (!system) {
      setError("System not ready");
      return;
    }

    setScreen("creating");
    setError("");

    try {
      const result = await system.transport.createRoom(userName);

      // Initialize state with room data
      system.runtimeStore.setState({
        state: {
          roomId: result.roomId,
          userId: result.userId,
          users: result.room.users,
          messages: result.room.messages,
          typingUsers: new Set(),
          connected: true,
        },
      });

      setScreen("chat");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create room");
      setScreen("home");
    }
  };

  // Handle join room
  const handleJoinRoom = async () => {
    if (!userName.trim() || !roomId.trim()) {
      setError("Please enter your name and room code");
      return;
    }

    if (!system) {
      setError("System not ready");
      return;
    }

    setScreen("joining");
    setError("");

    try {
      const result = await system.transport.joinRoom(roomId, userName);

      // Initialize state with room data
      system.runtimeStore.setState({
        state: {
          roomId: result.roomId,
          userId: result.userId,
          users: result.room.users,
          messages: result.room.messages,
          typingUsers: new Set(),
          connected: true,
        },
      });

      setScreen("chat");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join room");
      setScreen("home");
    }
  };

  // Handle leave room
  const handleLeaveRoom = () => {
    if (system) {
      system.transport.leaveRoom();

      // Reset state
      system.runtimeStore.setState({
        state: {
          roomId: null,
          userId: null,
          users: [],
          messages: [],
          typingUsers: new Set(),
          connected: false,
        },
      });
    }

    setScreen("home");
    setUserName("");
    setRoomId("");
    setError("");
  };

  // Show loading while system initializes
  if (!system) {
    return (
      <div className="app">
        <div className="loading-screen">
          <div className="loading-spinner"></div>
          <p>Initializing chat system...</p>
        </div>
      </div>
    );
  }

  // Show chat room
  if (screen === "chat") {
    return (
      <div className="app">
        <ChatRoom system={system} onLeave={handleLeaveRoom} />
      </div>
    );
  }

  // Show loading states
  if (screen === "creating" || screen === "joining") {
    return (
      <div className="app">
        <div className="loading-screen">
          <div className="loading-spinner"></div>
          <p>
            {screen === "creating" ? "Creating room..." : "Joining room..."}
          </p>
        </div>
      </div>
    );
  }

  // Show home screen
  return (
    <div className="app">
      <div className="home-screen">
        <div className="home-content">
          <h1 className="title">💬 WebSocket Chat</h1>
          <p className="subtitle">
            Real-time messaging with the Observer Pattern
          </p>

          {error && <div className="error-message">{error}</div>}

          <div className="home-cards">
            <div className="card">
              <h2>🆕 Create Room</h2>
              <p>Start a new chat room and invite others</p>
              <div className="form">
                <input
                  type="text"
                  placeholder="Your Name"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  maxLength={20}
                  className="input"
                  onKeyDown={(e) => e.key === "Enter" && handleCreateRoom()}
                />
                <button
                  className="btn btn-primary"
                  onClick={handleCreateRoom}
                  disabled={!userName.trim()}
                >
                  Create Room
                </button>
              </div>
            </div>

            <div className="card">
              <h2>🚪 Join Room</h2>
              <p>Enter the room code to join</p>
              <div className="form">
                <input
                  type="text"
                  placeholder="Room Code (e.g., A1B2)"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                  maxLength={4}
                  className="input"
                />
                <input
                  type="text"
                  placeholder="Your Name"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  maxLength={20}
                  className="input"
                  onKeyDown={(e) => e.key === "Enter" && handleJoinRoom()}
                />
                <button
                  className="btn btn-primary"
                  onClick={handleJoinRoom}
                  disabled={!userName.trim() || !roomId.trim()}
                >
                  Join Room
                </button>
              </div>
            </div>
          </div>

          <div className="info-section">
            <h3>Features</h3>
            <div className="info-grid">
              <div className="info-item">
                <div className="info-icon">⚡</div>
                <div className="info-text">
                  <strong>Real-Time</strong>
                  <p>WebSocket-powered instant messaging</p>
                </div>
              </div>
              <div className="info-item">
                <div className="info-icon">😊</div>
                <div className="info-text">
                  <strong>Emoji Reactions</strong>
                  <p>React to messages with emojis</p>
                </div>
              </div>
              <div className="info-item">
                <div className="info-icon">👀</div>
                <div className="info-text">
                  <strong>Typing Indicators</strong>
                  <p>See when others are typing</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
