/**
 * WebSocket Chat - Runtime
 *
 * This is the core chat logic using the Emergent pattern:
 * Event → Handler (pure) → Effects → Executor (impure)
 *
 * The runtime is:
 * - Pure (handlers are deterministic)
 * - Testable (no side effects in handlers)
 * - Transport-agnostic (doesn't know about Socket.IO)
 */

import { createStore } from "zustand/vanilla";
import type { StoreApi } from "zustand/vanilla";
import {
  emergentSystem,
  type EventHandlerMap,
  type EffectExecutorMap,
} from "emergent";
import type { ChatEvent, ChatEffect, ChatState, Message, User } from "../types";

// ============================================
// Initial State
// ============================================

export function createInitialState(): ChatState {
  return {
    roomId: null,
    userId: null,
    users: [],
    messages: [],
    typingUsers: new Set(),
    connected: false,
  };
}

// ============================================
// Runtime Store (Zustand)
// ============================================

export type RuntimeStore = {
  state: ChatState;
};

export const createRuntimeStore = () =>
  createStore<RuntimeStore>()(() => ({
    state: createInitialState(),
  }));

// ============================================
// Event Handlers (Pure Functions)
// ============================================

type HandlerContext = {
  // Pure utilities only
};

const handlers = {
  "user:joined": (state, event, _ctx): ChatEffect[] => {
    // Check if user already exists
    const existingUser = state.users.find((u) => u.id === event.userId);
    if (existingUser) {
      return []; // User already in list
    }

    const newUser: User = {
      id: event.userId,
      name: event.userName,
      joinedAt: event.joinedAt,
    };

    return [
      {
        type: "state:update",
        state: {
          users: [...state.users, newUser],
        },
      },
    ];
  },

  "user:left": (state, event, _ctx): ChatEffect[] => {
    return [
      {
        type: "state:update",
        state: {
          users: state.users.filter((u) => u.id !== event.userId),
          typingUsers: new Set(
            Array.from(state.typingUsers).filter((id) => id !== event.userId)
          ),
        },
      },
    ];
  },

  "message:send": (state, event, _ctx): ChatEffect[] => {
    if (!event.content.trim()) {
      return []; // Ignore empty messages
    }

    return [
      {
        type: "transport:send",
        event: "message:send",
        payload: { content: event.content },
      },
    ];
  },

  "message:received": (state, event, _ctx): ChatEffect[] => {
    return [
      {
        type: "state:update",
        state: {
          messages: [...state.messages, event.message],
        },
      },
    ];
  },

  "message:react": (state, event, _ctx): ChatEffect[] => {
    return [
      {
        type: "transport:send",
        event: "message:react",
        payload: {
          messageId: event.messageId,
          emoji: event.emoji,
        },
      },
    ];
  },

  "message:reaction-updated": (state, event, _ctx): ChatEffect[] => {
    const updatedMessages = state.messages.map((msg) => {
      if (msg.id !== event.messageId) return msg;

      const reactions = { ...msg.reactions };

      // Toggle reaction
      if (!reactions[event.emoji]) {
        reactions[event.emoji] = [event.userId];
      } else {
        const index = reactions[event.emoji].indexOf(event.userId);
        if (index === -1) {
          reactions[event.emoji] = [...reactions[event.emoji], event.userId];
        } else {
          reactions[event.emoji] = reactions[event.emoji].filter(
            (id) => id !== event.userId
          );
          if (reactions[event.emoji].length === 0) {
            delete reactions[event.emoji];
          }
        }
      }

      return { ...msg, reactions };
    });

    return [
      {
        type: "state:update",
        state: {
          messages: updatedMessages,
        },
      },
    ];
  },

  "typing:start": (state, _event, _ctx): ChatEffect[] => {
    return [
      {
        type: "transport:send",
        event: "typing:start",
        payload: {},
      },
    ];
  },

  "typing:stop": (state, _event, _ctx): ChatEffect[] => {
    return [
      {
        type: "transport:send",
        event: "typing:stop",
        payload: {},
      },
    ];
  },

  "typing:user-started": (state, event, _ctx): ChatEffect[] => {
    const newTypingUsers = new Set(state.typingUsers);
    newTypingUsers.add(event.userId);

    return [
      {
        type: "state:update",
        state: {
          typingUsers: newTypingUsers,
        },
      },
    ];
  },

  "typing:user-stopped": (state, event, _ctx): ChatEffect[] => {
    const newTypingUsers = new Set(state.typingUsers);
    newTypingUsers.delete(event.userId);

    return [
      {
        type: "state:update",
        state: {
          typingUsers: newTypingUsers,
        },
      },
    ];
  },
} satisfies EventHandlerMap<ChatEvent, ChatEffect, ChatState, HandlerContext>;

// ============================================
// Effect Executors (Side Effects)
// ============================================

type ExecutorContext = {
  store: StoreApi<RuntimeStore>;
  sendToTransport: (event: string, payload: unknown) => void;
  dispatch: (event: ChatEvent) => void;
};

const executors = {
  "state:update": (effect, ctx) => {
    const currentState = ctx.store.getState().state;
    ctx.store.setState({
      state: {
        ...currentState,
        ...effect.state,
      },
    });
  },

  "transport:send": (effect, ctx) => {
    ctx.sendToTransport(effect.event, effect.payload);
  },
} satisfies EffectExecutorMap<ChatEffect, ChatEvent, ExecutorContext>;

// ============================================
// Runtime Factory
// ============================================

export type ChatRuntime = ReturnType<typeof createChatRuntime>;

export function createChatRuntime(config: {
  store: StoreApi<RuntimeStore>;
  sendToTransport: (event: string, payload: unknown) => void;
}) {
  const createChatLoop = emergentSystem<
    ChatEvent,
    ChatEffect,
    ChatState,
    HandlerContext,
    ExecutorContext
  >();

  const runtime = createChatLoop({
    getState: () => config.store.getState().state,
    handlers,
    executor: executors,
    handlerContext: {},
    executorContext: {
      store: config.store,
      sendToTransport: config.sendToTransport,
      dispatch: () => {
        throw new Error("dispatch not initialized");
      },
    },
  });

  return runtime;
}
