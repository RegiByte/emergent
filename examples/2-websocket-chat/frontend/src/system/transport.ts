/**
 * WebSocket Chat - Transport Layer
 *
 * Handles Socket.IO connection and message passing.
 * This is the boundary between the pure runtime and the outside world.
 */

import { io, type Socket } from "socket.io-client";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  AckResponse,
  RoomJoinData,
  Message,
} from "../types";
import type { ChatRuntime } from "./runtime";

const getSocketUrl = () => {
  // In production, use env var
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }

  // In development, use current hostname with port 8000
  const hostname = window.location.hostname;
  return `http://${hostname}:8000`;
};

const SOCKET_URL = getSocketUrl();
console.log('SOCKET_URL', SOCKET_URL);
export type ChatTransport = ReturnType<typeof createChatTransport>;

export function createChatTransport(config: {
  runtime: ChatRuntime;
  onConnectionChange: (connected: boolean) => void;
}) {
  let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  let currentRoomId: string | null = null;

  // Connect to server
  const connect = () => {
    if (socket?.connected) return;

    socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    // Connection events
    socket.on("connect", () => {
      console.log("[transport] Connected to server");
      config.onConnectionChange(true);
    });

    socket.on("disconnect", () => {
      console.log("[transport] Disconnected from server");
      config.onConnectionChange(false);
    });

    // Chat events → Runtime
    socket.on("user:joined", (data) => {
      config.runtime.dispatch({
        type: "user:joined",
        userId: data.userId,
        userName: data.userName,
        joinedAt: data.joinedAt,
      });
    });

    socket.on("user:left", (data) => {
      config.runtime.dispatch({
        type: "user:left",
        userId: data.userId,
        userName: data.userName,
      });
    });

    socket.on("message:received", (message: Message) => {
      config.runtime.dispatch({
        type: "message:received",
        message,
      });
    });

    socket.on("message:reaction-updated", (data) => {
      config.runtime.dispatch({
        type: "message:reaction-updated",
        messageId: data.messageId,
        emoji: data.emoji,
        userId: data.userId,
      });
    });

    socket.on("typing:user-started", (data) => {
      config.runtime.dispatch({
        type: "typing:user-started",
        userId: data.userId,
        userName: data.userName,
      });
    });

    socket.on("typing:user-stopped", (data) => {
      config.runtime.dispatch({
        type: "typing:user-stopped",
        userId: data.userId,
      });
    });
  };

  // Create room
  const createRoom = (userName: string): Promise<RoomJoinData> => {
    return new Promise((resolve, reject) => {
      if (!socket?.connected) {
        reject(new Error("Not connected to server"));
        return;
      }

      socket.emit(
        "room:create",
        { userName },
        (response: AckResponse<RoomJoinData>) => {
          if (response.ok) {
            currentRoomId = response.data.roomId;
            resolve(response.data);
          } else {
            reject(new Error(response.error));
          }
        }
      );
    });
  };

  // Join room
  const joinRoom = (
    roomId: string,
    userName: string
  ): Promise<RoomJoinData> => {
    return new Promise((resolve, reject) => {
      if (!socket?.connected) {
        reject(new Error("Not connected to server"));
        return;
      }

      socket.emit(
        "room:join",
        { roomId, userName },
        (response: AckResponse<RoomJoinData>) => {
          if (response.ok) {
            currentRoomId = response.data.roomId;
            resolve(response.data);
          } else {
            reject(new Error(response.error));
          }
        }
      );
    });
  };

  // Send message (called by runtime executor)
  const send = (event: string, payload: unknown) => {
    if (!socket?.connected) {
      console.warn("[transport] Cannot send, not connected");
      return;
    }

    switch (event) {
      case "message:send":
        socket.emit(
          "message:send",
          payload as { content: string },
          (response) => {
            if (!response.ok) {
              console.error(
                "[transport] Failed to send message:",
                response.error
              );
            }
          }
        );
        break;

      case "message:react":
        socket.emit(
          "message:react",
          payload as { messageId: string; emoji: string },
          (response) => {
            if (!response.ok) {
              console.error("[transport] Failed to react:", response.error);
            }
          }
        );
        break;

      case "typing:start":
        socket.emit("typing:start");
        break;

      case "typing:stop":
        socket.emit("typing:stop");
        break;

      default:
        console.warn("[transport] Unknown event:", event);
    }
  };

  // Leave room
  const leaveRoom = () => {
    if (socket?.connected) {
      socket.emit("room:leave");
      currentRoomId = null;
    }
  };

  // Disconnect
  const disconnect = () => {
    if (socket) {
      socket.disconnect();
      socket = null;
      currentRoomId = null;
    }
  };

  return {
    connect,
    disconnect,
    createRoom,
    joinRoom,
    leaveRoom,
    send,
    isConnected: () => socket?.connected ?? false,
    getCurrentRoomId: () => currentRoomId,
  };
}
