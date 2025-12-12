/**
 * Emergent - Public API
 *
 * Complex behavior from simple rules. A minimal, type-safe library
 * for event-driven systems where sophisticated patterns emerge naturally.
 */

export { emergentSystem } from "./core";
export type {
  Handler,
  Executor,
  EventLoop,
  EventHandlerMap,
  EventLoopConfig,
  EventLoopListener,
  EffectExecutorMap,
  EffectExecutorMapBase,
} from "./core";
