/**
 * Multiplayer Buzzer - Type Definitions
 * 
 * This file defines all the types for our buzzer game:
 * - Game events (what can happen)
 * - Game effects (what to do about it)
 * - Game state (current snapshot)
 */

// ============================================
// Game Events (Causes)
// ============================================

export type GameEvent =
  | { type: 'game:start' }
  | { type: 'game:reset' }
  | { type: 'countdown:tick' }
  | { type: 'countdown:complete' }
  | { type: 'player:joined'; playerId: string; playerName: string }
  | { type: 'player:left'; playerId: string }
  | { type: 'player:buzz'; playerId: string; timestamp: number; offset: number }
  | { type: 'buzzer:determined'; winnerId: string; winnerName: string }
  | { type: 'clock:sync-request'; playerId: string }
  | { type: 'clock:sync-response'; playerId: string; serverTime: number }

// ============================================
// Game Effects (Consequences)
// ============================================

export type GameEffect =
  | { type: 'state:update'; snapshot: GameSnapshot }
  | { type: 'transport:broadcast'; payload: unknown }
  | { type: 'transport:send'; playerId: string; payload: unknown }
  | { type: 'clock:sync'; playerId: string }
  | { type: 'timer:schedule'; timerId: string; delayMs: number; event: GameEvent }

// ============================================
// Game State
// ============================================

export type GamePhase = 'lobby' | 'countdown' | 'ready' | 'buzzing' | 'result'

export type Player = {
  id: string
  name: string
  clockOffset: number // ms offset from host clock
  lastSyncAt: number
}

export type BuzzSubmission = {
  playerId: string
  playerName: string
  localTimestamp: number
  offset: number
  compensatedTime: number // localTimestamp + offset = host time
}

export type GameSnapshot = {
  phase: GamePhase
  players: Map<string, Player>
  buzzSubmissions: BuzzSubmission[]
  winner: { playerId: string; playerName: string } | null
  buzzWindowStartedAt: number | null
  countdownValue: number | null // 3, 2, 1, or null
}

// ============================================
// Transport Protocol
// ============================================

export type TransportMessage =
  | { type: 'snapshot'; snapshot: SerializedGameSnapshot }
  | { type: 'clock-sync-ping'; serverTime: number }
  | { type: 'clock-sync-pong'; clientTime: number; serverTime: number }

// Serialized version (Map → Object)
export type SerializedGameSnapshot = Omit<GameSnapshot, 'players'> & {
  players: Record<string, Player>
}

