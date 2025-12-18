/**
 * Counter Example - Stateful Event Loop
 *
 * Demonstrates:
 * - Event types (increment, decrement, reset, set)
 * - Effect types (state:update, log)
 * - Handler context with getState
 * - Executor context with setState, dispatch, logger
 * - Circular reference pattern (dispatch injection)
 */

import { EffectExecutorMap, EventHandlerMap } from "../src/core";
import { emergentSystem } from "../src/index";

// 1. Define domain types
type CounterEvents =
  | { type: "increment" }
  | { type: "decrement" }
  | { type: "reset" }
  | { type: "set"; value: number };

type CounterEffects =
  | { type: "state:update"; count: number }
  | { type: "log"; message: string };

type CounterState = { count: number };

type HandlerContext = {
  // Pure utilities and domain data only
  // Note: getState is now a formal parameter of createEventLoop
};

type ExecutorContext = {
  setState: (state: CounterState) => void;
  logger: { log: (msg: string) => void };
  // Note: dispatch is automatically injected by the library, no need to define it here
};

// 2. Create emergent system
const createEventLoop = emergentSystem<
  CounterEvents,
  CounterEffects,
  CounterState,
  HandlerContext,
  ExecutorContext
>();

// (optional) Derive types from your domain types
type Handlers = EventHandlerMap<
  CounterEvents,
  CounterEffects,
  CounterState,
  HandlerContext
>;
// If you need modularity and don't want to define all handlers in a single place, you can use PartialHandlers
type PartialHandlers = Partial<Handlers>;

// (optional) Derive types from your domain types
type Executors = EffectExecutorMap<
  CounterEffects,
  CounterEvents,
  ExecutorContext
>;
// If you need modularity and don't want to define all executors in a single place, you can use PartialExecutor
type PartialExecutors = Partial<Executors>;

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
      { type: "log", message: "Counter reset to 0" },
    ];
  },

  set: (_state, event, _ctx) => {
    return [
      { type: "state:update", count: event.value },
      { type: "log", message: `Counter set to ${event.value}` },
    ];
  },
} satisfies Handlers;

// 4. Define executors (side effects)
const executor = {
  "state:update": (effect, ctx) => {
    ctx.setState({ count: effect.count });
  },

  log: (effect, ctx) => {
    ctx.logger.log(effect.message);
  },
} satisfies Executors;

// 5. Create the loop
let currentState: CounterState = { count: 0 };

const loop = createEventLoop({
  getState: () => currentState,
  handlers,
  executors: executor,
  handlerContext: {},
  executorContext: {
    setState: (state) => {
      currentState = state;
    },
    logger: console,
  },
});

// 6. Subscribe to observe events (optional)
const eventLog: Array<{ event: CounterEvents; effects: CounterEffects[] }> = [];

const unsubscribe = loop.subscribe((event, effects) => {
  eventLog.push({ event, effects });
  console.log(`[Observer] Event: ${event.type}, Effects: ${effects.length}`);
});

// 7. Use it
console.log("\n=== Counter Example ===\n");

loop.dispatch({ type: "increment" });
console.log(`Current count: ${currentState.count}`); // 1

loop.dispatch({ type: "increment" });
console.log(`Current count: ${currentState.count}`); // 2

loop.dispatch({ type: "decrement" });
console.log(`Current count: ${currentState.count}`); // 1

for (let i = 0; i < 10; i++) {
  loop.dispatch({ type: "increment" });
}
console.log(`Current count: ${currentState.count}`); // 11

loop.dispatch({ type: "set", value: 42 });
console.log(`Current count: ${currentState.count}`); // 42

loop.dispatch({ type: "reset" });
console.log(`Current count: ${currentState.count}`); // 0

// Test circular dispatch
console.log("\n--- Testing circular dispatch ---\n");
loop.dispatch({ type: "set", value: 100 });
console.log(`Current count: ${currentState.count}`); // 100

// Show subscription data
console.log("\n--- Event Log (from subscription) ---");
console.log(`Total events dispatched: ${eventLog.length}`);
console.log(`Event types: ${eventLog.map((e) => e.event.type).join(", ")}`);

unsubscribe();
loop.dispose();
console.log("\n=== Counter Example Complete ===\n");
