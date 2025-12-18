/**
 * Emergent - Complex Behavior from Simple Rules
 *
 * A minimal, type-safe library for event-driven systems where sophisticated
 * patterns emerge naturally from simple handlers. No central governor needed.
 */

/**
 * Expand - Utility type that forces TypeScript to expand type aliases
 * This makes hover tooltips show the full type definition instead of just the alias name
 *
 * We use a simple intersection with an empty object to trigger type expansion
 * without breaking function types or other special types.
 */
type Expand<T> = T extends (...args: any[]) => any
  ? T
  : T extends object
  ? { [K in keyof T]: T[K] } & {}
  : T;

/**
 * Handler - Pure function that computes effects from events
 *
 * Handlers are the simple rules from which complex behavior emerges.
 * They transform causes (events) into consequences (effects) without side effects.
 *
 * @param state - Current state snapshot
 * @param event - The event that triggered this handler (the cause)
 * @param context - Handler context (pure utilities, domain data)
 * @returns Array of effects to execute (the consequences)
 */
export type Handler<TEvent, TEffect, TState, TContext> = (
  state: TState,
  event: TEvent,
  context: Expand<TContext>
) => TEffect[];

/**
 * Executor - Function that performs side effects
 *
 * Executors interpret effects and perform the actual side effects.
 * This is where emergence becomes reality - where data becomes action.
 *
 * @param effect - The effect to execute (what emerged from the handler)
 * @param context - Executor context (side effect utilities, resources)
 */
export type Executor<TEffect, TContext> = (
  effect: TEffect,
  context: Expand<TContext>
) => void | Promise<void>;

/**
 * EventLoopListener - Function called after each event is handled
 *
 * Listeners allow you to observe emergence in real-time. They are notified
 * after the handler runs but before effects are executed, letting you watch
 * the cause → effect transformation as it happens.
 *
 * @param event - The event that was dispatched (the cause)
 * @param effects - The effects that emerged from the handler (the consequences)
 *
 * @example
 * ```typescript
 * // Watch patterns emerge
 * loop.subscribe((event, effects) => {
 *   console.log('Event:', event.type)
 *   console.log('Effects emerged:', effects.map(e => e.type))
 * })
 * ```
 */
export type EventLoopListener<TEvents, TEffects> = (
  event: TEvents,
  effects: TEffects[]
) => void;

/**
 * EventLoop - The event loop instance
 */
export type EventLoop<TEvent, TEffect> = {
  dispose: () => void;
  dispatch: (event: TEvent) => void;
  subscribe: (listener: EventLoopListener<TEvent, TEffect>) => () => void;
  handleEvent: (event: TEvent) => TEffect[];
  executeEffects: (effects: TEffect[], sourceEvent: TEvent) => Promise<void>;
};

/**
 * EventHandlerMap - Utility type for mapping event types to handler functions with type safety
 */

export type EventHandlerMap<
  TEvents extends { type: string },
  TEffects,
  TState,
  TContext
> = {
  [K in TEvents["type"]]: Handler<
    Extract<TEvents, { type: K }>,
    TEffects,
    TState,
    TContext
  >;
};

type DispatchFn<TEvents extends { type: string }> = (event: TEvents) => void;

/**
 * EffectExecutorMap - Primary helper type for mapping effect types to executor functions
 *
 * This is the recommended type for defining executors. It automatically includes dispatch
 * in the executor context, so you can call ctx.dispatch() without additional type annotations.
 *
 * @example
 * ```typescript
 * const executor = {
 *   'my-effect': (effect, ctx) => {
 *     ctx.dispatch({ type: 'next-event' }) // ✅ dispatch is available
 *   }
 * } satisfies EffectExecutorMap<MyEffects, MyEvents, MyExecutorContext>
 * ```
 */
export type EffectExecutorMap<
  TEffects extends { type: string },
  TEvents extends { type: string },
  TContext
> = {
  [K in TEffects["type"]]: Executor<
    Extract<TEffects, { type: K }>,
    TContext & { dispatch: DispatchFn<TEvents> }
  >;
};

/**
 * EffectExecutorMapBase - Advanced type for executors without automatic dispatch injection
 *
 * Use this only in advanced scenarios where you don't need dispatch in your executors.
 * Most users should use EffectExecutorMap instead.
 *
 * @example
 * ```typescript
 * const executor = {
 *   'log': (effect, ctx) => {
 *     ctx.logger.log(effect.message) // No dispatch available
 *   }
 * } satisfies EffectExecutorMapBase<MyEffects, MyExecutorContext>
 * ```
 */
export type EffectExecutorMapBase<
  TEffects extends { type: string },
  TContext
> = {
  [K in TEffects["type"]]: Executor<Extract<TEffects, { type: K }>, TContext>;
};

/**
 * Configuration for creating an event loop
 */
export type EventLoopConfig<
  TEvents extends { type: string },
  TEffects extends { type: string },
  TState,
  THandlerContext,
  TExecutorContext
> = {
  // function to get current state
  getState: () => TState;
  // plain map of event type to handler function
  handlers: EventHandlerMap<TEvents, TEffects, TState, THandlerContext>;
  // plain map of effect type to executor function
  executors: EffectExecutorMap<TEffects, TEvents, TExecutorContext>;
  // context available to handlers (pure utilities, domain data)
  handlerContext: THandlerContext;
  // context available to executors (side effect utilities, resources)
  executorContext: TExecutorContext;
  // hook to cleanup resources or persist state
  onDispose?: () => void;
  onHandlerNotFound?: (event: TEvents) => void;
  onExecutorNotFound?: (event: TEvents, effect: TEffects) => void;
  // hook called when a listener throws an error, this prevents the error from breaking the event loop
  onListenerError?: (
    error: unknown,
    event: TEvents,
    effects: TEffects[]
  ) => void;
  // hook called when an executor throws an error (sync or async)
  // if not provided, sync errors will crash the event loop (fail-fast)
  // and async errors will be logged to console
  onExecutorError?: (error: unknown, effect: TEffects, event: TEvents) => void;
};

/**
 * Creates a typed event system factory
 *
 * This is where you define the simple rules from which your application's
 * behavior will emerge. Define your events, effects, and contexts, and
 * watch complex patterns arise naturally.
 *
 * @example
 * ```typescript
 * const createEventLoop = emergentSystem<
 *   MyEvents,    // What can happen (causes)
 *   MyEffects,   // What to do (consequences)
 *   MyState,     // Current state
 *   HandlerContext,   // Pure utilities
 *   ExecutorContext   // Side effect resources
 * >()
 * ```
 */
export function emergentSystem<
  TEvents extends { type: string },
  TEffects extends { type: string },
  TState,
  THandlerContext,
  TExecutorContext
>() {
  return (
    config: EventLoopConfig<
      TEvents,
      TEffects,
      TState,
      THandlerContext,
      TExecutorContext
    >
  ): EventLoop<TEvents, TEffects> => {
      // Subscription system - track listeners
      const listeners = new Set<EventLoopListener<TEvents, TEffects>>();

      // Clone executor context and inject dispatch (avoid mutating user's object)
      const executorContext = {
        ...config.executorContext,
      } as TExecutorContext & {
        dispatch: DispatchFn<TEvents>;
      };

      /**
       * handleEvent - Pure phase: looks up handler and computes effects
       * 
       * This function is pure (no side effects) and testable in isolation.
       * It takes an event, finds the appropriate handler, gets current state,
       * and computes what effects should emerge.
       * 
       * @param event - The event to handle
       * @returns Array of effects that emerged from the handler
       */
      const handleEvent = (event: TEvents): TEffects[] => {
        // 1. Look up handler
        const handler = config.handlers[event.type as TEvents["type"]];
        if (!handler) {
          config.onHandlerNotFound?.(event);
          return [];
        }

        // 2. Get current state
        const currentState = config.getState();

        // 3. Execute handler (pure) - compute effects (what should we do about it?)
        const effects = handler(
          currentState,
          event as Extract<TEvents, { type: typeof event.type }>,
          config.handlerContext as Expand<THandlerContext>
        );

        return effects;
      };

      /**
       * executeEffects - Impure phase: executes side effects
       * 
       * This function executes effects sequentially, awaiting each one.
       * Returns a promise that resolves when all effects complete.
       * Use this in tests when you need to wait for effects to finish.
       * 
       * @param effects - Array of effects to execute
       * @param sourceEvent - The event that caused these effects (for error reporting)
       * @returns Promise that resolves when all effects complete
       */
      const executeEffects = async (
        effects: TEffects[],
        sourceEvent: TEvents
      ): Promise<void> => {
        for (const effect of effects) {
          // 4. Look up executor
          const executor = config.executors[effect.type as TEffects["type"]];
          if (!executor) {
            config.onExecutorNotFound?.(sourceEvent, effect);
            continue;
          }

          try {
            // 5. Run executor function
            await executor(
              effect as Extract<TEffects, { type: typeof effect.type }>,
              executorContext as Expand<
                TExecutorContext & { dispatch: DispatchFn<TEvents> }
              >
            );
          } catch (error) {
            // Handle both sync and async errors
            if (config.onExecutorError) {
              config.onExecutorError(error, effect, sourceEvent);
            } else {
              // Re-throw to maintain fail-fast behavior
              throw error;
            }
          }
        }
      };

      /**
       * dispatch - Main interface: handles event and executes effects
       * 
       * This is the primary way to interact with the event loop in production.
       * It composes handleEvent (pure) and executeEffects (impure) in a
       * fire-and-forget manner. Effects execute asynchronously but dispatch
       * returns immediately.
       * 
       * @param event - The event to dispatch
       */
      const dispatch: DispatchFn<TEvents> = (event) => {
        // Phase 1: Pure computation (what effects should emerge?)
        const effects = handleEvent(event);

        // Phase 2: Notify listeners (after handler, before executors)
        listeners.forEach((listener) => {
          try {
            listener(event, effects);
          } catch (error) {
            // Don't let listener errors break the event loop
            config.onListenerError?.(error, event, effects);
          }
        });

        // Phase 3: Execute effects (fire-and-forget)
        executeEffects(effects, event).catch((error) => {
          // If we reach here, it means onExecutorError was not provided
          // and an error was thrown. Log it to prevent silent failure.
          console.error(
            `[Emergent] Unhandled error in effect execution for event '${event.type}':`,
            error
          );
        });
      };

      // Inject dispatch into executor context (localized mutation)
      executorContext.dispatch = dispatch;

      const subscribe = (listener: EventLoopListener<TEvents, TEffects>) => {
        listeners.add(listener);
        // Return unsubscribe function
        return () => {
          listeners.delete(listener);
        };
      };

      const dispose = () => {
        // Clean up all listeners
        listeners.clear();
        // Call user defined cleanup hook
        config.onDispose?.();
      };

      return {
        dispose,
        dispatch,
        subscribe,
        handleEvent,
        executeEffects,
      };
    };
}
