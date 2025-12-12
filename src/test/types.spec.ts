/**
 * Type tests for emergent
 *
 * These tests validate TypeScript type inference and type safety.
 * They run at compile-time and ensure the library's types work as expected.
 */

import { describe, test, expectTypeOf } from "vitest";
import {
  emergentSystem,
  EventHandlerMap,
  EffectExecutorMap,
  EffectExecutorMapBase,
  Handler,
  Executor,
  EventLoop,
} from "../core";

describe("Type inference and safety", () => {
  describe("Handler context inference", () => {
    test("should infer user-defined handler context properties", () => {
      type Events = { type: "test" };
      type Effects = { type: "effect" };
      type State = { count: number };
      type HCtx = {
        customHelper: () => string;
        domainData: { catalog: string[] };
      };
      type ECtx = { logger: { log: (msg: string) => void } };

      const createEventLoop = emergentSystem<
        Events,
        Effects,
        State,
        HCtx,
        ECtx
      >();

      const handlers = {
        test: (state, event, ctx) => {
          // Type test: ctx should have all user-defined properties
          expectTypeOf(ctx).toHaveProperty("customHelper");
          expectTypeOf(ctx).toHaveProperty("domainData");
          expectTypeOf(ctx.customHelper).toBeFunction();
          expectTypeOf(ctx.customHelper).returns.toBeString();
          expectTypeOf(ctx.domainData.catalog).toEqualTypeOf<string[]>();

          // Type test: state should be State
          expectTypeOf(state).toEqualTypeOf<State>();
          expectTypeOf(state.count).toBeNumber();

          // Type test: event should be the specific event type
          expectTypeOf(event).toEqualTypeOf<{ type: "test" }>();

          return [{ type: "effect" as const }];
        },
      } satisfies EventHandlerMap<Events, Effects, State, HCtx>;

      expectTypeOf(handlers.test).toBeFunction();
    });

    test("should work with void state (stateless)", () => {
      type Events = { type: "test" };
      type Effects = { type: "effect" };
      type State = void;
      type HCtx = {
        getCurrentTime: () => number;
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
          // Type test: state should be void
          expectTypeOf(state).toEqualTypeOf<void>();

          // Type test: ctx should have getCurrentTime
          expectTypeOf(ctx).toHaveProperty("getCurrentTime");
          expectTypeOf(ctx.getCurrentTime).returns.toBeNumber();

          return [];
        },
      } satisfies EventHandlerMap<Events, Effects, State, HCtx>;

      expectTypeOf(handlers.test).toBeFunction();
    });
  });

  describe("Executor context with dispatch injection", () => {
    test("should inject dispatch into executor context", () => {
      type Events = { type: "test" } | { type: "other" };
      type Effects = { type: "effect" };
      type State = void;
      type HCtx = {};
      type ECtx = {
        logger: { log: (msg: string) => void };
        customResource: { doSomething: () => void };
      };

      const createEventLoop = emergentSystem<
        Events,
        Effects,
        State,
        HCtx,
        ECtx
      >();

      const executor = {
        effect: (effect, ctx) => {
          // Type test: ctx should have dispatch injected
          expectTypeOf(ctx).toHaveProperty("dispatch");
          expectTypeOf(ctx.dispatch).toBeFunction();
          expectTypeOf(ctx.dispatch).parameter(0).toEqualTypeOf<Events>();

          // Type test: ctx should have user-defined properties
          expectTypeOf(ctx).toHaveProperty("logger");
          expectTypeOf(ctx).toHaveProperty("customResource");
          expectTypeOf(ctx.logger.log).toBeFunction();
          expectTypeOf(ctx.customResource.doSomething).toBeFunction();

          // Type test: effect should be the specific effect type
          expectTypeOf(effect).toEqualTypeOf<{ type: "effect" }>();
        },
      } satisfies EffectExecutorMap<Effects, Events, ECtx>;

      expectTypeOf(executor.effect).toBeFunction();
    });

    test("should allow dispatching events from executors", () => {
      type Events =
        | { type: "start" }
        | { type: "next"; count: number }
        | { type: "done" };
      type Effects = { type: "dispatch"; event: Events } | { type: "log" };
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

      const executor = {
        dispatch: (effect, ctx) => {
          // Type test: effect.event should be Events
          expectTypeOf(effect.event).toEqualTypeOf<Events>();

          // Type test: ctx.dispatch should accept Events
          expectTypeOf(ctx.dispatch).parameter(0).toEqualTypeOf<Events>();

          // These should all type-check
          ctx.dispatch({ type: "start" });
          ctx.dispatch({ type: "next", count: 42 });
          ctx.dispatch({ type: "done" });
          ctx.dispatch(effect.event);
        },
        log: () => {},
      } satisfies EffectExecutorMap<Effects, Events, ECtx>;

      expectTypeOf(executor.dispatch).toBeFunction();
    });
  });

  describe("Event discrimination", () => {
    test("should discriminate event types correctly", () => {
      type Events =
        | { type: "increment" }
        | { type: "decrement" }
        | { type: "set"; value: number }
        | { type: "reset"; to?: number };
      type Effects = { type: "log" };
      type State = { count: number };
      type HCtx = {};
      type ECtx = {};

      const createEventLoop = emergentSystem<
        Events,
        Effects,
        State,
        HCtx,
        ECtx
      >();

      const handlers = {
        increment: (state, event, ctx) => {
          // Type test: event should be discriminated to increment
          expectTypeOf(event).toEqualTypeOf<{ type: "increment" }>();
          // @ts-expect-error - value doesn't exist on increment event
          const _x = event.value;
          return [];
        },
        decrement: (state, event, ctx) => {
          expectTypeOf(event).toEqualTypeOf<{ type: "decrement" }>();
          return [];
        },
        set: (state, event, ctx) => {
          // Type test: event should have value property
          expectTypeOf(event).toEqualTypeOf<{ type: "set"; value: number }>();
          expectTypeOf(event.value).toBeNumber();
          return [];
        },
        reset: (state, event, ctx) => {
          // Type test: event should have optional to property
          expectTypeOf(event).toEqualTypeOf<{ type: "reset"; to?: number }>();
          expectTypeOf(event.to).toEqualTypeOf<number | undefined>();
          return [];
        },
      } satisfies EventHandlerMap<Events, Effects, State, HCtx>;

      expectTypeOf(handlers).toMatchTypeOf<Record<Events["type"], Function>>();
    });

    test("should discriminate effect types correctly", () => {
      type Events = { type: "test" };
      type Effects =
        | { type: "log"; message: string }
        | { type: "save"; data: { id: string; value: number } }
        | { type: "notify"; userId: string; text: string };
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

      const executor = {
        log: (effect, ctx) => {
          // Type test: effect should be discriminated to log
          expectTypeOf(effect).toEqualTypeOf<{
            type: "log";
            message: string;
          }>();
          expectTypeOf(effect.message).toBeString();
          // @ts-expect-error - data doesn't exist on log effect
          const _x = effect.data;
        },
        save: (effect, ctx) => {
          expectTypeOf(effect).toEqualTypeOf<{
            type: "save";
            data: { id: string; value: number };
          }>();
          expectTypeOf(effect.data.id).toBeString();
          expectTypeOf(effect.data.value).toBeNumber();
        },
        notify: (effect, ctx) => {
          expectTypeOf(effect).toEqualTypeOf<{
            type: "notify";
            userId: string;
            text: string;
          }>();
          expectTypeOf(effect.userId).toBeString();
          expectTypeOf(effect.text).toBeString();
        },
      } satisfies EffectExecutorMapBase<Effects, ECtx>;

      expectTypeOf(executor).toMatchTypeOf<Record<Effects["type"], Function>>();
    });
  });

  describe("EventHandlerMap exhaustiveness", () => {
    test("should enforce all event handlers are present", () => {
      type Events = { type: "a" } | { type: "b" } | { type: "c" };
      type Effects = { type: "effect" };
      type State = void;
      type HCtx = {};

      type Handlers = EventHandlerMap<Events, Effects, State, HCtx>;

      // This should type-check (all handlers present)
      const complete: Handlers = {
        a: () => [],
        b: () => [],
        c: () => [],
      };

      expectTypeOf(complete).toMatchObjectType<Handlers>();

      // @ts-expect-error - missing handler 'c'
      const incomplete: Handlers = {
        a: () => [],
        b: () => [],
      };
    });

    test("should allow Partial for modular handlers", () => {
      type Events = { type: "a" } | { type: "b" } | { type: "c" };
      type Effects = { type: "effect" };
      type State = void;
      type HCtx = {};

      type Handlers = EventHandlerMap<Events, Effects, State, HCtx>;
      type PartialHandlers = Partial<Handlers>;

      // This should type-check (partial handlers)
      const partial: PartialHandlers = {
        a: () => [],
        b: () => [],
      };

      expectTypeOf(partial).toMatchObjectType<PartialHandlers>();
    });
  });

  describe("EffectExecutorMapBase exhaustiveness", () => {
    test("should enforce all executors are present", () => {
      type Effects = { type: "log" } | { type: "save" } | { type: "notify" };
      type ECtx = {};

      type Executors = EffectExecutorMapBase<Effects, ECtx>;

      // This should type-check (all executors present)
      const complete: Executors = {
        log: () => {},
        save: () => {},
        notify: () => {},
      };

      expectTypeOf(complete).toMatchObjectType<Executors>();

      // @ts-expect-error - missing executor 'notify'
      const incomplete: Executors = {
        log: () => {},
        save: () => {},
      };
    });

    test("should allow Partial for modular executors", () => {
      type Effects = { type: "log" } | { type: "save" } | { type: "notify" };
      type ECtx = {};

      type Executors = EffectExecutorMapBase<Effects, ECtx>;
      type PartialExecutors = Partial<Executors>;

      // This should type-check (partial executors)
      const partial: PartialExecutors = {
        log: () => {},
        save: () => {},
      };

      expectTypeOf(partial).toMatchObjectType<PartialExecutors>();
    });
  });

  describe("EventLoop type", () => {
    test("should have correct dispatch signature", () => {
      type Events = { type: "increment" } | { type: "set"; value: number };
      type Effects = { type: "log" };
      type State = { count: number };
      type HCtx = {};
      type ECtx = {};

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
          increment: () => [{ type: "log" as const }],
          set: () => [{ type: "log" as const }],
        },
        executor: {
          log: () => {},
        },
        handlerContext: {},
        executorContext: {},
      });

      // Type test: loop should be EventLoop<Events>
      expectTypeOf(loop).toEqualTypeOf<EventLoop<Events, Effects>>();

      // Type test: dispatch should accept Events
      expectTypeOf(loop.dispatch).parameter(0).toEqualTypeOf<Events>();

      // Type test: dispose should be a function returning void
      expectTypeOf(loop.dispose).toBeFunction();
      expectTypeOf(loop.dispose).returns.toBeVoid();
    });

    test("should reject invalid event types", () => {
      type Events = { type: "valid" };
      type Effects = { type: "effect" };
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

      const loop = createEventLoop({
        getState: () => undefined,
        handlers: { valid: () => [] },
        executor: { effect: () => {} },
        handlerContext: {},
        executorContext: {},
      });

      // This should type-check
      loop.dispatch({ type: "valid" });

      // @ts-expect-error - invalid event type
      loop.dispatch({ type: "invalid" });
    });
  });

  describe("Core type exports", () => {
    test("Handler type should be correct", () => {
      type TestHandler = Handler<
        { type: "test"; data: string },
        { type: "effect"; result: number },
        { count: number },
        { helper: () => void }
      >;

      expectTypeOf<TestHandler>().toBeFunction();
      expectTypeOf<TestHandler>().parameters.toEqualTypeOf<
        [
          { count: number },
          { type: "test"; data: string },
          { helper: () => void }
        ]
      >();
      expectTypeOf<TestHandler>().returns.toEqualTypeOf<
        Array<{ type: "effect"; result: number }>
      >();
    });

    test("Executor type should be correct", () => {
      type TestExecutor = Executor<
        { type: "effect"; data: string },
        { logger: { log: (msg: string) => void }; dispatch: (e: any) => void }
      >;

      expectTypeOf<TestExecutor>().toBeFunction();
      expectTypeOf<TestExecutor>().parameters.toEqualTypeOf<
        [
          { type: "effect"; data: string },
          { logger: { log: (msg: string) => void }; dispatch: (e: any) => void }
        ]
      >();
      expectTypeOf<TestExecutor>().returns.toEqualTypeOf<void | Promise<void>>();
    });
  });

  describe("Complex real-world scenarios", () => {
    test("should handle nested effect dispatching", () => {
      type Events =
        | { type: "start" }
        | { type: "step"; n: number }
        | { type: "done" };
      type Effects =
        | { type: "dispatch"; event: Events }
        | { type: "log"; msg: string };
      type State = { steps: number };
      type HCtx = {};
      type ECtx = { logger: Console };

      const createEventLoop = emergentSystem<
        Events,
        Effects,
        State,
        HCtx,
        ECtx
      >();

      const handlers = {
        start: (state, event, ctx) => {
          expectTypeOf(event).toEqualTypeOf<{ type: "start" }>();
          return [
            {
              type: "dispatch" as const,
              event: { type: "step" as const, n: 1 },
            },
            { type: "log" as const, msg: "Started" },
          ];
        },
        step: (state, event, ctx) => {
          expectTypeOf(event).toEqualTypeOf<{ type: "step"; n: number }>();
          if (event.n < 3) {
            return [
              {
                type: "dispatch" as const,
                event: { type: "step" as const, n: event.n + 1 },
              },
            ];
          }
          return [
            { type: "dispatch" as const, event: { type: "done" as const } },
          ];
        },
        done: () => [{ type: "log" as const, msg: "Done" }],
      } satisfies EventHandlerMap<Events, Effects, State, HCtx>;

      const executor = {
        dispatch: (effect, ctx) => {
          expectTypeOf(effect.event).toEqualTypeOf<Events>();
          ctx.dispatch(effect.event);
        },
        log: (effect, ctx) => {
          ctx.logger.log(effect.msg);
        },
      } satisfies EffectExecutorMap<Effects, Events, ECtx>;

      expectTypeOf(handlers).toExtend<Record<Events["type"], Function>>();
      expectTypeOf(executor).toExtend<Record<Effects["type"], Function>>();
    });

    test("should handle async executors", () => {
      type Events = { type: "fetch"; url: string };
      type Effects =
        | { type: "http:get"; url: string }
        | { type: "dispatch"; event: Events };
      type State = void;
      type HCtx = {};
      type ECtx = { fetch: typeof fetch };

      const createEventLoop = emergentSystem<
        Events,
        Effects,
        State,
        HCtx,
        ECtx
      >();

      const executor = {
        "http:get": async (effect, ctx) => {
          // Type test: async executor should be valid
          expectTypeOf(effect).toEqualTypeOf<{
            type: "http:get";
            url: string;
          }>();
          const response = await ctx.fetch(effect.url);
          expectTypeOf(response).toEqualTypeOf<Response>();
        },
        dispatch: (effect, ctx) => {
          ctx.dispatch(effect.event);
        },
      } satisfies EffectExecutorMap<Effects, Events, ECtx>;

      expectTypeOf(executor["http:get"]).returns.toEqualTypeOf<Promise<void>>();
    });

    test("should work with complex state shapes", () => {
      type Events =
        | { type: "user:login"; userId: string }
        | { type: "user:logout" };
      type Effects = { type: "state:update"; updates: Partial<State> };
      type State = {
        user: { id: string; name: string } | null;
        isAuthenticated: boolean;
        sessionToken: string | null;
        lastActivity: number;
      };
      type HCtx = {
        produce: <T>(state: T, fn: (draft: T) => void) => T;
      };
      type ECtx = { setState: (state: State) => void };

      const createEventLoop = emergentSystem<
        Events,
        Effects,
        State,
        HCtx,
        ECtx
      >();

      const handlers = {
        "user:login": (state, event, ctx) => {
          expectTypeOf(state).toEqualTypeOf<State>();
          expectTypeOf(event).toEqualTypeOf<{
            type: "user:login";
            userId: string;
          }>();

          const nextState = ctx.produce(state, (draft) => {
            draft.isAuthenticated = true;
            draft.user = { id: event.userId, name: "Test" };
          });

          return [{ type: "state:update" as const, updates: nextState }];
        },
        "user:logout": (state, event, ctx) => {
          return [
            {
              type: "state:update" as const,
              updates: {
                user: null,
                isAuthenticated: false,
                sessionToken: null,
              },
            },
          ];
        },
      } satisfies EventHandlerMap<Events, Effects, State, HCtx>;

      expectTypeOf(handlers).toExtend<Record<Events["type"], Function>>();
    });
  });
});
