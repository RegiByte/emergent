/**
 * Stateless Router Example - Event Routing Without State
 *
 * Demonstrates:
 * - Stateless event loop (void state)
 * - Pure event routing
 * - Transport effects
 * - Minimal handler/executor context
 */

import {
  emergentSystem,
  EventHandlerMap,
  EffectExecutorMap,
} from "../src/index";

// 1. Define domain types
type GameEvents =
  | { type: "player:joined"; playerId: string; name: string }
  | { type: "player:left"; playerId: string }
  | { type: "message:broadcast"; message: string }
  | { type: "message:private"; fromId: string; playerId: string; message: string };

type GameEffects =
  | { type: "transport:send"; playerId: string; payload: unknown }
  | { type: "transport:broadcast"; payload: unknown }
  | { type: "log"; level: "info" | "warn"; message: string };

// No state needed
type GameState = void;

type HandlerContext = {
  getCurrentTime: () => number;
  // Note: getState is now a formal parameter of createEventLoop
};

type ExecutorContext = {
  transports: Map<string, { send: (payload: unknown) => void }>;
  logger: { info: (msg: string) => void; warn: (msg: string) => void };
  // Note: dispatch is automatically injected by the library, no need to define it here
};

// 2. Create emergent system
const createEventLoop = emergentSystem<
  GameEvents,
  GameEffects,
  GameState,
  HandlerContext,
  ExecutorContext
>();

type Handlers = EventHandlerMap<
  GameEvents,
  GameEffects,
  GameState,
  HandlerContext
>;

// 3. Define handlers (pure event routing)
const handlers = {
  "player:joined": (_state, event, _ctx) => {
    return [
      {
        type: "transport:send",
        playerId: event.playerId,
        payload: { type: "welcome", name: event.name },
      },
      {
        type: "transport:broadcast",
        payload: {
          type: "player-joined",
          playerId: event.playerId,
          name: event.name,
        },
      },
      {
        type: "log",
        level: "info",
        message: `Player ${event.name} (${event.playerId}) joined`,
      },
    ];
  },

  "player:left": (_state, event, _ctx) => {
    return [
      {
        type: "transport:broadcast",
        payload: { type: "player-left", playerId: event.playerId },
      },
      {
        type: "log",
        level: "info",
        message: `Player ${event.playerId} left`,
      },
    ];
  },

  "message:broadcast": (_state, event, _ctx) => {
    return [
      {
        type: "transport:broadcast",
        payload: { type: "message", text: event.message },
      },
      {
        type: "log",
        level: "info",
        message: `Broadcast: ${event.message}`,
      },
    ];
  },

  "message:private": (_state, event, _ctx) => {
    return [
      {
        type: "transport:send",
        fromId: event.fromId,
        playerId: event.playerId,
        payload: { type: "private-message", text: event.message },
      },
      {
        type: "log",
        level: "info",
        message: `Private message to ${event.playerId}: ${event.message}`,
      },
    ];
  },
} satisfies Handlers;

// 4. Define executors (side effects)
const executor = {
  "transport:send": (effect, ctx) => {
    const transport = ctx.transports.get(effect.playerId);
    if (!transport) {
      ctx.logger.warn(`No transport for player: ${effect.playerId}`);
      return;
    }
    transport.send(effect.payload);
  },

  "transport:broadcast": (effect, ctx) => {
    ctx.transports.forEach((transport) => {
      transport.send(effect.payload);
    });
  },

  log: (effect, ctx) => {
    if (effect.level === "info") {
      ctx.logger.info(effect.message);
    } else {
      ctx.logger.warn(effect.message);
    }
  },
} satisfies EffectExecutorMap<GameEffects, GameEvents, ExecutorContext>;

// 5. Create mock transports
const transports = new Map<string, { send: (payload: unknown) => void }>();

transports.set("player1", {
  send: (payload) =>
    console.log("[Transport -> player1]", JSON.stringify(payload)),
});

transports.set("player2", {
  send: (payload) =>
    console.log("[Transport -> player2]", JSON.stringify(payload)),
});

// 6. Create the loop
const loop = createEventLoop({
  getState: () => undefined,
  handlers,
  executors: executor,
  handlerContext: {
    getCurrentTime: () => Date.now(),
  },
  executorContext: {
    transports,
    logger: {
      info: (msg) => console.log("[INFO]", msg),
      warn: (msg) => console.warn("[WARN]", msg),
    },
  },
});

// 7. Subscribe to track message routing (optional)
const routingStats = {
  totalEvents: 0,
  messagesSent: 0,
  broadcastCount: 0,
  privateCount: 0,
};

const unsubscribe = loop.subscribe((event, effects) => {
  routingStats.totalEvents++;
  effects.forEach((effect) => {
    if (effect.type === "transport:send") {
      routingStats.messagesSent++;
    }
    if (effect.type === "transport:broadcast") {
      routingStats.broadcastCount++;
    }
    if (effect.type === "transport:send" && "playerId" in effect) {
      routingStats.privateCount++;
    }
  });
});

// 8. Use it
console.log("\n=== Stateless Router Example ===\n");

loop.dispatch({
  type: "player:joined",
  playerId: "player1",
  name: "Alice",
});

loop.dispatch({
  type: "player:joined",
  playerId: "player2",
  name: "Bob",
});

loop.dispatch({
  type: "message:broadcast",
  message: "Hello everyone!",
});

loop.dispatch({
  type: "message:private",
  fromId: "player2",
  playerId: "player1",
  message: "Secret message for Alice",
});

loop.dispatch({
  type: "player:left",
  playerId: "player2",
});

// Show routing statistics
console.log("\n--- Routing Statistics (from subscription) ---");
console.log(`Total events: ${routingStats.totalEvents}`);
console.log(`Messages sent: ${routingStats.messagesSent}`);
console.log(`Broadcasts: ${routingStats.broadcastCount}`);
console.log(`Private messages: ${routingStats.privateCount}`);

unsubscribe();
loop.dispose();
console.log("\n=== Stateless Router Example Complete ===\n");
