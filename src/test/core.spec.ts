/**
 * Core functionality tests for emergent
 */

import { describe, test, expect, vi } from "vitest";
import { emergentSystem } from "../core";

describe("emergent", () => {
  describe("Handler execution", () => {
    test("should execute handler and produce effects", () => {
      // Define types
      type Events = { type: "test" };
      type Effects = { type: "effect1" } | { type: "effect2" };
      type State = { value: number };
      type HCtx = {};
      type ECtx = { dispatch: (e: Events) => void };

      const createEventLoop = emergentSystem<
        Events,
        Effects,
        State,
        HCtx,
        ECtx
      >();

      const handler = vi.fn((_state, _event, _ctx) => [
        { type: "effect1" as const },
        { type: "effect2" as const },
      ]);

      const executor1 = vi.fn();
      const executor2 = vi.fn();

      const loop = createEventLoop({
        getState: () => ({ value: 42 }),
        handlers: { test: handler },
        executor: { effect1: executor1, effect2: executor2 },
        handlerContext: {},
        executorContext: { dispatch: undefined as any },
      });

      loop.dispatch({ type: "test" });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(executor1).toHaveBeenCalledTimes(1);
      expect(executor2).toHaveBeenCalledTimes(1);
    });

    test("should pass correct state to handler", () => {
      type Events = { type: "test" };
      type Effects = { type: "log"; value: number };
      type State = { value: number };
      type HCtx = {};
      type ECtx = { dispatch: (e: Events) => void };

      const createEventLoop = emergentSystem<
        Events,
        Effects,
        State,
        HCtx,
        ECtx
      >();

      let capturedState: State | null = null;
      const handler = (state: State, _event: Events, _ctx: HCtx): Effects[] => {
        capturedState = state;
        return [{ type: "log", value: state.value }];
      };

      const loop = createEventLoop({
        getState: () => ({ value: 123 }),
        handlers: { test: handler },
        executor: { log: () => {} },
        handlerContext: {},
        executorContext: { dispatch: undefined as any },
      });

      loop.dispatch({ type: "test" });

      expect(capturedState).toEqual({ value: 123 });
    });
  });

  describe("Effect execution", () => {
    test("should execute effects in order", () => {
      type Events = { type: "test" };
      type Effects = { type: "effect"; order: number };
      type State = void;
      type HCtx = {};
      type ECtx = { dispatch: (e: Events) => void };

      const createEventLoop = emergentSystem<
        Events,
        Effects,
        State,
        HCtx,
        ECtx
      >();

      const executionOrder: number[] = [];

      const loop = createEventLoop({
        getState: () => undefined,
        handlers: {
          test: () => [
            { type: "effect", order: 1 },
            { type: "effect", order: 2 },
            { type: "effect", order: 3 },
          ],
        },
        executor: {
          effect: (effect) => {
            executionOrder.push(effect.order);
          },
        },
        handlerContext: {},
        executorContext: { dispatch: undefined as any },
      });

      loop.dispatch({ type: "test" });

      expect(executionOrder).toEqual([1, 2, 3]);
    });

    test("should pass executor context to executors", () => {
      type Events = { type: "test" };
      type Effects = { type: "effect" };
      type State = void;
      type HCtx = {};
      type ECtx = { customValue: string };

      const createEventLoop = emergentSystem<
        Events,
        Effects,
        State,
        HCtx,
        ECtx
      >();

      let capturedContext!: ECtx;

      const loop = createEventLoop({
        getState: () => undefined,
        handlers: { test: () => [{ type: "effect" }] },
        executor: {
          effect: (_effect, ctx) => {
            capturedContext = ctx;
          },
        },
        handlerContext: {},
        executorContext: {
          customValue: "test-value",
        },
      });

      loop.dispatch({ type: "test" });

      expect(capturedContext).toBeTruthy();
      expect(capturedContext?.customValue).toBe("test-value");
    });
  });

  describe("Missing handlers and executors", () => {
    test("should warn on missing handler", () => {
      type Events = { type: "test" } | { type: "missing" };
      type Effects = { type: "effect" };
      type State = void;
      type HCtx = {};
      type ECtx = { dispatch: (e: Events) => void };

      const createEventLoop = emergentSystem<
        Events,
        Effects,
        State,
        HCtx,
        ECtx
      >();

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const loop = createEventLoop({
        getState: () => undefined,
        // @ts-expect-error - missing handler is missing
        handlers: { test: () => [{ type: "effect" }] },
        executor: { effect: () => {} },
        handlerContext: {},
        executorContext: { dispatch: undefined as any },
        onHandlerNotFound: (event) => {
          console.warn(`No handler for event: ${event.type}`);
        },
      });

      loop.dispatch({ type: "missing" } as any);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("No handler for event: missing")
      );

      warnSpy.mockRestore();
    });

    test("should warn on missing executor", () => {
      type Events = { type: "test" };
      type Effects = { type: "effect1" } | { type: "effect2" };
      type State = void;
      type HCtx = {};
      type ECtx = { callApi: (url: string) => void };

      const createEventLoop = emergentSystem<
        Events,
        Effects,
        State,
        HCtx,
        ECtx
      >();

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const loop = createEventLoop({
        getState: () => undefined,
        handlers: { test: () => [{ type: "effect1" }, { type: "effect2" }] },
        // @ts-expect-error - effect2 is missing
        executor: {
          effect1: (effect, ctx) => {
            // do something when effect1 needs to run
            ctx.callApi("https://api.example.com");
          },
        }, // effect2 is missing
        handlerContext: {},
        executorContext: {
          callApi: async (url: string) => {
            // do something when callApi effect is executed
          },
        },
        onExecutorNotFound: (event, effect) => {
          console.warn(`No executor for effect: ${effect.type}`);
        },
      });

      loop.dispatch({ type: "test" });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("No executor for effect: effect2")
      );

      warnSpy.mockRestore();
    });
  });

  describe("Dispatch injection", () => {
    test("should inject dispatch into executor context", () => {
      type Events = { type: "test" };
      type Effects = { type: "check" };
      type State = void;
      type HCtx = {};
      type ECtx = { dispatch: (e: Events) => void };

      const createEventLoop = emergentSystem<
        Events,
        Effects,
        State,
        HCtx,
        ECtx
      >();

      let dispatchAvailable = false;

      const loop = createEventLoop({
        getState: () => undefined,
        handlers: { test: () => [{ type: "check" }] },
        executor: {
          check: (_effect, ctx) => {
            dispatchAvailable = typeof ctx.dispatch === "function";
          },
        },
        handlerContext: {},
        executorContext: { dispatch: undefined as any },
      });

      loop.dispatch({ type: "test" });

      expect(dispatchAvailable).toBe(true);
    });

    test("should allow circular dispatch from executors", () => {
      type Events = { type: "start" } | { type: "next"; count: number };
      type Effects = { type: "dispatch"; event: Events } | { type: "done" };
      type State = void;
      type HCtx = {};
      type ECtx = { dispatch: (e: Events) => void };

      const createEventLoop = emergentSystem<
        Events,
        Effects,
        State,
        HCtx,
        ECtx
      >();

      const executionLog: string[] = [];

      const loop = createEventLoop({
        getState: () => undefined,
        handlers: {
          start: () => {
            executionLog.push("start");
            return [{ type: "dispatch", event: { type: "next", count: 1 } }];
          },
          next: (_state, event) => {
            executionLog.push(`next:${event.count}`);
            if (event.count < 3) {
              return [
                {
                  type: "dispatch",
                  event: { type: "next", count: event.count + 1 },
                },
              ];
            }
            return [{ type: "done" }];
          },
        },
        executor: {
          dispatch: (effect, ctx) => {
            ctx.dispatch(effect.event);
          },
          done: () => {
            executionLog.push("done");
          },
        },
        handlerContext: {},
        executorContext: { dispatch: undefined as any },
      });

      loop.dispatch({ type: "start" });

      expect(executionLog).toEqual([
        "start",
        "next:1",
        "next:2",
        "next:3",
        "done",
      ]);
    });
  });

  describe("Dispose", () => {
    test("should have dispose method", () => {
      type Events = { type: "test" };
      type Effects = { type: "effect" };
      type State = void;
      type HCtx = {};
      type ECtx = { dispatch: (e: Events) => void };

      const createEventLoop = emergentSystem<
        Events,
        Effects,
        State,
        HCtx,
        ECtx
      >();

      const loop = createEventLoop({
        getState: () => undefined,
        handlers: { test: () => [{ type: "effect" }] },
        executor: { effect: () => {} },
        handlerContext: {},
        executorContext: { dispatch: undefined as any },
      });

      expect(typeof loop.dispose).toBe("function");
      expect(() => loop.dispose()).not.toThrow();
    });
  });

  describe("Type inference", () => {
    test("should infer event types correctly", () => {
      type Events = { type: "increment" } | { type: "set"; value: number };
      type Effects = { type: "log" };
      type State = { count: number };
      type HCtx = {};
      type ECtx = { dispatch: (e: Events) => void };

      const createEventLoop = emergentSystem<
        Events,
        Effects,
        State,
        HCtx,
        ECtx
      >();

      const loop = createEventLoop({
        getState: () => ({ count: 0 }),
        handlers: {
          increment: (state) => {
            // TypeScript should know state is State
            const _count: number = state.count;
            return [{ type: "log" }];
          },
          set: (_state, event) => {
            // TypeScript should know event has value property
            const _value: number = event.value;
            return [{ type: "log" }];
          },
        },
        executor: { log: () => {} },
        handlerContext: {},
        executorContext: { dispatch: undefined as any },
      });

      // These should type-check
      loop.dispatch({ type: "increment" });
      loop.dispatch({ type: "set", value: 42 });

      // This should be a type error (but we can't test that at runtime)
      // loop.dispatch({ type: 'invalid' })
    });
  });

  describe("Subscription system", () => {
    test("should notify listeners when events are dispatched", () => {
      type Events = { type: "test"; value: number };
      type Effects = { type: "log"; message: string };
      type State = void;
      type HCtx = {};
      type ECtx = { dispatch: (e: Events) => void };

      const createEventLoop = emergentSystem<
        Events,
        Effects,
        State,
        HCtx,
        ECtx
      >();

      const loop = createEventLoop({
        getState: () => undefined,
        handlers: {
          test: (_state, event) => [
            { type: "log", message: `Value: ${event.value}` },
          ],
        },
        executor: { log: () => {} },
        handlerContext: {},
        executorContext: { dispatch: undefined as any },
      });

      const listener = vi.fn();
      loop.subscribe(listener);

      loop.dispatch({ type: "test", value: 42 });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith({ type: "test", value: 42 }, [
        { type: "log", message: "Value: 42" },
      ]);
    });

    test("should support multiple listeners", () => {
      type Events = { type: "test" };
      type Effects = { type: "effect" };
      type State = void;
      type HCtx = {};
      type ECtx = { dispatch: (e: Events) => void };

      const createEventLoop = emergentSystem<
        Events,
        Effects,
        State,
        HCtx,
        ECtx
      >();

      const loop = createEventLoop({
        getState: () => undefined,
        handlers: { test: () => [{ type: "effect" }] },
        executor: { effect: () => {} },
        handlerContext: {},
        executorContext: { dispatch: undefined as any },
      });

      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      loop.subscribe(listener1);
      loop.subscribe(listener2);
      loop.subscribe(listener3);

      loop.dispatch({ type: "test" });

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
      expect(listener3).toHaveBeenCalledTimes(1);
    });

    test("should allow unsubscribing", () => {
      type Events = { type: "test" };
      type Effects = { type: "effect" };
      type State = void;
      type HCtx = {};
      type ECtx = { dispatch: (e: Events) => void };

      const createEventLoop = emergentSystem<
        Events,
        Effects,
        State,
        HCtx,
        ECtx
      >();

      const loop = createEventLoop({
        getState: () => undefined,
        handlers: { test: () => [{ type: "effect" }] },
        executor: { effect: () => {} },
        handlerContext: {},
        executorContext: { dispatch: undefined as any },
      });

      const listener = vi.fn();
      const unsubscribe = loop.subscribe(listener);

      loop.dispatch({ type: "test" });
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      loop.dispatch({ type: "test" });
      // Should still be 1, not 2
      expect(listener).toHaveBeenCalledTimes(1);
    });

    test("should notify listeners before effects are executed", () => {
      type Events = { type: "test" };
      type Effects = { type: "mutate" };
      type State = { value: number };
      type HCtx = {};
      type ECtx = {
        setState: (s: State) => void;
        dispatch: (e: Events) => void;
      };

      const createEventLoop = emergentSystem<
        Events,
        Effects,
        State,
        HCtx,
        ECtx
      >();

      let state: State = { value: 0 };
      const executionOrder: string[] = [];

      const loop = createEventLoop({
        getState: () => state,
        handlers: { test: () => [{ type: "mutate" }] },
        executor: {
          mutate: (_effect, ctx) => {
            executionOrder.push("executor");
            ctx.setState({ value: 999 });
          },
        },
        handlerContext: {},
        executorContext: {
          setState: (s) => {
            state = s;
          },
          dispatch: undefined as any,
        },
      });

      loop.subscribe(() => {
        executionOrder.push("listener");
      });

      loop.dispatch({ type: "test" });

      // Listener should be called before executor
      expect(executionOrder).toEqual(["listener", "executor"]);
    });

    test("should handle listener errors without breaking event loop", () => {
      type Events = { type: "test" };
      type Effects = { type: "effect" };
      type State = void;
      type HCtx = {};
      type ECtx = { dispatch: (e: Events) => void };

      const createEventLoop = emergentSystem<
        Events,
        Effects,
        State,
        HCtx,
        ECtx
      >();

      const errorHandler = vi.fn();
      const executor = vi.fn();

      const loop = createEventLoop({
        getState: () => undefined,
        handlers: { test: () => [{ type: "effect" }] },
        executor: { effect: executor },
        handlerContext: {},
        executorContext: { dispatch: undefined as any },
        onListenerError: errorHandler,
      });

      const badListener = vi.fn(() => {
        throw new Error("Listener error!");
      });
      const goodListener = vi.fn();

      loop.subscribe(badListener);
      loop.subscribe(goodListener);

      loop.dispatch({ type: "test" });

      // Error handler should be called
      expect(errorHandler).toHaveBeenCalledTimes(1);
      expect(errorHandler).toHaveBeenCalledWith(
        expect.any(Error),
        { type: "test" },
        [{ type: "effect" }]
      );

      // Good listener should still be called
      expect(goodListener).toHaveBeenCalledTimes(1);

      // Executor should still run
      expect(executor).toHaveBeenCalledTimes(1);
    });

    test("should clear all listeners on dispose", () => {
      type Events = { type: "test" };
      type Effects = { type: "effect" };
      type State = void;
      type HCtx = {};
      type ECtx = { dispatch: (e: Events) => void };

      const createEventLoop = emergentSystem<
        Events,
        Effects,
        State,
        HCtx,
        ECtx
      >();

      const loop = createEventLoop({
        getState: () => undefined,
        handlers: { test: () => [{ type: "effect" }] },
        executor: { effect: () => {} },
        handlerContext: {},
        executorContext: { dispatch: undefined as any },
      });

      const listener1 = vi.fn();
      const listener2 = vi.fn();

      loop.subscribe(listener1);
      loop.subscribe(listener2);

      loop.dispose();

      loop.dispatch({ type: "test" });

      // Listeners should not be called after dispose
      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
    });

    test("should allow observing event/effect patterns", () => {
      type Events =
        | { type: "increment" }
        | { type: "decrement" }
        | { type: "reset" };
      type Effects =
        | { type: "state:update"; value: number }
        | { type: "log"; message: string };
      type State = { count: number };
      type HCtx = {};
      type ECtx = { dispatch: (e: Events) => void };

      const createEventLoop = emergentSystem<
        Events,
        Effects,
        State,
        HCtx,
        ECtx
      >();

      let state: State = { count: 0 };

      const loop = createEventLoop({
        getState: () => state,
        handlers: {
          increment: (s) => [
            { type: "state:update", value: s.count + 1 },
            { type: "log", message: "Incremented" },
          ],
          decrement: (s) => [
            { type: "state:update", value: s.count - 1 },
            { type: "log", message: "Decremented" },
          ],
          reset: () => [
            { type: "state:update", value: 0 },
            { type: "log", message: "Reset" },
          ],
        },
        executor: {
          "state:update": (effect) => {
            state = { count: effect.value };
          },
          log: () => {},
        },
        handlerContext: {},
        executorContext: { dispatch: undefined as any },
      });

      // Track all events and effects
      const eventLog: Array<{ event: Events; effects: Effects[] }> = [];

      loop.subscribe((event, effects) => {
        eventLog.push({ event, effects });
      });

      loop.dispatch({ type: "increment" });
      loop.dispatch({ type: "increment" });
      loop.dispatch({ type: "decrement" });
      loop.dispatch({ type: "reset" });

      expect(eventLog).toHaveLength(4);
      expect(eventLog[0].event.type).toBe("increment");
      expect(eventLog[0].effects).toHaveLength(2);
      expect(eventLog[3].event.type).toBe("reset");
    });
  });

  describe("Error handling", () => {
    test("should call onExecutorError for synchronous executor errors", () => {
      type Events = { type: "test" };
      type Effects = { type: "failing-effect" };
      type State = void;
      type HCtx = {};
      type ECtx = {};

      const createEventLoop = emergentSystem<
        Events,
        Effects,
        State,
        HCtx,
        ECtx
      >();

      const errorHandler = vi.fn();
      const testError = new Error("Sync executor error");

      const loop = createEventLoop({
        getState: () => undefined,
        handlers: { test: () => [{ type: "failing-effect" }] },
        executor: {
          "failing-effect": () => {
            throw testError;
          },
        },
        handlerContext: {},
        executorContext: {},
        onExecutorError: errorHandler,
      });

      loop.dispatch({ type: "test" });

      expect(errorHandler).toHaveBeenCalledTimes(1);
      expect(errorHandler).toHaveBeenCalledWith(
        testError,
        { type: "failing-effect" },
        { type: "test" }
      );
    });

    test("should re-throw synchronous executor errors if no handler provided", () => {
      type Events = { type: "test" };
      type Effects = { type: "failing-effect" };
      type State = void;
      type HCtx = {};
      type ECtx = {};

      const createEventLoop = emergentSystem<
        Events,
        Effects,
        State,
        HCtx,
        ECtx
      >();

      const testError = new Error("Sync executor error");

      const loop = createEventLoop({
        getState: () => undefined,
        handlers: { test: () => [{ type: "failing-effect" }] },
        executor: {
          "failing-effect": () => {
            throw testError;
          },
        },
        handlerContext: {},
        executorContext: {},
        // No onExecutorError provided
      });

      expect(() => loop.dispatch({ type: "test" })).toThrow(testError);
    });

    test("should call onExecutorError for asynchronous executor errors", async () => {
      type Events = { type: "test" };
      type Effects = { type: "async-failing-effect" };
      type State = void;
      type HCtx = {};
      type ECtx = {};

      const createEventLoop = emergentSystem<
        Events,
        Effects,
        State,
        HCtx,
        ECtx
      >();

      const errorHandler = vi.fn();
      const testError = new Error("Async executor error");

      const loop = createEventLoop({
        getState: () => undefined,
        handlers: { test: () => [{ type: "async-failing-effect" }] },
        executor: {
          "async-failing-effect": async () => {
            throw testError;
          },
        },
        handlerContext: {},
        executorContext: {},
        onExecutorError: errorHandler,
      });

      loop.dispatch({ type: "test" });

      // Wait for async error to be caught
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(errorHandler).toHaveBeenCalledTimes(1);
      expect(errorHandler).toHaveBeenCalledWith(
        testError,
        { type: "async-failing-effect" },
        { type: "test" }
      );
    });

    test("should log async executor errors to console if no handler provided", async () => {
      type Events = { type: "test" };
      type Effects = { type: "async-failing-effect" };
      type State = void;
      type HCtx = {};
      type ECtx = {};

      const createEventLoop = emergentSystem<
        Events,
        Effects,
        State,
        HCtx,
        ECtx
      >();

      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const testError = new Error("Async executor error");

      const loop = createEventLoop({
        getState: () => undefined,
        handlers: { test: () => [{ type: "async-failing-effect" }] },
        executor: {
          "async-failing-effect": async () => {
            throw testError;
          },
        },
        handlerContext: {},
        executorContext: {},
        // No onExecutorError provided
      });

      loop.dispatch({ type: "test" });

      // Wait for async error to be caught
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Unhandled async error in executor"),
        testError
      );

      consoleErrorSpy.mockRestore();
    });

    test("should continue processing effects after executor error with handler", () => {
      type Events = { type: "test" };
      type Effects =
        | { type: "effect1" }
        | { type: "failing-effect" }
        | { type: "effect2" };
      type State = void;
      type HCtx = {};
      type ECtx = {};

      const createEventLoop = emergentSystem<
        Events,
        Effects,
        State,
        HCtx,
        ECtx
      >();

      const errorHandler = vi.fn();
      const executor1 = vi.fn();
      const executor2 = vi.fn();

      const loop = createEventLoop({
        getState: () => undefined,
        handlers: {
          test: () => [
            { type: "effect1" },
            { type: "failing-effect" },
            { type: "effect2" },
          ],
        },
        executor: {
          effect1: executor1,
          "failing-effect": () => {
            throw new Error("Failed");
          },
          effect2: executor2,
        },
        handlerContext: {},
        executorContext: {},
        onExecutorError: errorHandler,
      });

      loop.dispatch({ type: "test" });

      // All executors should be called
      expect(executor1).toHaveBeenCalledTimes(1);
      expect(errorHandler).toHaveBeenCalledTimes(1);
      expect(executor2).toHaveBeenCalledTimes(1);
    });
  });
});
