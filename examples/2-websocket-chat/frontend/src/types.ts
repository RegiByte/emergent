/**
 * WebSocket Chat - Type Definitions
 * 
 * This file defines all the types for our chat app:
 * - Chat events (what can happen)
 * - Chat effects (what to do about it)
 * - Chat state (current snapshot)
 */

// ============================================
// Chat Events (Causes)
// ============================================

export type ChatEvent =
  | { type: 'user:joined'; userId: string; userName: string; joinedAt: number }
  | { type: 'user:left'; userId: string; userName: string }
  | { type: 'message:send'; content: string }
  | { type: 'message:received'; message: Message }
  | { type: 'message:react'; messageId: string; emoji: string }
  | { type: 'message:reaction-updated'; messageId: string; emoji: string; userId: string }
  | { type: 'typing:start' }
  | { type: 'typing:stop' }
  | { type: 'typing:user-started'; userId: string; userName: string }
  | { type: 'typing:user-stopped'; userId: string }

// ============================================
// Chat Effects (Consequences)
// ============================================

export type ChatEffect =
  | { type: 'state:update'; state: Partial<ChatState> }
  | { type: 'transport:send'; event: string; payload: unknown }

// ============================================
// Chat State
// ============================================

export type User = {
  id: string
  name: string
  joinedAt: number
}

export type Message = {
  id: string
  userId: string
  userName: string
  content: string
  timestamp: number
  reactions: Record<string, string[]> // emoji -> userIds[]
}

export type ChatState = {
  roomId: string | null
  userId: string | null
  users: User[]
  messages: Message[]
  typingUsers: Set<string> // userIds currently typing
  connected: boolean
}

// ============================================
// Transport Protocol (Socket.IO events)
// ============================================

export type ServerToClientEvents = {
  'user:joined': (data: { userId: string; userName: string; joinedAt: number }) => void
  'user:left': (data: { userId: string; userName: string }) => void
  'message:received': (message: Message) => void
  'message:reaction-updated': (data: { messageId: string; emoji: string; userId: string }) => void
  'typing:user-started': (data: { userId: string; userName: string }) => void
  'typing:user-stopped': (data: { userId: string }) => void
}

export type ClientToServerEvents = {
  'room:create': (data: { userName: string }, callback: (response: AckResponse<RoomJoinData>) => void) => void
  'room:join': (data: { roomId: string; userName: string }, callback: (response: AckResponse<RoomJoinData>) => void) => void
  'room:leave': () => void
  'message:send': (data: { content: string }, callback: (response: AckResponse<{ messageId: string }>) => void) => void
  'message:react': (data: { messageId: string; emoji: string }, callback: (response: AckResponse<{}>) => void) => void
  'typing:start': () => void
  'typing:stop': () => void
}

export type AckResponse<T> = { ok: true; data: T } | { ok: false; error: string }

export type RoomJoinData = {
  roomId: string
  userId: string
  room: {
    id: string
    users: User[]
    messages: Message[]
  }
}
