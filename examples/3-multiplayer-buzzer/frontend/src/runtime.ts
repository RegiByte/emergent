/**
 * Multiplayer Buzzer - Game Runtime
 *
 * This is the core game logic using the Emergent pattern:
 * Event → Handler (pure) → Effects → Executor (impure)
 *
 * The runtime is:
 * - Pure (handlers are deterministic)
 * - Testable (no side effects in handlers)
 * - Replayable (effects are data)
 * - Transport-agnostic (doesn't know about WebRTC)
 */

import { createStore } from "zustand/vanilla";
import type { StoreApi } from "zustand/vanilla";
import {
  emergentSystem,
  type EventHandlerMap,
  type EffectExecutorMap,
} from "emergent";
import type {
  GameEvent,
  GameEffect,
  GameSnapshot,
  Player,
  BuzzSubmission,
} from "./types";
import { determineWinner } from "./system/clock-sync";

// ============================================
// Initial State
// ============================================

export function createInitialSnapshot(): GameSnapshot {
  return {
    phase: "lobby",
    players: new Map(),
    buzzSubmissions: [],
    winner: null,
    buzzWindowStartedAt: null,
    countdownValue: null,
  };
}

// ============================================
// Runtime Store (Zustand)
// ============================================

export type RuntimeStore = {
  snapshot: GameSnapshot;
};

export const createRuntimeStore = () =>
  createStore<RuntimeStore>()(() => ({
    snapshot: createInitialSnapshot(),
  }));

// ============================================
// Event Handlers (Pure Functions)
// ============================================

type HandlerContext = {
  // Pure utilities only
};

const handlers = {
  "game:start": (state, _event, _ctx): GameEffect[] => {
    return [
      {
        type: "state:update",
        snapshot: {
          ...state,
          phase: "countdown",
          buzzSubmissions: [],
          winner: null,
          buzzWindowStartedAt: null,
          countdownValue: 3,
        },
      },
      {
        type: "transport:broadcast",
        payload: { type: "game-started" },
      },
      // Schedule first countdown tick (1 second)
      {
        type: "timer:schedule",
        timerId: "countdown",
        delayMs: 1000,
        event: { type: "countdown:tick" },
      },
    ];
  },

  "countdown:tick": (state, _event, _ctx): GameEffect[] => {
    if (state.phase !== "countdown" || state.countdownValue === null) {
      return [];
    }

    const nextValue = state.countdownValue - 1;

    if (nextValue === 0) {
      // Countdown complete, schedule the final transition
      return [
        {
          type: "state:update",
          snapshot: {
            ...state,
            countdownValue: 0,
          },
        },
        {
          type: "timer:schedule",
          timerId: "countdown",
          delayMs: 1000,
          event: { type: "countdown:complete" },
        },
      ];
    }

    // Continue countdown
    return [
      {
        type: "state:update",
        snapshot: {
          ...state,
          countdownValue: nextValue,
        },
      },
      {
        type: "timer:schedule",
        timerId: "countdown",
        delayMs: 1000,
        event: { type: "countdown:tick" },
      },
    ];
  },

  "countdown:complete": (state, _event, _ctx): GameEffect[] => {
    return [
      {
        type: "state:update",
        snapshot: {
          ...state,
          phase: "ready",
          countdownValue: null,
          buzzWindowStartedAt: Date.now(),
        },
      },
    ];
  },

  "game:reset": (state, _event, _ctx): GameEffect[] => {
    return [
      {
        type: "state:update",
        snapshot: {
          ...state,
          phase: "lobby",
          buzzSubmissions: [],
          winner: null,
          buzzWindowStartedAt: null,
          countdownValue: null,
        },
      },
      {
        type: "transport:broadcast",
        payload: { type: "game-reset" },
      },
    ];
  },

  "player:joined": (state, event, _ctx): GameEffect[] => {
    const player: Player = {
      id: event.playerId,
      name: event.playerName,
      clockOffset: 0,
      lastSyncAt: 0,
    };

    const newPlayers = new Map(state.players);
    newPlayers.set(event.playerId, player);

    return [
      {
        type: "state:update",
        snapshot: {
          ...state,
          players: newPlayers,
        },
      },
      // Start clock sync for this player
      {
        type: "clock:sync",
        playerId: event.playerId,
      },
    ];
  },

  "player:left": (state, event, _ctx): GameEffect[] => {
    const newPlayers = new Map(state.players);
    newPlayers.delete(event.playerId);

    return [
      {
        type: "state:update",
        snapshot: {
          ...state,
          players: newPlayers,
        },
      },
    ];
  },

  "player:buzz": (state, event, _ctx): GameEffect[] => {
    // Only accept buzzes during buzzing phase
    if (state.phase !== "ready" && state.phase !== "buzzing") {
      return [];
    }

    const player = state.players.get(event.playerId);
    if (!player) {
      return [];
    }

    // Calculate compensated time (fair timing)
    const compensatedTime = event.timestamp + event.offset;

    const submission: BuzzSubmission = {
      playerId: event.playerId,
      playerName: player.name,
      localTimestamp: event.timestamp,
      offset: event.offset,
      compensatedTime,
    };

    const newSubmissions = [...state.buzzSubmissions, submission];

    // If this is the first buzz, transition to buzzing phase
    if (state.phase === "ready") {
      return [
        {
          type: "state:update",
          snapshot: {
            ...state,
            phase: "buzzing",
            buzzSubmissions: newSubmissions,
          },
        },
        {
          type: "transport:broadcast",
          payload: { type: "buzz-received", playerId: event.playerId },
        },
      ];
    }

    // Check if all players have buzzed
    const allBuzzed = newSubmissions.length === state.players.size;

    if (allBuzzed) {
      // Determine winner
      const winningSubmission = determineWinner(newSubmissions);

      if (!winningSubmission) {
        return [];
      }

      return [
        {
          type: "state:update",
          snapshot: {
            ...state,
            phase: "result",
            buzzSubmissions: newSubmissions,
            winner: {
              playerId: winningSubmission.playerId,
              playerName: winningSubmission.playerName,
            },
          },
        },
        {
          type: "transport:broadcast",
          payload: {
            type: "winner-determined",
            winnerId: winningSubmission.playerId,
            winnerName: winningSubmission.playerName,
          },
        },
      ];
    }

    return [
      {
        type: "state:update",
        snapshot: {
          ...state,
          buzzSubmissions: newSubmissions,
        },
      },
      {
        type: "transport:broadcast",
        payload: { type: "buzz-received", playerId: event.playerId },
      },
    ];
  },

  "clock:sync-request": (_state, event, _ctx): GameEffect[] => {
    return [
      {
        type: "transport:send",
        playerId: event.playerId,
        payload: {
          type: "clock-sync-ping",
          serverTime: Date.now(),
        },
      },
    ];
  },

  "clock:sync-response": (state, event, _ctx): GameEffect[] => {
    const player = state.players.get(event.playerId);
    if (!player) {
      return [];
    }

    // Update player's clock offset (calculated by player)
    const newPlayers = new Map(state.players);
    newPlayers.set(event.playerId, {
      ...player,
      lastSyncAt: Date.now(),
    });

    return [
      {
        type: "state:update",
        snapshot: {
          ...state,
          players: newPlayers,
        },
      },
    ];
  },

  "buzzer:determined": (state, event, _ctx): GameEffect[] => {
    return [
      {
        type: "state:update",
        snapshot: {
          ...state,
          phase: "result",
          winner: {
            playerId: event.winnerId,
            playerName: event.winnerName,
          },
        },
      },
    ];
  },
} satisfies EventHandlerMap<
  GameEvent,
  GameEffect,
  GameSnapshot,
  HandlerContext
>;

// ============================================
// Effect Executor Context
// ============================================

type ExecutorContext = {
  store: StoreApi<RuntimeStore>;
  // Will be provided by transport layer
  broadcastMessage?: (payload: unknown) => void;
  sendMessage?: (playerId: string, payload: unknown) => void;
  onClockSync?: (playerId: string) => void;
  // Timer management
  scheduleTimer?: (timerId: string, delayMs: number, event: GameEvent) => void;
};

// ============================================
// Effect Executor (Side Effects)
// ============================================

export const createExecutor = () =>
  ({
    "state:update": (effect, ctx) => {
      // Update the Zustand store with the new snapshot
      ctx.store.setState({ snapshot: effect.snapshot });
    },

    "transport:broadcast": (effect, ctx) => {
      ctx.broadcastMessage?.(effect.payload);
    },

    "transport:send": (effect, ctx) => {
      ctx.sendMessage?.(effect.playerId, effect.payload);
    },

    "clock:sync": (effect, ctx) => {
      ctx.onClockSync?.(effect.playerId);
    },

    "timer:schedule": (effect, ctx) => {
      ctx.scheduleTimer?.(effect.timerId, effect.delayMs, effect.event);
    },
  } satisfies EffectExecutorMap<GameEffect, GameEvent, ExecutorContext>);

// ============================================
// Create Runtime Factory
// ============================================

export type CreateGameRuntimeConfig = {
  store: StoreApi<RuntimeStore>;
  broadcastMessage?: (payload: unknown) => void;
  sendMessage?: (playerId: string, payload: unknown) => void;
  onClockSync?: (playerId: string) => void;
  scheduleTimer?: (timerId: string, delayMs: number, event: GameEvent) => void;
};

export function createGameRuntime(config: CreateGameRuntimeConfig) {
  const { store, broadcastMessage, sendMessage, onClockSync, scheduleTimer } =
    config;
  const executor = createExecutor();

  const createLoop = emergentSystem<
    GameEvent,
    GameEffect,
    GameSnapshot,
    HandlerContext,
    ExecutorContext
  >();

  const loop = createLoop({
    getState: () => store.getState().snapshot,
    handlers,
    executor,
    handlerContext: {},
    executorContext: {
      store,
      broadcastMessage,
      sendMessage,
      onClockSync,
      scheduleTimer,
    },
  });

  return {
    store,
    dispatch: loop.dispatch,
    subscribe: loop.subscribe,
    dispose: loop.dispose,
  };
}

export type GameRuntime = ReturnType<typeof createGameRuntime>;

export { handlers };
