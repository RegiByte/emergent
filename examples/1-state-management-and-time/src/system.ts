import { defineResource, type StartedResource } from "braided";
import { createSystemHooks, createSystemManager } from "braided-react";
import {
  emergentSystem,
  type EffectExecutorMap,
  type EventHandlerMap,
} from "emergent";
import { useEffect, useState } from "react";
import { createStore } from "zustand";

type Timer = {
  startedAt: number;
  delayMs: number;
  id: string;
  taskId: number; // a timeout id
};
interface TimerManager {
  schedule: (id: string, delayMs: number, callback: () => void) => void;
  cancel: (id: string) => void;
  cleanup: () => void;
  exists: (id: string) => boolean;
  list: () => Timer[];
  useTickingClock: (paused: boolean, intervalMs: number) => number;
  useRemainingTime: (id: string, updateIntervalMs?: number) => number | null;
}

const timerResource = defineResource({
  start: () => {
    const timers = new Map<string, Timer>();
    const manager = {
      schedule: (id: string, delayMs: number, callback: () => void) => {
        if (timers.has(id)) {
          // cleanup existing timer to prevent duplicate scheduling
          // one timer per id at a time.
          clearTimeout(timers.get(id)?.taskId);
          timers.delete(id);
        }
        const taskId = setTimeout(callback, delayMs);
        timers.set(id, { startedAt: Date.now(), delayMs, id, taskId: taskId });
      },
      cancel: (id: string) => {
        const timer = timers.get(id);
        if (timer) {
          clearTimeout(timer.taskId);
          timers.delete(id);
        }
      },
      cleanup: () => {
        timers.forEach((timer) => clearTimeout(timer.taskId));
        timers.clear();
      },
      exists: (id: string) => {
        return timers.has(id);
      },
      list: () => Array.from(timers.values()),

      // React hook to create a ticking clock integrated to this manager
      useTickingClock: (
        paused: boolean,
        intervalMs: number,
        maxTick = 1000
      ) => {
        const [tick, setTick] = useState(0);

        useEffect(() => {
          if (paused) return;
          const interval = setInterval(() => {
            setTick((tick) => (tick > maxTick ? 0 : tick + 1));
          }, intervalMs);
          return () => clearInterval(interval);
        }, [intervalMs, paused, maxTick]);

        return tick;
      },

      // React hook to observe remaining time for a specific timer
      // This crosses the closure boundary - React observing the living system!
      useRemainingTime: (id: string, updateIntervalMs = 100) => {
        const [remainingMs, setRemainingMs] = useState<number | null>(null);

        useEffect(() => {
          const updateRemaining = () => {
            const timer = timers.get(id);
            // where does this timers comes from?
            // it comes from the resource manager, which exists in the scope of the system
            // react is observing it, from outside.
            if (!timer) {
              setRemainingMs(null);
              return;
            }

            const elapsed = Date.now() - timer.startedAt;
            const remaining = Math.max(0, timer.delayMs - elapsed);
            setRemainingMs(remaining);
          };

          // Initial update
          updateRemaining();

          // Update on interval
          const interval = setInterval(updateRemaining, updateIntervalMs);

          return () => clearInterval(interval);
        }, [id, updateIntervalMs]);

        return remainingMs;
      },
    } as const satisfies TimerManager;
    return manager;
  },
  halt: (timerManager) => {
    timerManager.cleanup();
  },
});

interface AppState {
  currentState: "idle" | "running" | "paused" | "stopped";
  count: number;
  messages: string[];
  startedAt: number | null;
  eventLog: Array<{
    timestamp: number;
    event: AppEvents;
    effects: AppEffects[];
  }>;
  trafficLight: {
    currentColor: "red" | "yellow" | "green" | "off";
  };
}

const storeResource = defineResource({
  // dependencies: [] // store doesn't depend on anything
  start: () => {
    const store = createStore<AppState>(() => ({
      currentState: "idle",
      count: 0,
      messages: [],
      startedAt: null,
      eventLog: [] as AppState["eventLog"],
      trafficLight: {
        currentColor: "off",
      },
    }));
    return store;
  },
  halt: (_store) => {
    // no need to do anything, store lives in memory only
  },
});

const loggerResource = defineResource({
  start: () => {
    return {
      log: (...parts: unknown[]) => console.log(...parts),
      warn: (...parts: unknown[]) => console.warn(...parts),
      error: (...parts: unknown[]) => console.error(...parts),
      info: (...parts: unknown[]) => console.info(...parts),
    };
  },
  halt: (_logger) => {
    // no need to do anything, logger lives in memory only
  },
});

// Domain types, user land defined, not library defined

// Events - What can happen (causes)
type AppEvents =
  | { type: "app:start" }
  | { type: "app:pause" }
  | { type: "app:resume" }
  | { type: "app:stop" }
  | { type: "app:tick" }
  | { type: "message:add"; message: string }
  | { type: "message:schedule"; message: string; afterMs?: number }
  | { type: "traffic:start" }
  | { type: "traffic:stop" }
  | { type: "traffic:transition" };
type AppEventType = AppEvents["type"];

// Effects - What to do (consequences)
type AppEffects =
  | { type: "state:update"; updates: Partial<AppState> }
  | { type: "log"; level?: "info" | "warn" | "error"; message: string }
  | { type: "timer:schedule"; id: string; delayMs: number; onExpire: AppEvents }
  | { type: "timer:cancel"; id: string }
  | { type: "timer:cancelAll" };

type AppEffectType = AppEffects["type"];

// Context - Pure utilities and domain data
type HandlerContext = {
  getNow: () => number; // get the current time in milliseconds
};

// Context - Side effect utilities and resources
type ExecutorContext = {
  logger: {
    log: (...parts: unknown[]) => void;
    warn: (...parts: unknown[]) => void;
    error: (...parts: unknown[]) => void;
    info: (...parts: unknown[]) => void;
  };
  timer: StartedResource<typeof timerResource>;
  store: StartedResource<typeof storeResource>;
};

const createEventLoop = emergentSystem<
  AppEvents,
  AppEffects,
  AppState,
  HandlerContext,
  ExecutorContext
>();

const runtimeResource = defineResource({
  dependencies: ["store", "timer", "eventHandlers", "executors", "logger"],
  start: ({
    store,
    timer,
    eventHandlers,
    executors,
    logger,
  }: {
    store: StartedResource<typeof storeResource>;
    timer: StartedResource<typeof timerResource>;
    eventHandlers: EventHandlerMap<
      AppEvents,
      AppEffects,
      AppState,
      HandlerContext
    >;
    executors: EffectExecutorMap<AppEffects, AppEvents, ExecutorContext>;
    logger: StartedResource<typeof loggerResource>;
  }) => {
    const loop = createEventLoop({
      getState: () => store.getState(),
      handlers: eventHandlers,
      executor: executors,
      handlerContext: {
        getNow: () => Date.now(),
      },
      executorContext: {
        timer,
        store,
        logger,
      },
    });

    return loop;
  },
  halt: (eventLoop) => {
    eventLoop.dispose();
  },
});

const eventHandlers = {
  "app:start": (state, _event, context) => {
    if (state.currentState === "running") {
      // already running, do nothing
      return [];
    }
    const now = context.getNow();
    const effects = [
      {
        type: "state:update" as const,
        updates: {
          currentState: "running" as const,
          startedAt: state.startedAt ?? now,
        },
      },
      {
        type: "timer:schedule" as const,
        id: "app-tick",
        delayMs: 1000,
        onExpire: { type: "app:tick" as const },
      },
      {
        type: "log" as const,
        message: "System started",
      },
    ];
    return effects;
  },
  "app:pause": (state, _event, _context) => {
    if (state.currentState !== "running") {
      // not running, nothing to pause
      return [];
    }
    const effects = [
      {
        type: "state:update" as const,
        updates: { currentState: "paused" as const },
      },
      {
        type: "timer:cancelAll" as const,
      },
      {
        type: "log" as const,
        message: "System paused",
      },
    ];
    return effects;
  },
  "app:resume": (state, _event, _context) => {
    if (state.currentState !== "paused") {
      // not paused, nothing to resume
      return [];
    }
    const effects = [
      {
        type: "state:update" as const,
        updates: { currentState: "running" as const },
      },
      {
        type: "timer:schedule" as const,
        id: "app-tick",
        delayMs: 1000,
        onExpire: { type: "app:tick" as const },
      },
      {
        type: "log" as const,
        message: "System resumed",
      },
    ];
    return effects;
  },
  "app:stop": (_state, _event, _context) => {
    const effects = [
      {
        type: "state:update" as const,
        updates: {
          currentState: "stopped" as const,
          startedAt: null, // Reset startedAt on stop
          count: 0, // Reset count on stop
        },
      },
      {
        type: "timer:cancelAll" as const,
      },
      {
        type: "log" as const,
        message: "System stopped and reset",
      },
    ];
    return effects;
  },
  "app:tick": (state, _event, _context) => {
    if (state.currentState !== "running") {
      // not running, do nothing
      // this stops stray events from being processed when the system is not running
      // for example when you set a timer and forget to cancel it :D

      // emerge property: do not tick when the system is not running, simple
      return [];
    }
    const effects = [
      {
        type: "state:update" as const,
        updates: { count: state.count + 1 },
      },
      {
        type: "timer:schedule" as const,
        id: "app-tick",
        delayMs: 1000,
        onExpire: { type: "app:tick" as const },
      },
      {
        type: "log" as const,
        message: `Tick ${state.count + 1}`,
      },
    ];
    return effects;
  },
  "message:add": (state, event, _context) => {
    const timestamp = new Date().toLocaleTimeString();
    const formattedMessage = `[${timestamp}] ${event.message}`;

    return [
      {
        type: "state:update" as const,
        updates: { messages: [...state.messages, formattedMessage] },
      },
      {
        type: "log" as const,
        message: `Message added: ${event.message}`,
      },
    ];
  },
  "message:schedule": (_state, event, context) => {
    return [
      {
        type: "timer:schedule" as const,
        id: `message-${context.getNow()}`,
        delayMs: event.afterMs ?? 3000, // default to 3 seconds
        onExpire: { type: "message:add" as const, message: event.message },
      },
      {
        type: "log" as const,
        message: `Message scheduled: ${event.message}`,
      },
    ];
  },
  "traffic:start": (state, _event, _context) => {
    if (state.trafficLight.currentColor !== "off") {
      // already running
      return [];
    }

    const startColor = "red";
    const duration = 5000; // red light duration

    return [
      {
        type: "state:update" as const,
        updates: {
          trafficLight: {
            currentColor: startColor,
          },
        },
      },
      {
        type: "timer:schedule" as const,
        id: "traffic-light",
        delayMs: duration,
        onExpire: { type: "traffic:transition" as const },
      },
      {
        type: "log" as const,
        message: `🚦 Traffic light started: ${startColor}`,
      },
    ];
  },
  "traffic:transition": (state, _event, _context) => {
    const currentColor = state.trafficLight.currentColor;
    if (currentColor === "off") {
      // not running
      return [];
    }

    // Define the sequence and durations
    const sequence: Record<
      "red" | "yellow" | "green",
      { next: "red" | "yellow" | "green"; duration: number }
    > = {
      red: { next: "green", duration: 3000 }, // green light duration
      green: { next: "yellow", duration: 2000 }, // yellow light duration
      yellow: { next: "red", duration: 5000 }, // red light duration
    };

    const nextState = sequence[currentColor];
    if (!nextState) {
      return [];
    }

    return [
      {
        type: "state:update" as const,
        updates: {
          trafficLight: {
            currentColor: nextState.next,
          },
        },
      },
      {
        type: "timer:schedule" as const,
        id: "traffic-light",
        delayMs: nextState.duration,
        onExpire: { type: "traffic:transition" as const },
      },
      {
        type: "log" as const,
        message: `🚦 Light changed: ${currentColor} → ${nextState.next}`,
      },
    ];
  },
  "traffic:stop": (_state, _event, _context) => {
    return [
      {
        type: "state:update" as const,
        updates: {
          trafficLight: {
            currentColor: "off",
          },
        },
      },
      {
        type: "timer:cancel" as const,
        id: "traffic-light",
      },
      {
        type: "log" as const,
        message: "🚦 Traffic light stopped",
      },
    ];
  },
} as const satisfies EventHandlerMap<
  AppEvents,
  AppEffects,
  AppState,
  HandlerContext
>;

const eventHandlersResource = defineResource({
  start: () => eventHandlers,
  halt: (_eventHandlers) => {
    // no need to do anything, event handlers live in memory only
  },
});

const executors = {
  "state:update": (effect, context) => {
    context.store.setState(effect.updates);
  },
  "timer:schedule": (effect, context) => {
    context.timer.schedule(effect.id, effect.delayMs, () => {
      context.dispatch(effect.onExpire);
    });
  },
  "timer:cancel": (effect, context) => {
    context.timer.cancel(effect.id);
  },
  log: (effect, context) => {
    const level = effect.level ?? "info";
    const handler = context.logger[level as keyof typeof context.logger];
    if (handler) {
      handler(effect.message);
    } else {
      console.error(`Unknown log level: ${level}`);
    }
  },
  "timer:cancelAll": (_effect, context) => {
    context.timer.cleanup();
  },
} as const satisfies EffectExecutorMap<AppEffects, AppEvents, ExecutorContext>;

const executorsResource = defineResource({
  start: () => executors,
  halt: (_executors) => {
    // no need to do anything, executors live in memory only
  },
});

// This resource just observes the runtime and logs the events and effects to the store
// This bypasses the event loop and directly updates the store
// It shows that the runtime can be observed directly, and the store is not owned by it
const runtimeObserver = defineResource({
  dependencies: ["runtime", "store"],
  start: ({
    runtime,
    store,
  }: {
    runtime: StartedResource<typeof runtimeResource>;
    store: StartedResource<typeof storeResource>;
  }) => {
    // Subscribe to log all events and effects with full payloads
    const unsubscribe = runtime.subscribe((event, effects) => {
      const currentLog = store.getState().eventLog;
      const newEntry = {
        timestamp: Date.now(),
        event: event,
        effects: effects,
      };
      // Keep only last 50 entries (increased for better analysis)
      const updatedLog = [...currentLog, newEntry].slice(-50);
      store.setState({ eventLog: updatedLog });
    });

    return { unsubscribe, store };
  },
  halt: ({ unsubscribe, store }) => {
    unsubscribe(); // cleanup listener
    store.setState({ eventLog: [] }); // clear log on system halt
  },
});

export const systemConfig = {
  runtime: runtimeResource,
  store: storeResource,
  logger: loggerResource,
  timer: timerResource,
  eventHandlers: eventHandlersResource,
  executors: executorsResource,
  runtimeObserver: runtimeObserver,
};

export const systemManager = createSystemManager(systemConfig);

export const { SystemBridge, useResource, useSystem } =
  createSystemHooks<typeof systemConfig>();
