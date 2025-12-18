/**
 * Braided Integration Example - Event Loop as a Resource
 *
 * Demonstrates:
 * - Event loop as a Braided resource
 * - Lifecycle management (start/halt)
 * - Dependency injection pattern
 * - Composition with other resources
 *
 * Note: This is a conceptual example showing the pattern.
 * To actually run this, you would need to install 'braided':
 *   npm install braided
 */

import {
  emergentSystem,
  EventHandlerMap,
  EffectExecutorMap,
} from "../src/index";

// Conceptual Braided types (for demonstration)
type ResourceConfig<TDeps, TResource> = {
  dependencies?: string[];
  start: (deps: TDeps) => TResource | Promise<TResource>;
  halt: (instance: TResource) => void | Promise<void>;
};

function defineResource<TDeps, TResource>(
  config: ResourceConfig<TDeps, TResource>
): ResourceConfig<TDeps, TResource> {
  return config;
}

// 1. Define domain types
type GameEvents =
  | { type: "game:start" }
  | { type: "game:tick"; deltaTime: number }
  | { type: "game:stop" }
  | { type: "player:action"; playerId: string; action: string };

type GameEffects =
  | { type: "state:update"; updates: Partial<GameState> }
  | { type: "timer:schedule"; id: string; delayMs: number; event: GameEvents }
  | { type: "transport:broadcast"; payload: unknown }
  | { type: "log"; message: string };

type GameState = {
  isRunning: boolean;
  tickCount: number;
  players: Map<string, { name: string; score: number }>;
};

type HandlerContext = {
  // Pure utilities and domain data only
  // Note: getState is now a formal parameter of createEventLoop
};

type ExecutorContext = {
  setState: (state: GameState) => void;
  timers: {
    schedule: (id: string, delayMs: number, callback: () => void) => void;
  };
  transports: { broadcast: (payload: unknown) => void };
  logger: { log: (msg: string) => void };
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

// 3. Define handlers
const handlers = {
  "game:start": (state, _event, _ctx) => {
    return [
      { type: "state:update", updates: { isRunning: true, tickCount: 0 } },
      { type: "log", message: "Game started" },
      {
        type: "timer:schedule",
        id: "game-tick",
        delayMs: 16,
        event: { type: "game:tick", deltaTime: 16 },
      },
    ];
  },

  "game:tick": (state, event, _ctx) => {
    if (!state.isRunning) return [];

    const nextTick = state.tickCount + 1;
    return [
      { type: "state:update", updates: { tickCount: nextTick } },
      {
        type: "transport:broadcast",
        payload: { type: "tick", count: nextTick },
      },
      {
        type: "timer:schedule",
        id: "game-tick",
        delayMs: 16,
        event: { type: "game:tick", deltaTime: event.deltaTime },
      },
    ];
  },

  "game:stop": (_state, _event, _ctx) => {
    return [
      { type: "state:update", updates: { isRunning: false } },
      { type: "log", message: "Game stopped" },
    ];
  },

  "player:action": (state, event, _ctx) => {
    const player = state.players.get(event.playerId);
    if (!player) {
      return [{ type: "log", message: `Unknown player: ${event.playerId}` }];
    }

    return [
      {
        type: "log",
        message: `Player ${player.name} performed: ${event.action}`,
      },
      {
        type: "transport:broadcast",
        payload: {
          type: "player-action",
          playerId: event.playerId,
          action: event.action,
        },
      },
    ];
  },
} satisfies EventHandlerMap<GameEvents, GameEffects, GameState, HandlerContext>;

// 4. Define executors
const executor = {
  "state:update": (effect, ctx) => {
    const currentState = ctx.setState as any; // In real code, you'd handle this properly
    // Merge updates into current state
    console.log("[Executor] State update:", effect.updates);
  },

  "timer:schedule": (effect, ctx) => {
    ctx.timers.schedule(effect.id, effect.delayMs, () => {
      ctx.dispatch(effect.event);
    });
  },

  "transport:broadcast": (effect, ctx) => {
    ctx.transports.broadcast(effect.payload);
  },

  log: (effect, ctx) => {
    ctx.logger.log(effect.message);
  },
} satisfies EffectExecutorMap<GameEffects, GameEvents, ExecutorContext>;

// 5. Define Braided resources

// Store resource
const storeResource = defineResource({
  start: () => {
    let state: GameState = {
      isRunning: false,
      tickCount: 0,
      players: new Map(),
    };

    return {
      getState: () => state,
      setState: (newState: GameState) => {
        state = newState;
      },
    };
  },
  halt: () => {
    console.log("[Store] Halting");
  },
});

// Timer resource
const timerResource = defineResource({
  start: () => {
    const timers = new Map<string, NodeJS.Timeout>();

    return {
      schedule: (id: string, delayMs: number, callback: () => void) => {
        // Clear existing timer with same id
        const existing = timers.get(id);
        if (existing) clearTimeout(existing);

        // Schedule new timer
        const timer = setTimeout(callback, delayMs);
        timers.set(id, timer);
      },
      cleanup: () => {
        timers.forEach((timer) => clearTimeout(timer));
        timers.clear();
      },
    };
  },
  halt: (timers) => {
    console.log("[Timers] Halting");
    timers.cleanup();
  },
});

// Transport resource
const transportResource = defineResource({
  start: () => {
    return {
      broadcast: (payload: unknown) => {
        console.log("[Transport] Broadcasting:", JSON.stringify(payload));
      },
    };
  },
  halt: () => {
    console.log("[Transport] Halting");
  },
});

// Game loop resource (depends on store, timers, transports)
const gameLoopResource = defineResource({
  dependencies: ["store", "timers", "transports"],
  start: ({ store, timers, transports }: any) => {
    console.log("[GameLoop] Starting");

    const loop = createEventLoop({
      getState: store.getState,
      handlers,
      executors: executor,
      handlerContext: {},
      executorContext: {
        setState: store.setState,
        timers,
        transports,
        logger: console,
      },
    });

    // Subscribe to track game events (optional - for debugging/analytics)
    const unsubscribe = loop.subscribe((event, effects) => {
      console.log(
        `[GameLoop Observer] ${event.type} → ${effects.length} effect(s)`
      );
    });

    // Return both loop and unsubscribe for cleanup
    return { loop, unsubscribe };
  },
  halt: ({ loop, unsubscribe }) => {
    console.log("[GameLoop] Halting");
    unsubscribe(); // Clean up subscription
    loop.dispose(); // Dispose event loop
  },
});

// 6. System composition (conceptual)
console.log("\n=== Braided Integration Example ===\n");
console.log(
  "This example shows how to integrate emergent with braided."
);
console.log(
  "The event loop becomes a managed resource with proper lifecycle.\n"
);

console.log("System topology:");
console.log("  store (no dependencies)");
console.log("  timers (no dependencies)");
console.log("  transports (no dependencies)");
console.log("  gameLoop (depends on: store, timers, transports)");
console.log("");

console.log("Startup order (via topological sort):");
console.log("  1. store, timers, transports (parallel)");
console.log("  2. gameLoop (after dependencies)");
console.log("");

console.log("Shutdown order (reverse):");
console.log("  1. gameLoop");
console.log("  2. store, timers, transports");
console.log("");

console.log("Benefits:");
console.log("  ✓ Deterministic startup/shutdown");
console.log("  ✓ Explicit dependencies");
console.log("  ✓ Easy to test (mock dependencies)");
console.log("  ✓ Composable system architecture");
console.log("  ✓ Event loop lifecycle managed by Braided");
console.log("");

console.log("=== Braided Integration Example Complete ===\n");
