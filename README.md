# Emergent

> **Complex behavior from simple rules.**

A minimal, type-safe library for event-driven systems where sophisticated patterns emerge naturally from simple handlers. No central controller, no framework overhead — just pure functions and clear data flow.

## Core Concepts

Emergent builds on four simple concepts:

1. **Event** - Discriminated union describing what happened (the cause)
2. **Handler** - Pure function that transforms events into effects (the rule)
3. **Effect** - Discriminated union describing what to do (the consequence)
4. **Executor** - Function that performs side effects (the action)

The flow is straightforward:

```
Event (what happened) → Handler (pure rule) → Effects (what to do) → Executor (side effects)
```

Complex patterns emerge from these simple interactions without central coordination.

## Installation

```bash
npm install emergent
```

## Quick Start

```typescript
import { emergentSystem, EventHandlerMap, EffectExecutorMap } from "emergent";

// 1. Define domain types
type CounterEvents =
  | { type: "increment" }
  | { type: "decrement" }
  | { type: "reset" };

type CounterEffects =
  | { type: "state:update"; count: number }
  | { type: "log"; message: string };

type CounterState = { count: number };

type HandlerContext = {
  // Pure utilities and domain data only
};

type ExecutorContext = {
  setState: (state: CounterState) => void;
  logger: { log: (msg: string) => void };
};

// 2. Create your emergent system
const createEventLoop = emergentSystem<
  CounterEvents,
  CounterEffects,
  CounterState,
  HandlerContext,
  ExecutorContext
>();

// 3. Define handlers (pure functions)
const handlers = {
  increment: (state, _event, _ctx) => {
    const nextCount = state.count + 1;
    return [
      { type: "state:update", count: nextCount },
      { type: "log", message: `Incremented to ${nextCount}` },
    ];
  },

  decrement: (state, _event, _ctx) => {
    const nextCount = state.count - 1;
    return [
      { type: "state:update", count: nextCount },
      { type: "log", message: `Decremented to ${nextCount}` },
    ];
  },

  reset: (_state, _event, _ctx) => {
    return [
      { type: "state:update", count: 0 },
      { type: "log", message: "Counter reset" },
    ];
  },
} satisfies EventHandlerMap<
  CounterEvents,
  CounterEffects,
  CounterState,
  HandlerContext
>;

// 4. Define executors (side effects)
const executors = {
  "state:update": (effect, ctx) => {
    ctx.setState({ count: effect.count });
  },

  log: (effect, ctx) => {
    ctx.logger.log(effect.message);
  },
} satisfies EffectExecutorMap<CounterEffects, CounterEvents, ExecutorContext>;

// 5. Create the loop
let currentState: CounterState = { count: 0 };

const loop = createEventLoop({
  getState: () => currentState,
  handlers,
  executors,
  handlerContext: {},
  executorContext: {
    setState: (state) => {
      currentState = state;
    },
    logger: console,
  },
});

// 6. Use it
loop.dispatch({ type: "increment" });
// Logs: "Incremented to 1"
// currentState.count === 1

loop.dispatch({ type: "reset" });
// Logs: "Counter reset"
// currentState.count === 0

loop.dispose();
```

## Design Principles

1. **No Central Controller** - Events flow through handlers without framework orchestration or global state coordination.

2. **Simple Rules Compose** - Handlers are pure functions, effects are data, executors perform side effects.

3. **Emergence is Reliable** - Complex patterns arise predictably from simple interactions, making them testable and debuggable.

4. **Data Over Code** - Events and effects are discriminated unions. Every transformation is inspectable data.

5. **Causality is Explicit** - Every effect has a clear cause, every event produces observable effects. The chain is traceable.

6. **User-Defined Patterns** - The library provides the mechanism. You define what emerges.

## Why Emergent?

### Testability

Handlers are pure functions that require no mocking:

```typescript
test("increment handler", () => {
  const state = { count: 0 };
  const event = { type: "increment" };
  const ctx = { getState: () => state };

  const effects = handlers.increment(state, event, ctx);

  expect(effects).toEqual([
    { type: "state:update", count: 1 },
    { type: "log", message: "Incremented to 1" },
  ]);
});
```

### Type Safety

TypeScript provides full inference with exhaustiveness checking:

```typescript
const createEventLoop = emergentSystem<Events, Effects, State, HCtx, ECtx>();

// Use satisfies for type checking without losing inference
const handlers = {
  increment: (state, event, ctx) => {
    // TypeScript knows all types and ensures all events are handled
    return [{ type: "state:update", count: state.count + 1 }];
  },
  // TypeScript error if you forget any event types
} satisfies EventHandlerMap<Events, Effects, State, HCtx>;
```

### Helper Types

The library exports helper types for better developer experience:

```typescript
import { EventHandlerMap, EffectExecutorMap } from "emergent";

// Derive handler map type
type Handlers = EventHandlerMap<MyEvents, MyEffects, MyState, HCtx>;

// Derive executor map type (dispatch is automatically included)
type Executors = EffectExecutorMap<MyEffects, MyEvents, ECtx>;

// Use Partial for modular/plugin systems
type PartialHandlers = Partial<Handlers>;
type PartialExecutors = Partial<Executors>;
```

**Note:** `EffectExecutorMap` automatically includes `dispatch` in your executor context, allowing you to dispatch new events from executors. For cases where dispatch is not needed, use `EffectExecutorMapBase`.

### Composability

Works with any state management solution:

```typescript
// With Zustand
handlerContext: {
  getState: store.getState;
}

// With plain objects
let state = { count: 0 };
handlerContext: {
  getState: () => state;
}

// With Redux
handlerContext: {
  getState: reduxStore.getState;
}
```

### Integration with Braided

Emergent event loops work perfectly as Braided resources:

```typescript
import { defineResource } from "braided";
import { emergentSystem } from "emergent";

const gameLoopResource = defineResource({
  dependencies: ["store", "transports", "timers"],
  start: ({ store, transports, timers }) => {
    const createEventLoop = emergentSystem<
      GameEvents,
      GameEffects,
      GameState,
      HandlerContext,
      ExecutorContext
    >();

    return createEventLoop({
      getState: store.getState,
      handlers,
      executor,
      handlerContext: {},
      executorContext: {
        setState: store.setState,
        transports,
        timers,
        // Note: dispatch is automatically injected by the library
        // You don't need to provide it in executorContext
      },
    });
  },
  halt: (loop) => loop.dispose(),
});
```

**Integration notes:**

- `dispatch` is automatically injected into the executor context
- `getState` is a formal parameter, not part of handlerContext
- Provide your own domain utilities and resources in the contexts

## Testing

Emergent provides multiple strategies for testing your event-driven logic, from testing pure handlers in isolation to testing complete event flows with side effects.

### Testing Pure Handlers (Unit Tests)

Handlers are pure functions that can be tested directly without any framework setup:

```typescript
import { test, expect } from "vitest";

test("increment handler computes correct effects", () => {
  const state = { count: 5 };
  const event = { type: "increment" as const };
  const ctx = {};

  const effects = handlers.increment(state, event, ctx);

  expect(effects).toEqual([
    { type: "state:update", count: 6 },
    { type: "log", message: "Incremented to 6" },
  ]);
});

test("decrement below zero shows warning", () => {
  const state = { count: 0 };
  const event = { type: "decrement" as const };
  const ctx = {};

  const effects = handlers.decrement(state, event, ctx);

  expect(effects).toContainEqual({ type: "warning", message: "Count is at minimum" });
});
```

### Testing with handleEvent (Integration Tests)

Use `handleEvent` to test the event loop's handler resolution without executing side effects:

```typescript
test("event loop routes increment to correct handler", () => {
  const loop = createEventLoop({ /* config */ });

  const effects = loop.handleEvent({ type: "increment" });

  expect(effects).toEqual([
    { type: "state:update", count: 1 },
    { type: "log", message: "Incremented to 1" },
  ]);
});

test("unknown event produces no effects", () => {
  const loop = createEventLoop({
    /* config */
    onHandlerNotFound: vi.fn(),
  });

  const effects = loop.handleEvent({ type: "unknown" } as any);

  expect(effects).toEqual([]);
});
```

### Testing with executeEffects (Side Effect Tests)

Use `executeEffects` to test that effects execute correctly:

```typescript
test("executeEffects runs all executors", async () => {
  const setState = vi.fn();
  const logger = vi.fn();

  const loop = createEventLoop({
    getState: () => ({ count: 0 }),
    handlers,
    executors: {
      "state:update": (effect, ctx) => ctx.setState({ count: effect.count }),
      log: (effect, ctx) => ctx.logger(effect.message),
    },
    handlerContext: {},
    executorContext: { setState, logger },
  });

  const effects = [
    { type: "state:update" as const, count: 5 },
    { type: "log" as const, message: "Updated" },
  ];

  await loop.executeEffects(effects, { type: "test" as const });

  expect(setState).toHaveBeenCalledWith({ count: 5 });
  expect(logger).toHaveBeenCalledWith("Updated");
});

test("executeEffects handles async executors", async () => {
  const apiCall = vi.fn().mockResolvedValue({ success: true });

  const loop = createEventLoop({
    getState: () => ({}),
    handlers: {},
    executors: {
      "api:call": async (effect, ctx) => {
        await ctx.apiCall(effect.url);
      },
    },
    handlerContext: {},
    executorContext: { apiCall },
  });

  const effects = [{ type: "api:call" as const, url: "/api/data" }];

  await loop.executeEffects(effects, { type: "trigger" as const });

  expect(apiCall).toHaveBeenCalledWith("/api/data");
});
```

### Testing Complete Event Flows (End-to-End)

Combine `handleEvent` and `executeEffects` for complete control in tests:

```typescript
test("increment event updates state correctly", async () => {
  let state = { count: 0 };

  const loop = createEventLoop({
    getState: () => state,
    handlers,
    executors: {
      "state:update": (effect) => {
        state = { count: effect.count };
      },
      log: () => {},
    },
    handlerContext: {},
    executorContext: {},
  });

  // Phase 1: Compute effects
  const effects = loop.handleEvent({ type: "increment" });
  expect(effects).toHaveLength(2);

  // Phase 2: Execute effects
  await loop.executeEffects(effects, { type: "increment" });

  // Phase 3: Verify final state
  expect(state.count).toBe(1);
});
```

### Testing Error Handling

Test that your error handlers work correctly:

```typescript
test("executor errors are caught and handled", async () => {
  const errorHandler = vi.fn();

  const loop = createEventLoop({
    getState: () => ({}),
    handlers: { test: () => [{ type: "failing" }] },
    executors: {
      failing: () => {
        throw new Error("Executor failed");
      },
    },
    handlerContext: {},
    executorContext: {},
    onExecutorError: errorHandler,
  });

  const effects = loop.handleEvent({ type: "test" });
  await loop.executeEffects(effects, { type: "test" });

  expect(errorHandler).toHaveBeenCalledWith(
    expect.any(Error),
    { type: "failing" },
    { type: "test" }
  );
});
```

### Testing with dispatch (Production Behavior)

Use `dispatch` when you want to test the complete fire-and-forget behavior:

```typescript
test("dispatch triggers full event flow", async () => {
  const setState = vi.fn();

  const loop = createEventLoop({
    getState: () => ({ count: 0 }),
    handlers,
    executors: {
      "state:update": (effect, ctx) => ctx.setState({ count: effect.count }),
      log: () => {},
    },
    handlerContext: {},
    executorContext: { setState },
  });

  loop.dispatch({ type: "increment" });

  // Wait for async effects to complete
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(setState).toHaveBeenCalledWith({ count: 1 });
});
```

### Testing Recommendations

**For unit tests:**
- Test handlers directly as pure functions
- No event loop needed, just call `handlers.eventType(state, event, ctx)`

**For integration tests:**
- Use `handleEvent` to test handler resolution and effect computation
- No side effects executed, fast and deterministic

**For side effect tests:**
- Use `handleEvent` + `await executeEffects` for full control
- Can verify side effects complete before assertions

**For end-to-end tests:**
- Use `dispatch` for production-like behavior
- Remember to wait for async effects if needed

## Observability with Subscriptions

The subscription system allows external observers to track event loop behavior without interference. Use cases include:

- **DevTools integration** - Build Redux DevTools-style debugging
- **Logging and auditing** - Track all events and effects
- **Analytics** - Measure event patterns and frequencies
- **Testing** - Assert on event/effect sequences
- **Debugging** - Observe flow without modifying code

### Basic Usage

```typescript
const loop = createEventLoop({
  /* ... */
});

// Subscribe to all events and their effects
const unsubscribe = loop.subscribe((event, effects) => {
  console.log("Event:", event.type);
  console.log(
    "Effects:",
    effects.map((e) => e.type)
  );
});

loop.dispatch({ type: "increment" });
// Logs:
// Event: increment
// Effects: ['state:update', 'log']

// Cleanup when done
unsubscribe();
```

### Multiple Listeners

You can have multiple listeners observing the same event loop:

```typescript
// DevTools listener
const devToolsUnsub = loop.subscribe((event, effects) => {
  window.__DEVTOOLS__?.track(event, effects);
});

// Analytics listener
const analyticsUnsub = loop.subscribe((event, effects) => {
  analytics.track("event_dispatched", {
    eventType: event.type,
    effectCount: effects.length,
  });
});

// Audit log listener
const auditUnsub = loop.subscribe((event, effects) => {
  auditLog.append({
    timestamp: Date.now(),
    event,
    effects,
  });
});
```

### Listener Timing

Listeners are notified after the handler runs but before effects execute:

```
Event → Handler → [NOTIFY LISTENERS] → Execute Effects
```

Listeners observe the pure transformation (event → effects) before side effects occur.

### Error Handling

Listener errors are automatically caught. Use the `onListenerError` hook to handle them:

```typescript
const loop = createEventLoop({
  getState: () => state,
  handlers,
  executor,
  handlerContext: {},
  executorContext: {
    /* ... */
  },

  // Handle listener errors gracefully
  onListenerError: (error, event, effects) => {
    console.error("Listener error:", error);
    console.error("During event:", event);
    console.error("With effects:", effects);

    // Report to error tracking service
    errorTracker.report(error, { event, effects });
  },
});
```

### Testing with Subscriptions

Subscriptions make testing event flows easy:

```typescript
test("player movement produces correct effects", () => {
  const events: GameEvent[] = [];
  const effectCounts = new Map<string, number>();

  loop.subscribe((event, effects) => {
    events.push(event);
    effects.forEach((e) => {
      effectCounts.set(e.type, (effectCounts.get(e.type) || 0) + 1);
    });
  });

  loop.dispatch({ type: "player:move", x: 10, y: 20 });

  expect(events).toHaveLength(1);
  expect(events[0].type).toBe("player:move");
  expect(effectCounts.get("state:update")).toBe(1);
  expect(effectCounts.get("sound:play")).toBe(1);
});
```

### Building DevTools

Subscriptions enable powerful debugging tools:

```typescript
function createDevTools(maxHistory = 100) {
  const history: Array<{ event: any; effects: any[]; timestamp: number }> = [];

  const attach = (loop: EventLoop<any, any>) => {
    return loop.subscribe((event, effects) => {
      history.push({
        event,
        effects,
        timestamp: Date.now(),
      });

      // Keep history bounded
      if (history.length > maxHistory) {
        history.shift();
      }

      // Update UI
      render();
    });
  };

  const getHistory = () => history;

  const getEventFrequency = () => {
    const freq = new Map<string, number>();
    history.forEach(({ event }) => {
      freq.set(event.type, (freq.get(event.type) || 0) + 1);
    });
    return freq;
  };

  const render = () => {
    // Update DevTools UI with latest history
  };

  return { attach, getHistory, getEventFrequency };
}

const devTools = createDevTools();
const unsubscribe = devTools.attach(loop);
```

### Cleanup

All listeners are automatically cleared when you call `dispose()`:

```typescript
const unsub1 = loop.subscribe(listener1);
const unsub2 = loop.subscribe(listener2);

// Option 1: Unsubscribe individually
unsub1();
unsub2();

// Option 2: Dispose the loop (clears all listeners)
loop.dispose();
```

## Type Testing

Emergent includes a test suite to verify TypeScript inference. You can write similar tests for your systems:

```typescript
import { describe, test, expectTypeOf } from "vitest";
import { emergentSystem, EventHandlerMap, EffectExecutorMap } from "emergent";

describe("My emergent system types", () => {
  test("handler context should have custom properties", () => {
    type Events = { type: "test" };
    type Effects = { type: "effect" };
    type State = { count: number };
    type HCtx = {
      customHelper: () => string;
    };
    type ECtx = {};

    const createEventLoop = emergentSystem<
      Events,
      Effects,
      State,
      HCtx,
      ECtx
    >();

    const handlers = {
      test: (state, event, ctx) => {
        // Type test: ctx should have customHelper
        expectTypeOf(ctx).toHaveProperty("customHelper");
        expectTypeOf(ctx.customHelper).returns.toBeString();
        return [];
      },
    } satisfies EventHandlerMap<Events, Effects, State, HCtx>;
  });

  test("executor context should have dispatch injected", () => {
    type Events = { type: "test" };
    type Effects = { type: "effect" };
    type State = void;
    type HCtx = {};
    type ECtx = { logger: Console };

    const createEventLoop = emergentSystem<
      Events,
      Effects,
      State,
      HCtx,
      ECtx
    >();

    const executor = {
      effect: (effect, ctx) => {
        // Type test: ctx should have dispatch
        expectTypeOf(ctx).toHaveProperty("dispatch");
        expectTypeOf(ctx.dispatch).toBeFunction();

        // Type test: ctx should have user properties
        expectTypeOf(ctx).toHaveProperty("logger");
      },
    } satisfies EffectExecutorMap<Effects, Events, ECtx>;
  });
});
```

### Type Expansion

The library uses `Expand` utility types to show full type definitions on hover instead of type alias names. Hovering over `ctx` in a handler or executor shows the complete context structure rather than just the type name.

### Running Type Tests

Type tests validate:

- Handler contexts include user-defined properties
- Executor contexts have dispatch automatically injected
- Event and effect discrimination work correctly
- Exhaustiveness checking catches missing handlers/executors

Run tests with: `npm test`

## API Reference

### `emergentSystem<TEvents, TEffects, TState, THandlerContext, TExecutorContext>()`

Creates a typed emergent system factory.

**Type Parameters:**

- `TEvents` - Discriminated union of all event types (what can happen)
- `TEffects` - Discriminated union of all effect types (what to do)
- `TState` - State type (use `void` for stateless systems)
- `THandlerContext` - Context available to handlers (pure utilities, domain data)
- `TExecutorContext` - Context available to executors (`dispatch` will be injected)

**Returns:** `createEventLoop` function that creates an event loop instance with the given configuration. Parts can be swapped to facilitate testing or alternate executor contexts.

### `createEventLoop(config)`

Creates an event loop instance with the given configuration.

**Parameters:**

- `config.getState` - Function to get current state
- `config.handlers` - Map of event type to handler function
- `config.executors` - Map of effect type to executor function
- `config.handlerContext` - Context passed to all handlers (pure utilities, domain data)
- `config.executorContext` - Context passed to all executors (dispatch will be injected)

**Returns:** Event loop instance with the following methods:

#### `dispatch(event: TEvent): void`

Main interface for production use. Computes effects from the event and executes them asynchronously (fire-and-forget).

```typescript
loop.dispatch({ type: "increment" });
// Handler runs, effects execute asynchronously
```

#### `handleEvent(event: TEvent): TEffect[]`

*New in v1.1.0* - Pure function that computes effects from an event without executing them. Useful for testing handler logic in isolation.

```typescript
const effects = loop.handleEvent({ type: "increment" });
expect(effects).toEqual([{ type: "state:update", count: 1 }]);
```

#### `executeEffects(effects: TEffect[], sourceEvent: TEvent): Promise<void>`

*New in v1.1.0* - Executes effects and returns a Promise that resolves when all effects complete. Useful for testing side effects and waiting for async operations.

```typescript
const effects = loop.handleEvent({ type: "increment" });
await loop.executeEffects(effects, { type: "increment" });
// All effects are now complete
```

#### `subscribe(listener: EventLoopListener): () => void`

Adds a listener that is notified after each event is handled (before effects execute). Returns an unsubscribe function.

```typescript
const unsubscribe = loop.subscribe((event, effects) => {
  console.log("Event:", event.type);
  console.log("Effects:", effects);
});

// Later: stop listening
unsubscribe();
```

#### `dispose(): void`

Cleans up the event loop by removing all listeners and calling the `onDispose` hook if provided.

```typescript
loop.dispose();
```

### Types

```typescript
type Handler<TEvent, TEffect, TState, TContext> = (
  state: TState,
  event: TEvent,
  context: TContext
) => TEffect[];

type Executor<TEffect, TContext> = (
  effect: TEffect,
  context: TContext
) => void | Promise<void>;

type EventLoopListener<TEvents, TEffects> = (
  event: TEvents,
  effects: TEffects[]
) => void;

type EventLoop<TEvent, TEffect> = {
  dispose: () => void;
  dispatch: (event: TEvent) => void;
  subscribe: (listener: EventLoopListener<TEvent, TEffect>) => () => void;
  handleEvent: (event: TEvent) => TEffect[];
  executeEffects: (effects: TEffect[], sourceEvent: TEvent) => Promise<void>;
};

// Helper types for better DX
type EventHandlerMap<TEvents, TEffects, TState, THandlerContext> = {
  [K in TEvents["type"]]: Handler<
    Extract<TEvents, { type: K }>,
    TEffects,
    TState,
    THandlerContext
  >;
};

type EffectExecutorMap<TEffects, TEvents, TExecutorContext> = {
  [K in TEffects["type"]]: Executor<
    Extract<TEffects, { type: K }>,
    TExecutorContext & { dispatch: (event: TEvents) => void }
  >;
};

type EffectExecutorMapBase<TEffects, TExecutorContext> = {
  [K in TEffects["type"]]: Executor<
    Extract<TEffects, { type: K }>,
    TExecutorContext
  >;
};
```

### Configuration Hooks

```typescript
createEventLoop({
  getState: () => TState,
  handlers,
  executors,
  handlerContext,
  executorContext,

  // *Optional hooks*
  onDispose?: () => void,
  onHandlerNotFound?: (event: TEvents) => void,
  onExecutorNotFound?: (event: TEvents, effect: TEffects) => void,
  onListenerError?: (error: unknown, event: TEvents, effects: TEffects[]) => void,
  onExecutorError?: (error: unknown, effect: TEffects, event: TEvents) => void,
})
```

**Hook descriptions:**

- `onDispose` - Called when `loop.dispose()` is invoked. Use this to cleanup resources or persist state
- `onHandlerNotFound` - Called when an event has no registered handler
- `onExecutorNotFound` - Called when an effect has no registered executor
- `onListenerError` - Called when a subscription listener throws. Listener errors never break the event loop
- `onExecutorError` - Called when an executor throws (sync or async). Without this hook, sync errors crash the loop (fail-fast) and async errors log to console

## Error Handling

### Fail-Fast by Default

The event loop crashes by default when errors occur. This reveals bugs immediately and encourages correct code.

### Handlers Should Never Throw

Handlers are pure functions and should not throw errors. If a handler throws, the event loop will crash.

**Recommended approach:** Return an error effect instead of throwing

```typescript
const handlers = {
  divide: (state, event, ctx) => {
    if (event.divisor === 0) {
      return [{ type: "log", level: "error", message: "Division by zero" }];
    }
    return [{ type: "state:update", result: event.dividend / event.divisor }];
  },
} satisfies EventHandlerMap<Events, Effects, State, HandlerContext>;
```

**Not recommended:** Throwing from a handler

```typescript
const handlers = {
  divide: (state, event, ctx) => {
    if (event.divisor === 0) {
      throw new Error("Division by zero"); // Will crash event loop
    }
    return [{ type: "state:update", result: event.dividend / event.divisor }];
  },
};
```

### Executors Can Throw

Executors interact with networks, databases, and file systems — operations that can fail for operational reasons beyond programmer errors.

By default, executor errors crash the event loop (fail-fast). Provide an `onExecutorError` hook to handle errors gracefully:

```typescript
const loop = createEventLoop({
  getState: () => state,
  handlers,
  executor,
  handlerContext: {},
  executorContext: {
    api: myApiClient,
    logger: console,
  },

  // Handle executor errors gracefully
  onExecutorError: (error, effect, event) => {
    // Log the error with full context
    console.error("Executor failed", {
      error: error instanceof Error ? error.message : error,
      effect: effect.type,
      event: event.type,
    });

    // Report to error tracking
    errorTracker.report(error, { effect, event });

    // Optionally re-throw for critical errors
    if (error instanceof DatabaseError) {
      throw error; // Crash on database errors
    }

    // Otherwise, continue (resilient mode)
  },
});
```

### Async Executors and Error Handling

Executors can be async, but the library does not await them (fire-and-forget). Async errors are caught and passed to `onExecutorError`:

```typescript
const executor = {
  "http:fetch": async (effect, ctx) => {
    // If this throws, onExecutorError will be called
    const response = await fetch(effect.url);
    const data = await response.json();
    ctx.dispatch({ type: "data:received", data });
  },
} satisfies EffectExecutorMap<Effects, Events, ExecutorContext>;

const loop = createEventLoop({
  // ... config ...
  onExecutorError: (error, effect, event) => {
    // Handles BOTH sync and async errors
    console.error("Executor failed", { error, effect, event });
  },
});
```

**Note:** Async errors are caught after the event loop continues. The event loop never blocks waiting for async effects to complete.

Without `onExecutorError`, async errors log to console to prevent silent failures:

```
[Emergent] Unhandled async error in executor 'http:fetch': TypeError: Failed to fetch
```

### Best Practices for Async Work

Since executors are fire-and-forget, handle errors inside async executors and dispatch events to communicate results:

```typescript
const executor = {
  "http:fetch": async (effect, ctx) => {
    try {
      const response = await fetch(effect.url);
      const data = await response.json();
      ctx.dispatch({ type: "fetch:success", data });
    } catch (error) {
      // Dispatch error event instead of throwing
      ctx.dispatch({
        type: "fetch:failed",
        url: effect.url,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
} satisfies EffectExecutorMap<Effects, Events, ExecutorContext>;
```

This approach:

- Makes errors observable as events
- Allows handlers to respond to errors
- Maintains the event-driven flow
- Keeps error handling in your domain model

### Listener Errors

Listeners are observers and should not break the system. Listener errors are automatically caught and passed to `onListenerError` if provided:

```typescript
const loop = createEventLoop({
  // ... config ...

  onListenerError: (error, event, effects) => {
    console.error("Listener failed:", error);
    // Event loop continues regardless
  },
});
```

## Troubleshooting

### "Property 'dispatch' does not exist on type 'ExecutorContext'"

**Problem:** Type error when using `ctx.dispatch()` in an executor.

**Solution:** Use `EffectExecutorMap` with 3 type parameters including Events:

```typescript
// Wrong - missing Events type parameter
const executor = {
  myEffect: (effect, ctx) => {
    ctx.dispatch({ type: "next" }); // Type error
  },
} satisfies EffectExecutorMapBase<Effects, ExecutorContext>;

// Correct - EffectExecutorMap includes dispatch automatically
const executor = {
  myEffect: (effect, ctx) => {
    ctx.dispatch({ type: "next" }); // Works
  },
} satisfies EffectExecutorMap<Effects, Events, ExecutorContext>;
```

### Handler context not showing custom properties

**Problem:** IDE hover shows `(parameter) ctx: HandlerContext` instead of custom properties.

**Solution:** Enable strict mode in TypeScript configuration and verify type aliases are correct.

In `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true
  }
}
```

## Examples

See the [`examples/`](./examples) directory for working demonstrations:

- **0-the-pattern/** - Vanilla implementations showing the observer pattern
- **1-state-management-and-time/** - Integration with Zustand and timers
- **2-websocket-chat/** - Real-time chat with WebSocket transport

Additional snippets in [`snippets/`](./snippets):
- **counter.ts** - Stateful counter with state management
- **stateless-router.ts** - Event routing without state
- **with-braided.ts** - Integration with Braided resource system

## Comparison to Other Patterns

### vs Redux

**Redux:** `(State, Action) → State`

**Emergent:** `(State, Event) → Effects[]` then `Effect → void`

Redux returns new state directly. Emergent returns effect descriptions that are interpreted separately. State update is one type of effect, the other types depend on your domain use case.

### vs Elm Architecture

**Elm:** `update : Msg -> Model -> (Model, Cmd Msg)`

**Emergent:** Separates handlers (pure) from executors (impure).

### vs re-frame

Similar to re-frame's event/effect architecture, with TypeScript discriminated unions for type safety. Complex application behavior emerges from simple event/effect rules.

---

The important point to note here is that Redux/Mobx/Zustand/Jotai handle state storage/update and distribution, generally they don't prescribe techniques for other types of effects that your application may need to execute, beyond the effect of updating the state.

## Philosophy

Emergent is inspired by emergence patterns found in nature and computation.

### Principles

1. **Data over code** - Events and effects are data structures
2. **Simple over complex** - Minimal rules that compose
3. **Observable by default** - Watch patterns emerge in real-time
4. **Testable by design** - Test the rules, trust the emergence
5. **No central controller** - Decentralized, composable architecture
6. **Type-safe** - TypeScript ensures correctness
7. **No magic** - No decorators, no reflection, just pure functions and data

## Pattern Over Framework

Emergent is ~330 lines of code embodying a pattern:

1. Read the source (`src/core.ts`)
2. Understand the pattern
3. Adapt it for your needs

This is not a black box. This is a philosophy you can make your own.

## Related Projects

### Functional Architectures

- [re-frame](https://github.com/day8/re-frame) (ClojureScript) - Event-driven architecture
- [Elm Architecture](https://guide.elm-lang.org/architecture/) - Pure functional UI
- [Redux](https://redux.js.org/) - Predictable state containers

### Complementary Libraries

- [Braided](https://github.com/RegiByte/braided) - Resource lifecycle management
- [Braided React](https://github.com/RegiByte/braided-react) - React integration for Braided

## License

ISC

## Contributing

Issues and PRs welcome. This library has been tested in distributed systems managing event flows, timers, WebSocket connections, and stateful resources.

---

**Simple rules. Emergent systems. Trust the emergence.** 🌊
