# 🌊 Emergent

> **Complex behavior from simple rules.**

A minimal, type-safe library for event-driven systems where sophisticated patterns emerge naturally from simple handlers. No central controller. No framework magic. Just pure functions composing into emergent behavior.

## The Emergence Pattern

In nature, complexity emerges from simple rules:

- Snowflakes from water molecules
- Consciousness from neurons
- Ecosystems from organisms

In **Emergent**, sophisticated application behavior emerges from:

```
Event (what happened) → Handler (pure rule) → Effects (what to do) → Executor (side effects)
```

### Core Concepts

1. **Event** - Discriminated union describing what happened (the cause)
2. **Handler** - Pure function that transforms events into effects (the rule)
3. **Effect** - Discriminated union describing what to do (the consequence)
4. **Executor** - Function that performs side effects (the action)

Complex patterns emerge from these simple interactions. No central governor needed.

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
const executor = {
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
  executor,
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

## Philosophy: Emergence from Simple Rules

**Emergent** is built on the principle that complex, sophisticated behavior emerges naturally from the interaction of simple, well-defined rules.

### Core Principles

1. **No Central Governor** - No framework controlling your flow, no global orchestrator. Just events flowing through handlers.

2. **Simple Rules Compose** - Handlers are pure functions. Effects are data. Executors perform side effects. That's it.

3. **Emergence is Reliable** - Complex patterns arise predictably from simple interactions. Testable. Debuggable. Observable.

4. **Data Over Code** - Events and effects are discriminated unions. Everything between cause and effect is inspectable data.

5. **Causality is Explicit** - Every effect has a clear cause (event). Every event produces observable effects. The chain is traceable.

6. **User-Defined Patterns** - The library provides the mechanism. You define what emerges.

## Why Emergent?

### Testability

Handlers are pure functions - easy to test without mocks:

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

Full TypeScript inference with exhaustiveness checking:

```typescript
const createEventLoop = emergentSystem<Events, Effects, State, HCtx, ECtx>();

// Use satisfies for type checking without losing inference
const handlers = {
  increment: (state, event, ctx) => {
    // TypeScript knows all types and ensures all events are handled
    return [{ type: "state:update", count: state.count + 1 }];
  },
  // TypeScript error if you forget any event types!
} satisfies EventHandlerMap<Events, Effects, State, HCtx>;
```

### Helper Types

The library exports helper types for better DX:

```typescript
import { EventHandlerMap, EffectExecutorMap } from "emergent";

// Derive handler map type
type Handlers = EventHandlerMap<MyEvents, MyEffects, MyState, HCtx>;

// Derive executor map type (dispatch is automatically included!)
type Executors = EffectExecutorMap<MyEffects, MyEvents, ECtx>;

// Use Partial for modular/plugin systems
type PartialHandlers = Partial<Handlers>;
type PartialExecutors = Partial<Executors>;
```

**Note:** `EffectExecutorMap` automatically includes `dispatch` in your executor context, so you can call `ctx.dispatch()` without additional type annotations.
This is useful for when you want to feed new events back into the system. For advanced cases where you don't need dispatch, use `EffectExecutorMapBase`.

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
        // Note: dispatch is automatically injected by the library!
        // You don't need to provide it in executorContext
      },
    });
  },
  halt: (loop) => loop.dispose(),
});
```

**Key Points:**

- The `dispatch` function is automatically injected into the executor context by the library
- `getState` is now a formal parameter, not part of handlerContext
- You only need to provide your own domain utilities and resources

## Observability with Subscriptions

Emergent includes a subscription system that allows external observers to track the event loop's behavior without interfering with its operation. This is perfect for:

- **DevTools integration** - Build Redux DevTools-style debugging
- **Logging & auditing** - Track all events and effects
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

Listeners are notified **after the handler runs but before effects are executed**:

```
Event → Handler → [NOTIFY LISTENERS] → Execute Effects
```

This means listeners observe the pure transformation (event → effects) before any side effects occur.

### Error Handling

Listener errors won't break your event loop. Use the `onListenerError` hook to handle them:

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

Emergent includes a complete test suite to ensure TypeScript inference works correctly. You can write similar tests for your own emergent systems:

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

The library uses `Expand` utility types to make TypeScript show full type definitions on hover instead of just type alias names. This means when you hover over `ctx` in a handler or executor, you'll see the complete structure of your context type, not just `HandlerContext` or `ExecutorContext`.

### Why Type Tests?

Type tests validate that:

- Handler contexts include user-defined properties
- Executor contexts have dispatch automatically injected
- Event discrimination works correctly
- Effect discrimination works correctly
- Exhaustiveness checking catches missing handlers/executors

Run type tests with: `npm test`

## API Reference

### `emergentSystem<TEvents, TEffects, TState, THandlerContext, TExecutorContext>()`

Creates a typed emergent system factory. This defines the simple rules from which
complex behavior will emerge.

**Type Parameters:**

- `TEvents` - Discriminated union of all event types (what can happen)
- `TEffects` - Discriminated union of all effect types (what to do)
- `TState` - State type (can be `void` for stateless systems)
- `THandlerContext` - Context available to handlers (pure utilities, domain data)
- `TExecutorContext` - Context available to executors (will have `dispatch` injected)

**Returns:** `createEventLoop` function that creates an event loop instance with the given configuration (parts can be swapped to facilitate testing / different executor contexts)

### `createEventLoop(config)`

Creates an event loop instance with the given configuration.

**Parameters:**

- `config.getState` - Function to get current state
- `config.handlers` - Map of event type to handler function
- `config.executor` - Map of effect type to executor function
- `config.handlerContext` - Context passed to all handlers (pure utilities, domain data)
- `config.executorContext` - Context passed to all executors (dispatch will be injected)

**Returns:** `{ dispatch, subscribe, dispose }`

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
  dispatch: (event: TEvent) => void;
  subscribe: (listener: EventLoopListener<TEvent, TEffect>) => () => void;
  dispose: () => void;
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
  executor,
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

**Hook Descriptions:**

- `onDispose` - Called when `loop.dispose()` is invoked, gives you the chance to cleanup resources or persist state
- `onHandlerNotFound` - Called when an event has no registered handler
- `onExecutorNotFound` - Called when an effect has no registered executor
- `onListenerError` - Called when a subscription listener throws an error (even if undefined, listener errors never break the event loop)
- `onExecutorError` - Called when an executor throws an error (sync or async). If not provided, sync errors crash the loop (fail-fast) and async errors are logged to console (no silent failures)

## Error Handling

### Philosophy: Fail-Fast by Default

Emergent follows a fail-fast philosophy. If something goes wrong, the event loop crashes by default. This forces you to write correct code and reveals bugs immediately.

### Handlers Should Never Throw

Handlers are pure functions. They should never throw errors. If a handler throws, it indicates a programmer error (bug in your code), and the event loop will crash.

**Good**: Return an error effect instead of throwing

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

**Bad**: Throwing from a handler

```typescript
const handlers = {
  divide: (state, event, ctx) => {
    if (event.divisor === 0) {
      throw new Error("Division by zero"); // ❌ Will crash event loop
    }
    return [{ type: "state:update", result: event.dividend / event.divisor }];
  },
};
```

### Executors Can Throw (With Handling)

Executors interact with the real world, like networks, databases, file systems. These can fail for operational reasons, not just programmer errors.

By default, if an executor throws, the event loop crashes (fail-fast). However, you can provide an `onExecutorError` hook to handle errors gracefully:

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

Executors can be async, but the library doesn't await them (fire-and-forget). However, async errors **are** caught and passed to `onExecutorError`:

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

**Important**: Async errors are caught **after** the event loop continues. The event loop never blocks waiting for async effects to complete.

If you don't provide `onExecutorError`, async errors are logged to console to prevent silent failures:

```
[Emergent] Unhandled async error in executor 'http:fetch': TypeError: Failed to fetch
```

### Best Practices for Async Work

Since executors are fire-and-forget, handle errors inside your async executors and dispatch events to communicate results:

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

This pattern:

- ✅ Makes errors observable (they become events)
- ✅ Allows handlers to respond to errors
- ✅ Maintains the event-driven flow
- ✅ Keeps error handling in your domain model

### Listener Errors

Listeners are observers and should never break the system. Listener errors are automatically caught and passed to `onListenerError` if provided:

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

**Problem:** You're getting a type error when trying to use `ctx.dispatch()` in an executor.

**Solution:** Make sure you're using `EffectExecutorMap` (with 3 type parameters including Events):

```typescript
// ❌ Wrong - missing Events type parameter
const executor = {
  myEffect: (effect, ctx) => {
    ctx.dispatch({ type: "next" }); // Type error!
  },
} satisfies EffectExecutorMapBase<Effects, ExecutorContext>;

// ✅ Correct - EffectExecutorMap includes dispatch automatically
const executor = {
  myEffect: (effect, ctx) => {
    ctx.dispatch({ type: "next" }); // Works!
  },
} satisfies EffectExecutorMap<Effects, Events, ExecutorContext>;
```

### Handler context not showing custom properties

**Problem:** IDE hover shows `(parameter) ctx: HandlerContext` instead of showing your custom properties.

**Solution:** Make sure you are using strict mode in your TypeScript configuration and that you are using the correct type aliases.

In `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true
  }
}
```

## Examples

See the [`examples/`](./examples) directory for:

- **counter.ts** - Stateful counter with state management
- **stateless-router.ts** - Event routing without state
- **with-braided.ts** - Integration with Braided resource system

## Comparison to Other Patterns

### vs Redux

**Redux:** `(State, Action) → State`

**Emergent:** `(State, Event) → Effects[]` then `Effect → void`

Redux returns new state directly. Emergent returns effect descriptions that are interpreted separately. Complex state management emerges from simple transformations.

### vs Elm Architecture

**Elm:** `update : Msg -> Model -> (Model, Cmd Msg)`

**Emergent:** Separates handlers (pure) from executors (impure). Sophisticated patterns emerge from this separation.

### vs re-frame

Similar to re-frame's event/effect architecture, but with TypeScript discriminated unions for type safety. Like re-frame, complex application behavior emerges from simple event/effect rules.

## Philosophy: Inspired by Nature and Computation

**Emergent** is inspired by the principle of emergence found throughout nature and computation:

### Natural Emergence

- **Conway's Game of Life** - Complex patterns from simple cellular rules
- **Ant colonies** - Sophisticated behavior without central control
- **Neural networks** - Intelligence emerges from simple neurons
- **Ecosystems** - Biodiversity emerges from organism interactions
- **The Universe** - All patterns emerge from fundamental rules

### Computational Emergence

- **re-frame** (ClojureScript) - Data-driven event handling
- **Elm Architecture** - Pure functions composing into applications
- **Rich Hickey's philosophy** - Simple rules, powerful composition
- **Cellular Automata** - Complexity from simplicity

### Our Principles

1. **Data over code** - Events and effects are data structures
2. **Simple over complex** - Minimal rules that compose
3. **Observable by default** - Watch emergence happen in real-time
4. **Testable by design** - Test the rules, trust the emergence
5. **No central governor** - Decentralized, composable architecture
6. **Type-safe emergence** - TypeScript ensures correctness
7. **Zero magic** - No decorators, no reflection, just pure functions and data

## Philosophy Over Framework

Emergent is ~330 lines of code embodying a pattern. We encourage you to:

1. Read the source (`src/core.ts`)
2. Understand the pattern
3. Copy and adapt it for your needs if necessary

This is not a black box. This is a philosophy you can make your own.

## Inspiration & Related Projects

### Emergence in Nature & Computation

- [Conway's Game of Life](https://en.wikipedia.org/wiki/Conway%27s_Game_of_Life) - Emergence in action
- [Cellular Automata](https://en.wikipedia.org/wiki/Cellular_automaton) - Complex patterns from simple rules
- Ant colony optimization - Collective intelligence without central control

### Functional Architectures

- [re-frame](https://github.com/day8/re-frame) (ClojureScript) - Event-driven architecture
- [Elm Architecture](https://guide.elm-lang.org/architecture/) - Pure functional UI
- [Redux](https://redux.js.org/) - Predictable state containers
- Rich Hickey's ["Simple Made Easy"](https://www.infoq.com/presentations/Simple-Made-Easy/) - Philosophy of simplicity

### Complementary Tools

- [Braided](https://github.com/RegiByte/braided) - Untangle your stateful resources
- [Braided React](https://github.com/RegiByte/braided-react) - React integration for Braided

## License

ISC

## Contributing

Issues and PRs welcome! This library has been battle-tested in real-world distributed systems managing complex event flows, timers, WebSocket connections, and stateful resources.

---

**Simple rules. Emergent systems. No central governor. No framework magic. Trust the emergence.** 🌊
