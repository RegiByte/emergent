/**
 * WebSocket Chat - System
 *
 * Wires together the runtime and transport using Braided resources.
 * This is where the Z-axis (closure space) comes alive!
 */

import { defineResource, StartedResource, StartedSystem } from "braided";
import {
  createRuntimeStore,
  createChatRuntime,
  type RuntimeStore,
} from "./runtime";
import { createChatTransport, type ChatTransport } from "./transport";
import type { StoreApi } from "zustand/vanilla";
import { createSystemHooks, createSystemManager } from "braided-react";

// ============================================
// Runtime Store Resource
// ============================================

export const runtimeStoreResource = defineResource({
  start: () => {
    const store = createRuntimeStore();
    console.log("[system] Runtime store created");
    return store;
  },
  halt: () => {
    console.log("[system] Runtime store halted");
  },
});

// ============================================
// Chat Runtime Resource
// ============================================

export const chatRuntimeResource = defineResource({
  dependencies: ["runtimeStore"],
  start: ({ runtimeStore }: { runtimeStore: StoreApi<RuntimeStore> }) => {
    // Transport send function (will be wired after transport is created)
    let transportSend: ((event: string, payload: unknown) => void) | null =
      null;

    const runtime = createChatRuntime({
      store: runtimeStore,
      sendToTransport: (event, payload) => {
        if (transportSend) {
          transportSend(event, payload);
        } else {
          console.warn("[system] Transport not ready, cannot send:", event);
        }
      },
    });

    console.log("[system] Chat runtime created");

    return {
      runtime,
      setTransportSend: (fn: (event: string, payload: unknown) => void) => {
        transportSend = fn;
      },
    };
  },
  halt: () => {
    console.log("[system] Chat runtime halted");
  },
});

// ============================================
// Transport Resource
// ============================================

export const transportResource = defineResource({
  dependencies: ["runtimeStore", "chatRuntime"],
  start: ({
    runtimeStore,
    chatRuntime,
  }: {
    runtimeStore: StartedResource<typeof runtimeStoreResource>;
    chatRuntime: StartedResource<typeof chatRuntimeResource>;
  }) => {
    const transport = createChatTransport({
      runtime: chatRuntime.runtime,
      onConnectionChange: (connected) => {
        const currentState = runtimeStore.getState().state;
        runtimeStore.setState({
          state: {
            ...currentState,
            connected,
          },
        });
      },
    });

    // Wire transport send back to runtime
    chatRuntime.setTransportSend(transport.send);

    // Auto-connect
    transport.connect();

    console.log("[system] Transport created and connected");

    return transport;
  },
  halt: (transport: ChatTransport) => {
    transport.disconnect();
    console.log("[system] Transport disconnected");
  },
});

// ============================================
// System Configuration
// ============================================

export const chatSystemConfig = {
  runtimeStore: runtimeStoreResource,
  chatRuntime: chatRuntimeResource,
  transport: transportResource,
};

export type ChatSystem = StartedSystem<typeof chatSystemConfig>;

export const { SystemBridge, useResource, useSystem } =
  createSystemHooks<typeof chatSystemConfig>();

export const chatSystemSingleton = createSystemManager(chatSystemConfig);
