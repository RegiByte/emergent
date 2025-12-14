/**
 * WebSocket Chat - Server
 *
 * This server demonstrates Braided resource system on the backend.
 * It manages chat rooms and message history via WebSocket.
 *
 * Architecture:
 * - Express server (HTTP endpoints)
 * - Socket.IO server (real-time messaging)
 * - Session store (manages chat rooms and messages)
 * - All orchestrated via Braided resources
 */

import { defineResource, StartedResource, startSystem } from "braided";
import express from "express";
import crypto from "node:crypto";
import { createServer } from "node:http";
import { Server as SocketIOServer, type Socket } from "socket.io";

// ============================================
// Types
// ============================================

type Message = {
  id: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: number;
  reactions: Record<string, string[]>; // emoji -> userIds[]
};

type User = {
  id: string;
  name: string;
  joinedAt: number;
};

type Room = {
  id: string;
  createdAt: number;
  users: Map<string, User>;
  messages: Message[];
};

type RoomStore = {
  create: () => Room;
  get: (roomId: string) => Room | undefined;
  delete: (roomId: string) => void;
  findBySocket: (socketId: string) => Room | undefined;
  addUser: (roomId: string, user: User) => void;
  removeUser: (roomId: string, userId: string) => void;
  addMessage: (roomId: string, message: Message) => void;
  addReaction: (roomId: string, messageId: string, emoji: string, userId: string) => void;
};

type AckResponse<T> = { ok: true; data: T } | { ok: false; error: string };

// ============================================
// Configuration
// ============================================

const PORT = Number(process.env.PORT ?? 8000);
const MAX_MESSAGES_PER_ROOM = Number(process.env.MAX_MESSAGES_PER_ROOM ?? 100);

// ============================================
// Utilities
// ============================================

const createRoomId = () =>
  crypto.randomBytes(2).toString("hex").toUpperCase();

const createMessageId = () =>
  crypto.randomBytes(8).toString("hex");

const log = (...messages: unknown[]) => {
  console.log("[chat-server]", ...messages);
};

const createAck =
  <T>(respond?: (payload: AckResponse<T>) => void) =>
  (payload: AckResponse<T>) => {
    if (respond) {
      respond(payload);
    }
  };

// ============================================
// Room Store (Closure-based)
// ============================================

function createRoomStore(): RoomStore {
  const rooms = new Map<string, Room>();
  const socketToRoom = new Map<string, string>(); // socketId -> roomId

  const createUniqueRoomId = (): string => {
    let roomId = createRoomId();
    while (rooms.has(roomId)) {
      roomId = createRoomId();
    }
    return roomId;
  };

  const create = (): Room => {
    const room: Room = {
      id: createUniqueRoomId(),
      createdAt: Date.now(),
      users: new Map(),
      messages: [],
    };
    rooms.set(room.id, room);
    log(`Room ${room.id} created`);
    return room;
  };

  const get = (roomId: string) => rooms.get(roomId);

  const addUser = (roomId: string, user: User) => {
    const room = rooms.get(roomId);
    if (!room) return;
    room.users.set(user.id, user);
    socketToRoom.set(user.id, roomId);
    log(`User ${user.name} (${user.id}) joined room ${roomId}`);
  };

  const removeUser = (roomId: string, userId: string) => {
    const room = rooms.get(roomId);
    if (!room) return;
    room.users.delete(userId);
    socketToRoom.delete(userId);
    log(`User ${userId} left room ${roomId}`);
    
    // Delete room if empty
    if (room.users.size === 0) {
      rooms.delete(roomId);
      log(`Room ${roomId} deleted (empty)`);
    }
  };

  const addMessage = (roomId: string, message: Message) => {
    const room = rooms.get(roomId);
    if (!room) return;
    room.messages.push(message);
    
    // Keep only last N messages
    if (room.messages.length > MAX_MESSAGES_PER_ROOM) {
      room.messages.shift();
    }
    log(`Message added to room ${roomId} (total: ${room.messages.length})`);
  };

  const addReaction = (roomId: string, messageId: string, emoji: string, userId: string) => {
    const room = rooms.get(roomId);
    if (!room) return;
    
    const message = room.messages.find(m => m.id === messageId);
    if (!message) return;
    
    if (!message.reactions[emoji]) {
      message.reactions[emoji] = [];
    }
    
    // Toggle reaction (add if not present, remove if present)
    const index = message.reactions[emoji].indexOf(userId);
    if (index === -1) {
      message.reactions[emoji].push(userId);
    } else {
      message.reactions[emoji].splice(index, 1);
      if (message.reactions[emoji].length === 0) {
        delete message.reactions[emoji];
      }
    }
    log(`Reaction ${emoji} toggled on message ${messageId} by ${userId}`);
  };

  const findBySocket = (socketId: string) => {
    const roomId = socketToRoom.get(socketId);
    return roomId ? rooms.get(roomId) : undefined;
  };

  const deleteRoom = (roomId: string) => {
    const room = rooms.get(roomId);
    if (!room) return;
    
    // Clean up socket mappings
    for (const userId of room.users.keys()) {
      socketToRoom.delete(userId);
    }
    
    rooms.delete(roomId);
    log(`Room ${roomId} deleted`);
  };

  return {
    create,
    get,
    delete: deleteRoom,
    findBySocket,
    addUser,
    removeUser,
    addMessage,
    addReaction,
  };
}

// ============================================
// Express App Resource
// ============================================

const expressAppResource = defineResource({
  start: () => {
    const app = express();

    app.use(express.json());

    app.get("/health", (_, res) => {
      res.json({ status: "ok", timestamp: Date.now() });
    });

    app.get("/", (_, res) => {
      res.json({
        message: "WebSocket Chat - Server",
        version: "1.0.0",
      });
    });

    log("Express app created");
    return app;
  },
  halt: (instance) => {
    log("Express app halted");
  },
});

// ============================================
// HTTP Server Resource
// ============================================

const httpServerResource = defineResource({
  dependencies: ["expressApp"],
  start: ({
    expressApp,
  }: {
    expressApp: StartedResource<typeof expressAppResource>;
  }) => {
    const server = createServer(expressApp);
    log("HTTP server created");
    return server;
  },
  halt: (server) => {
    server.close();
    log("HTTP server closed");
  },
});

// ============================================
// Room Store Resource
// ============================================

const roomStoreResource = defineResource({
  start: () => {
    const store = createRoomStore();
    log("Room store created");
    return store;
  },
  halt: () => {
    log("Room store halted");
  },
});

// ============================================
// Socket.IO Server Resource
// ============================================

const socketIOResource = defineResource({
  dependencies: ["httpServer", "roomStore"],
  start: ({
    httpServer,
    roomStore,
  }: {
    httpServer: StartedResource<typeof httpServerResource>;
    roomStore: StartedResource<typeof roomStoreResource>;
  }) => {
    const io = new SocketIOServer(httpServer, {
      cors: {
        origin: "*", // In production, restrict this
        methods: ["GET", "POST"],
      },
    });

    // Helper: Serialize room state for clients
    const serializeRoom = (room: Room) => ({
      id: room.id,
      users: Array.from(room.users.values()),
      messages: room.messages,
    });

    // Helper: Handle user leaving
    const handleUserLeave = (socketId: string) => {
      const room = roomStore.findBySocket(socketId);
      if (!room) return;

      const user = room.users.get(socketId);
      if (!user) return;

      roomStore.removeUser(room.id, socketId);
      
      // Notify others
      io.to(room.id).emit("user:left", {
        userId: socketId,
        userName: user.name,
      });
    };

    // Socket.IO connection handler
    io.on("connection", (socket: Socket) => {
      log("Client connected", socket.id);

      // Create room
      socket.on("room:create", (payload: { userName: string }, respond) => {
        const ack = createAck(respond);
        
        if (!payload?.userName) {
          ack({ ok: false, error: "User name is required" });
          return;
        }

        const room = roomStore.create();
        const user: User = {
          id: socket.id,
          name: payload.userName,
          joinedAt: Date.now(),
        };

        roomStore.addUser(room.id, user);
        socket.join(room.id);

        ack({
          ok: true,
          data: {
            roomId: room.id,
            userId: socket.id,
            room: serializeRoom(room),
          },
        });
      });

      // Join room
      socket.on("room:join", (payload: { roomId: string; userName: string }, respond) => {
        const ack = createAck(respond);
        
        if (!payload?.roomId || !payload?.userName) {
          ack({ ok: false, error: "Room ID and user name are required" });
          return;
        }

        const room = roomStore.get(payload.roomId);
        if (!room) {
          ack({ ok: false, error: "Room not found" });
          return;
        }

        const user: User = {
          id: socket.id,
          name: payload.userName,
          joinedAt: Date.now(),
        };

        roomStore.addUser(room.id, user);
        socket.join(room.id);

        // Send room state to new user
        ack({
          ok: true,
          data: {
            roomId: room.id,
            userId: socket.id,
            room: serializeRoom(room),
          },
        });

        // Notify others
        socket.to(room.id).emit("user:joined", {
          userId: user.id,
          userName: user.name,
          joinedAt: user.joinedAt,
        });
      });

      // Send message
      socket.on("message:send", (payload: { content: string }, respond) => {
        const ack = createAck(respond);
        const room = roomStore.findBySocket(socket.id);
        
        if (!room) {
          ack({ ok: false, error: "Not in a room" });
          return;
        }

        const user = room.users.get(socket.id);
        if (!user) {
          ack({ ok: false, error: "User not found" });
          return;
        }

        if (!payload?.content || payload.content.trim() === "") {
          ack({ ok: false, error: "Message content is required" });
          return;
        }

        const message: Message = {
          id: createMessageId(),
          userId: socket.id,
          userName: user.name,
          content: payload.content.trim(),
          timestamp: Date.now(),
          reactions: {},
        };

        roomStore.addMessage(room.id, message);

        // Broadcast to all in room (including sender)
        io.to(room.id).emit("message:received", message);

        ack({ ok: true, data: { messageId: message.id } });
      });

      // React to message
      socket.on("message:react", (payload: { messageId: string; emoji: string }, respond) => {
        const ack = createAck(respond);
        const room = roomStore.findBySocket(socket.id);
        
        if (!room) {
          ack({ ok: false, error: "Not in a room" });
          return;
        }

        if (!payload?.messageId || !payload?.emoji) {
          ack({ ok: false, error: "Message ID and emoji are required" });
          return;
        }

        roomStore.addReaction(room.id, payload.messageId, payload.emoji, socket.id);

        // Broadcast reaction update
        io.to(room.id).emit("message:reaction-updated", {
          messageId: payload.messageId,
          emoji: payload.emoji,
          userId: socket.id,
        });

        ack({ ok: true, data: {} });
      });

      // Typing indicator
      socket.on("typing:start", () => {
        const room = roomStore.findBySocket(socket.id);
        if (!room) return;

        const user = room.users.get(socket.id);
        if (!user) return;

        socket.to(room.id).emit("typing:user-started", {
          userId: socket.id,
          userName: user.name,
        });
      });

      socket.on("typing:stop", () => {
        const room = roomStore.findBySocket(socket.id);
        if (!room) return;

        socket.to(room.id).emit("typing:user-stopped", {
          userId: socket.id,
        });
      });

      // Leave room
      socket.on("room:leave", () => {
        handleUserLeave(socket.id);
      });

      // Disconnect
      socket.on("disconnect", () => {
        log("Client disconnected", socket.id);
        handleUserLeave(socket.id);
      });
    });

    log("Socket.IO server created");
    return io;
  },
  halt: (io) => {
    io.close();
    log("Socket.IO server closed");
  },
});

// ============================================
// Server Listener Resource
// ============================================

const serverListenerResource = defineResource({
  dependencies: ["httpServer"],
  start: ({
    httpServer,
  }: {
    httpServer: StartedResource<typeof httpServerResource>;
  }) => {
    httpServer.listen(PORT, () => {
      log(`🚀 Chat server ready on http://localhost:${PORT}`);
    });
  },
  halt: () => {
    log("Server listener halted");
  },
});

// ============================================
// System Configuration
// ============================================

const systemConfig = {
  expressApp: expressAppResource,
  httpServer: httpServerResource,
  roomStore: roomStoreResource,
  socketIO: socketIOResource,
  serverListener: serverListenerResource,
};

// ============================================
// Start the System
// ============================================

startSystem(systemConfig)
  .then(() => {
    log("✅ All resources started successfully");
  })
  .catch((error) => {
    console.error("[chat-server] ❌ Failed to start system:", error);
    process.exit(1);
  });
