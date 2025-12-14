/**
 * WebSocket Chat - ChatRoom Component
 *
 * This component observes the chat system (Z-axis) and renders the UI (X-Y plane).
 * It's a window between dimensions!
 */

import { useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import type { ChatSystem } from "./system/system";
import type { Message } from "./types";

type ChatRoomProps = {
  system: ChatSystem;
  onLeave: () => void;
};

export function ChatRoom({ system, onLeave }: ChatRoomProps) {
  const state = useStore(system.runtimeStore, (s) => s.state);
  const [messageInput, setMessageInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages]);

  // Handle message send
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim()) return;

    system.chatRuntime.runtime.dispatch({
      type: "message:send",
      content: messageInput,
    });

    setMessageInput("");
    handleStopTyping();
  };

  // Handle typing indicators
  const handleInputChange = (value: string) => {
    setMessageInput(value);

    if (!isTyping && value.length > 0) {
      setIsTyping(true);
      system.chatRuntime.runtime.dispatch({ type: "typing:start" });
    }

    // Reset typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = window.setTimeout(() => {
      handleStopTyping();
    }, 2000);
  };

  const handleStopTyping = () => {
    if (isTyping) {
      setIsTyping(false);
      system.chatRuntime.runtime.dispatch({ type: "typing:stop" });
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  };

  // Handle emoji reaction
  const handleReaction = (messageId: string, emoji: string) => {
    system.chatRuntime.runtime.dispatch({
      type: "message:react",
      messageId,
      emoji,
    });
  };

  // Get typing users (excluding self)
  const typingUserNames = Array.from(state.typingUsers)
    .filter((id) => id !== state.userId)
    .map((id) => state.users.find((u) => u.id === id)?.name)
    .filter(Boolean);

  return (
    <div className="chat-room">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-content">
          <div>
            <h2>💬 Room {state.roomId}</h2>
            <p className="chat-subtitle">
              {state.users.length} {state.users.length === 1 ? "person" : "people"} online
              {!state.connected && " • Disconnected"}
            </p>
          </div>
          <button className="btn btn-secondary" onClick={onLeave}>
            Leave Room
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="chat-content">
        {/* Sidebar - Users */}
        <div className="chat-sidebar">
          <h3>Online ({state.users.length})</h3>
          <div className="user-list">
            {state.users.map((user) => (
              <div key={user.id} className="user-item">
                <div className="user-avatar">{user.name[0].toUpperCase()}</div>
                <div className="user-info">
                  <div className="user-name">
                    {user.name}
                    {user.id === state.userId && <span className="user-badge">You</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="chat-messages-container">
          <div className="chat-messages">
            {state.messages.length === 0 && (
              <div className="empty-state">
                <p>No messages yet. Start the conversation! 👋</p>
              </div>
            )}

            {state.messages.map((message) => (
              <MessageItem
                key={message.id}
                message={message}
                isOwn={message.userId === state.userId}
                onReaction={(emoji) => handleReaction(message.id, emoji)}
              />
            ))}

            <div ref={messagesEndRef} />
          </div>

          {/* Typing Indicator */}
          {typingUserNames.length > 0 && (
            <div className="typing-indicator">
              {typingUserNames.length === 1
                ? `${typingUserNames[0]} is typing...`
                : `${typingUserNames.length} people are typing...`}
            </div>
          )}

          {/* Message Input */}
          <form className="message-input-form" onSubmit={handleSendMessage}>
            <input
              type="text"
              className="message-input"
              placeholder="Type a message..."
              value={messageInput}
              onChange={(e) => handleInputChange(e.target.value)}
              disabled={!state.connected}
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!messageInput.trim() || !state.connected}
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Message Item Component
// ============================================

type MessageItemProps = {
  message: Message;
  isOwn: boolean;
  onReaction: (emoji: string) => void;
};

function MessageItem({ message, isOwn, onReaction }: MessageItemProps) {
  const [showReactions, setShowReactions] = useState(false);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const quickEmojis = ["👍", "❤️", "😂", "🎉", "🤔", "👀"];

  return (
    <div className={`message ${isOwn ? "message-own" : ""}`}>
      <div className="message-content">
        {!isOwn && <div className="message-author">{message.userName}</div>}
        <div className="message-bubble">
          <p>{message.content}</p>
          <span className="message-time">{formatTime(message.timestamp)}</span>
        </div>

        {/* Reactions */}
        {Object.keys(message.reactions).length > 0 && (
          <div className="message-reactions">
            {Object.entries(message.reactions).map(([emoji, userIds]) => (
              <button
                key={emoji}
                className="reaction-badge"
                onClick={() => onReaction(emoji)}
                title={`${userIds.length} reaction${userIds.length > 1 ? "s" : ""}`}
              >
                {emoji} {userIds.length}
              </button>
            ))}
          </div>
        )}

        {/* Reaction Picker */}
        <div className="message-actions">
          <button
            className="reaction-trigger"
            onClick={() => setShowReactions(!showReactions)}
          >
            😊
          </button>
          {showReactions && (
            <div className="reaction-picker">
              {quickEmojis.map((emoji) => (
                <button
                  key={emoji}
                  className="reaction-option"
                  onClick={() => {
                    onReaction(emoji);
                    setShowReactions(false);
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


