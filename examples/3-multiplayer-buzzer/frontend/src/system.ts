/**
 * System Configuration - Braided Resources
 *
 * This defines all stateful resources for the multiplayer buzzer.
 * We have TWO separate system configs:
 * - Host system: Creates sessions, manages game state
 * - Player system: Joins sessions, observes game state
 *
 * Systems are started ON DEMAND when user chooses their role.
 */

import { defineResource, StartedResource } from "braided";
import { createSystemHooks } from "braided-react";
import { createRuntimeStore, createGameRuntime } from "./system/runtime";
import { createHostTransport } from "./transport-host";
import { createPlayerTransport } from "./transport-player";
import type { GameEvent } from "./types";

const SIGNALING_SERVER_URL = "http://localhost:8000";

// ============================================
// Timer Manager (Simple)
// ============================================
function createTimerManager() {
  const timers = new Map<string, number>();

  return {
    schedule: (timerId: string, delayMs: number, callback: () => void) => {
      // Cancel existing timer
      const existing = timers.get(timerId);
      if (existing) {
        clearTimeout(existing);
      }

      // Schedule new timer
      const timeoutId = window.setTimeout(() => {
        timers.delete(timerId);
        callback();
      }, delayMs);

      timers.set(timerId, timeoutId);
    },
    cancel: (timerId: string) => {
      const existing = timers.get(timerId);
      if (existing) {
        clearTimeout(existing);
        timers.delete(timerId);
      }
    },
    cleanup: () => {
      timers.forEach((timeoutId) => clearTimeout(timeoutId));
      timers.clear();
    },
  };
}

// ============================================
// HOST SYSTEM
// ============================================

// ============================================
// Resource Definitions
// ============================================

/**
 * Store Resource - Zustand store for game state
 */
const storeResource = defineResource({
  start: () => {
    return createRuntimeStore();
  },
  halt: () => {
    // Zustand stores don't need explicit cleanup
    console.log("[System] Store halted");
  },
});

/**
 * Runtime Resource - Emergent event loop
 * Depends on: store
 */
const runtimeResource = defineResource({
  dependencies: ["store"],
  start: ({ store }: { store: StartedResource<typeof storeResource> }) => {
    // Transport will be wired later
    let transport: any = null;

    // Create timer manager
    const timerManager = createTimerManager();

    const runtime = createGameRuntime({
      store,
      broadcastMessage: (payload) => transport?.broadcastMessage(payload),
      sendMessage: (playerId, payload) =>
        transport?.sendMessage(playerId, payload),
      onClockSync: (playerId) => transport?.onClockSync(playerId),
      scheduleTimer: (timerId: string, delayMs: number, event: GameEvent) => {
        timerManager.schedule(timerId, delayMs, () => {
          runtime.dispatch(event);
        });
      },
    });

    // Expose a way to wire the transport
    return {
      ...runtime,
      _wireTransport: (t: any) => {
        transport = t;
      },
      _timerManager: timerManager,
    };
  },
  halt: (runtime) => {
    runtime._timerManager.cleanup();
    runtime.dispose();
    console.log("[System] Runtime halted");
  },
});

/**
 * Transport Resource - WebRTC host transport
 * Depends on: runtime
 */
const transportResource = defineResource({
  dependencies: ["runtime"],
  start: async ({
    runtime,
  }: {
    runtime: StartedResource<typeof runtimeResource>;
  }) => {
    const transport = createHostTransport({
      runtime,
      signalingServerUrl: SIGNALING_SERVER_URL,
    });

    // Wire transport to runtime
    runtime._wireTransport(transport);

    // Start transport (async)
    await transport.start();

    return transport;
  },
  halt: (transport) => {
    transport.dispose();
    console.log("[System] Transport halted");
  },
});

// ============================================
// PLAYER SYSTEM
// ============================================

/**
 * Player Store Resource
 */
const playerStoreResource = defineResource({
  start: () => {
    return createRuntimeStore();
  },
  halt: () => {
    console.log("[System] Player store halted");
  },
});

/**
 * Player Runtime Resource
 * Note: Player doesn't need transport methods (receives state via transport)
 */
const playerRuntimeResource = defineResource({
  dependencies: ["store"],
  start: ({ store }: { store: StartedResource<typeof playerStoreResource> }) => {
    const runtime = createGameRuntime({
      store,
      // Player doesn't broadcast/send - only receives
      broadcastMessage: undefined,
      sendMessage: undefined,
      onClockSync: undefined,
    });

    return runtime;
  },
  halt: (runtime) => {
    runtime.dispose();
    console.log("[System] Player runtime halted");
  },
});

/**
 * Player Transport Resource
 * Requires sessionId and playerName from config
 */
const createPlayerTransportResource = (config: { sessionId: string; playerName: string }) =>
  defineResource({
    dependencies: ["runtime"],
    start: async () => {
      const transport = createPlayerTransport({
        signalingServerUrl: SIGNALING_SERVER_URL,
        sessionId: config.sessionId,
        playerName: config.playerName,
      });

      await transport.start();

      return transport;
    },
    halt: (transport) => {
      transport.dispose();
      console.log("[System] Player transport halted");
    },
  });

// ============================================
// System Configurations
// ============================================

export const hostSystemConfig = {
  store: storeResource,
  runtime: runtimeResource,
  transport: transportResource,
};

export const createPlayerSystemConfig = (config: { sessionId: string; playerName: string }) => ({
  store: playerStoreResource,
  runtime: playerRuntimeResource,
  transport: createPlayerTransportResource(config),
});

// ============================================
// Typed Hooks
// ============================================

export const { SystemBridge: HostSystemBridge, useResource: useHostResource } =
  createSystemHooks<typeof hostSystemConfig>();

// Player hooks will be created per-instance since config is dynamic
export type PlayerSystemConfig = ReturnType<typeof createPlayerSystemConfig>;
export const createPlayerHooks = (config: PlayerSystemConfig) =>
  createSystemHooks<typeof config>();

export type HostSystemResources = typeof hostSystemConfig;
export type PlayerSystemResources = PlayerSystemConfig;
