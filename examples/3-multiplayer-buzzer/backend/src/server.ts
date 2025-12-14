/**
 * Multiplayer Buzzer - Signaling Server
 *
 * This server demonstrates Braided resource system on the backend.
 * It manages WebRTC signaling for peer-to-peer connections.
 *
 * Architecture:
 * - Express server (HTTP endpoints)
 * - Socket.IO server (WebRTC signaling)
 * - Session store (manages game sessions)
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

type Session = {
  id: string;
  hostId: string | null;
  peers: Set<string>;
  createdAt: number;
  hostToken: string;
  hostGraceExpiresAt: number | null;
  reclaimTimer: NodeJS.Timeout | null;
};

type SessionStore = {
  create: (hostId: string) => Session;
  get: (sessionId: string) => Session | undefined;
  delete: (sessionId: string) => void;
  findBySocket: (socketId: string) => Session | undefined;
  removePeer: (sessionId: string, peerId: string) => void;
};

type SignalPayload =
  | { type: "offer"; description: RTCSessionDescriptionInit }
  | { type: "answer"; description: RTCSessionDescriptionInit }
  | { type: "ice"; candidate: RTCIceCandidateInit };

type AckResponse<T> = { ok: true; data: T } | { ok: false; error: string };

// ============================================
// Configuration
// ============================================

const PORT = Number(process.env.PORT ?? 8000);
const HOST_GRACE_PERIOD_MS = Number(
  process.env.HOST_GRACE_PERIOD_MS ?? 5 * 60 * 1000
); // 5 minutes

// ============================================
// Utilities
// ============================================

const createSessionId = () =>
  crypto.randomBytes(2).toString("hex").toUpperCase();

const log = (...messages: unknown[]) => {
  console.log("[signaling]", ...messages);
};

const createAck =
  <T>(respond?: (payload: AckResponse<T>) => void) =>
  (payload: AckResponse<T>) => {
    if (respond) {
      respond(payload);
    }
  };

// ============================================
// Session Store (Closure-based)
// ============================================

function createSessionStore(): SessionStore {
  const sessions = new Map<string, Session>();

  const createUniqueSessionId = (): string => {
    let sessionId = createSessionId();
    while (sessions.has(sessionId)) {
      sessionId = createSessionId();
    }
    return sessionId;
  };

  const create = (hostId: string): Session => {
    const session: Session = {
      id: createUniqueSessionId(),
      hostId,
      peers: new Set(),
      createdAt: Date.now(),
      hostToken: crypto.randomBytes(16).toString("hex"),
      hostGraceExpiresAt: null,
      reclaimTimer: null,
    };
    sessions.set(session.id, session);
    return session;
  };

  const get = (sessionId: string) => sessions.get(sessionId);

  const removePeer = (sessionId: string, peerId: string) => {
    const session = sessions.get(sessionId);
    if (!session) return;
    session.peers.delete(peerId);
  };

  const deleteSession = (sessionId: string) => {
    const session = sessions.get(sessionId);
    if (!session) return;
    if (session.reclaimTimer) {
      clearTimeout(session.reclaimTimer);
      session.reclaimTimer = null;
    }
    sessions.delete(sessionId);
  };

  const findBySocket = (socketId: string) => {
    for (const session of sessions.values()) {
      if (session.hostId === socketId) return session;
      if (session.peers.has(socketId)) return session;
    }
    return undefined;
  };

  return {
    create,
    get,
    delete: deleteSession,
    findBySocket,
    removePeer,
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
        message: "Multiplayer Buzzer - Signaling Server",
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
// Session Store Resource
// ============================================

const sessionStoreResource = defineResource({
  start: () => {
    const store = createSessionStore();
    log("Session store created");
    return store;
  },
  halt: () => {
    log("Session store halted");
  },
});

// ============================================
// Socket.IO Server Resource
// ============================================

const socketIOResource = defineResource({
  dependencies: ["httpServer", "sessionStore"],
  start: ({
    httpServer,
    sessionStore,
  }: {
    httpServer: StartedResource<typeof httpServerResource>;
    sessionStore: StartedResource<typeof sessionStoreResource>;
  }) => {
    const io = new SocketIOServer(httpServer, {
      cors: {
        origin: "*", // In production, restrict this
        methods: ["GET", "POST"],
      },
    });

    // Helper functions for session management
    const emitSessionEnded = (session: Session) => {
      io.to(session.id).emit("session:ended", { sessionId: session.id });
      log(`session ${session.id} closed`);
    };

    const clearHostGraceTimer = (session: Session) => {
      if (session.reclaimTimer) {
        clearTimeout(session.reclaimTimer);
        session.reclaimTimer = null;
      }
      session.hostGraceExpiresAt = null;
    };

    const startHostGrace = (session: Session) => {
      clearHostGraceTimer(session);
      session.hostId = null;
      session.hostGraceExpiresAt = Date.now() + HOST_GRACE_PERIOD_MS;
      session.reclaimTimer = setTimeout(() => {
        session.reclaimTimer = null;
        session.hostGraceExpiresAt = null;
        emitSessionEnded(session);
        sessionStore.delete(session.id);
      }, HOST_GRACE_PERIOD_MS);
      io.to(session.id).emit("host:pending", {
        sessionId: session.id,
        expiresAt: session.hostGraceExpiresAt,
      });
      log(
        `host for session ${session.id} disconnected; grace expires at ${session.hostGraceExpiresAt}`
      );
    };

    const handleSocketDeparture = (
      socketId: string,
      options: { intentional?: boolean } = {}
    ) => {
      const session = sessionStore.findBySocket(socketId);
      if (!session) return;

      if (session.hostId === socketId) {
        if (options.intentional) {
          emitSessionEnded(session);
          sessionStore.delete(session.id);
        } else {
          startHostGrace(session);
        }
        return;
      }

      sessionStore.removePeer(session.id, socketId);
      if (session.hostId) {
        io.to(session.hostId).emit("session:peer-left", {
          peerId: socketId,
          sessionId: session.id,
        });
      }
    };

    // Socket.IO connection handler
    io.on("connection", (socket: Socket) => {
      log("client connected", socket.id);

      // Create session (host only)
      socket.on("session:create", (respond) => {
        const ack = createAck(respond);
        const currentSession = sessionStore.findBySocket(socket.id);
        if (currentSession) {
          ack({
            ok: false,
            error: `Socket already has an active session (${currentSession.id})`,
          });
          return;
        }

        const session = sessionStore.create(socket.id);
        socket.join(session.id);
        ack({
          ok: true,
          data: {
            sessionId: session.id,
            hostToken: session.hostToken,
          },
        });
        log(`session ${session.id} created by ${socket.id}`);
      });

      // Join session (player)
      socket.on("session:join", (payload: { sessionId: string }, respond) => {
        const ack = createAck(respond);
        const targetSession = sessionStore.get(payload.sessionId);
        if (!targetSession) {
          ack({ ok: false, error: "Session not found" });
          return;
        }

        if (!targetSession.hostId) {
          ack({
            ok: false,
            error: "Host is unavailable. Please wait for the host to return.",
          });
          return;
        }

        if (targetSession.hostId === socket.id) {
          ack({ ok: false, error: "Host already owns this session" });
          return;
        }

        if (targetSession.peers.has(socket.id)) {
          ack({
            ok: true,
            data: {
              sessionId: targetSession.id,
              peerId: socket.id,
            },
          });
          io.to(targetSession.hostId).emit("session:peer-joined", {
            peerId: socket.id,
            sessionId: targetSession.id,
          });
          log(`${socket.id} resumed session ${targetSession.id}`);
          return;
        }

        targetSession.peers.add(socket.id);
        socket.join(targetSession.id);
        ack({
          ok: true,
          data: {
            sessionId: targetSession.id,
            peerId: socket.id,
            hostId: targetSession.hostId,  // ← Player needs this!
          },
        });
        io.to(targetSession.hostId).emit("session:peer-joined", {
          peerId: socket.id,
          sessionId: targetSession.id,
        });
        log(`${socket.id} joined session ${targetSession.id}`);
      });

      // Leave session
      socket.on("session:leave", () => {
        handleSocketDeparture(socket.id, { intentional: true });
      });

      // Reclaim session (host recovery)
      socket.on(
        "session:reclaim",
        (payload: { sessionId: string; hostToken: string }, respond) => {
          const ack = createAck(respond);
          const { sessionId, hostToken } = payload ?? {};
          if (!sessionId || !hostToken) {
            ack({ ok: false, error: "Invalid reclaim payload" });
            return;
          }
          const session = sessionStore.get(sessionId);
          if (!session) {
            ack({ ok: false, error: "Session not found" });
            return;
          }
          if (session.hostToken !== hostToken) {
            ack({ ok: false, error: "Invalid host token" });
            return;
          }
          if (
            !session.hostGraceExpiresAt ||
            session.hostGraceExpiresAt < Date.now()
          ) {
            emitSessionEnded(session);
            sessionStore.delete(session.id);
            ack({ ok: false, error: "Host grace period expired" });
            return;
          }

          clearHostGraceTimer(session);
          session.hostId = socket.id;
          socket.join(session.id);

          ack({
            ok: true,
            data: {
              sessionId: session.id,
              hostToken: session.hostToken,
            },
          });

          io.to(session.id).emit("session:host-resumed", {
            sessionId: session.id,
          });
          session.peers.forEach((peerId) => {
            io.to(session.hostId!).emit("session:peer-joined", {
              peerId,
              sessionId: session.id,
            });
          });
          log(`session ${session.id} host reclaimed by ${socket.id}`);
        }
      );

      // Relay WebRTC signaling
      socket.on(
        "signal:relay",
        (payload: {
          targetId: string;
          data: SignalPayload | Record<string, unknown>;
        }) => {
          if (!payload?.targetId) return;
          io.to(payload.targetId).emit("signal:receive", {
            fromId: socket.id,
            data: payload.data,
          });
        }
      );

      // Disconnect
      socket.on("disconnect", () => {
        log("client disconnected", socket.id);
        handleSocketDeparture(socket.id);
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
      log(`🚀 Signaling server ready on http://localhost:${PORT}`);
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
  sessionStore: sessionStoreResource,
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
    console.error("[signaling] ❌ Failed to start system:", error);
    process.exit(1);
  });
