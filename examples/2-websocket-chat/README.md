# WebSocket Chat

A real-time chat application demonstrating the **Observer Pattern** with React.

## What It Demonstrates

1. **Event-Driven Architecture (Emergent)**
   - Event → Handler (pure) → Effects → Executor (impure)
   - Pure handlers for testability
   - Effects as data for inspectability

2. **Resource Management (Braided)**
   - Runtime store resource
   - Chat runtime resource  
   - Transport resource
   - Deterministic lifecycle management

3. **Observer Pattern (Z-Axis)**
   - Chat system lives in closure space (Z-axis)
   - React observes through hooks (X-Y plane)
   - No props drilling, direct observation
   - Framework-agnostic architecture

4. **Real-Time Communication**
   - WebSocket-powered messaging (Socket.IO)
   - Message history
   - Emoji reactions
   - Typing indicators
   - User presence

5. **Simpler Than Multiplayer Buzzer**
   - No WebRTC complexity
   - No clock synchronization
   - Server-mediated (not peer-to-peer)
   - Perfect bridge between vanilla examples and complex ones

## Quick Start

```bash
# Install dependencies
npm install

# Run both backend and frontend
npm run dev

# Backend will run on http://localhost:8000
# Frontend will run on http://localhost:3000
```

## How to Use

1. Open http://localhost:3000
2. **Create a room** or **Join a room** with a code
3. Enter your name
4. Start chatting!

Open multiple browser windows to test real-time messaging.

## Architecture

### Backend (Node.js + Braided)
```
Braided Resources
  ├── Express App
  ├── HTTP Server
  ├── Room Store (in-memory)
  └── Socket.IO Server
```

### Frontend (React + Emergent + Braided)
```
Braided Resources
  ├── Runtime Store (Zustand)
  ├── Chat Runtime (Emergent)
  │   ├── Event handlers (pure)
  │   └── Effect executors (impure)
  └── Transport (Socket.IO client)

React (Observer)
  └── ChatRoom component
      ├── Observes runtime store
      └── Dispatches events
```

### The Observer Pattern (Z-Axis)
```
     React Tree (X-Y plane)
     ┌─────────────┐
     │  ChatRoom   │
     │      ↓      │
     │  useStore() │ ← Window to Z-axis
     └─────────────┘
          ↕ (observes)
    ═══════════════════════════
     Closure Space (Z-axis)
     ┌─────────────┐
     │   Store     │
     │   (State)   │
     └─────────────┘
          ↕
     ┌─────────────┐
     │  Runtime    │
     │ (Emergent)  │
     └─────────────┘
          ↕
     ┌─────────────┐
     │  Transport  │
     │ (Socket.IO) │
     └─────────────┘
```

## Key Files

### Backend
- `backend/src/server.ts` - Braided resources + Socket.IO events

### Frontend
- `frontend/src/types.ts` - Type definitions (events, effects, state)
- `frontend/src/system/runtime.ts` - Emergent runtime (pure handlers)
- `frontend/src/system/transport.ts` - Socket.IO client wrapper
- `frontend/src/system/system.ts` - Braided resource wiring
- `frontend/src/ChatRoom.tsx` - React component (observer)
- `frontend/src/App.tsx` - App shell + routing

## Features

- ✅ Create/join rooms
- ✅ Real-time messaging
- ✅ Message history (last 100 messages)
- ✅ Emoji reactions (toggle on/off)
- ✅ Typing indicators
- ✅ User presence (online list)
- ✅ Auto-scroll to latest message
- ✅ Beautiful teal/cyan gradient UI 🌊
- ✅ Responsive design

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Zustand, Socket.IO Client
- **Backend**: Node.js, Express, Socket.IO, TypeScript
- **Libraries**: Emergent (events), Braided (resources)
- **Styling**: CSS (custom, no frameworks)

## Comparison to Multiplayer Buzzer

| Feature | Chat | Buzzer |
|---------|------|--------|
| Transport | WebSocket (Socket.IO) | WebRTC (peer-to-peer) |
| Complexity | ~500 lines | ~1500 lines |
| Clock Sync | Not needed | Required (±5-15ms) |
| Server Role | Mediates all messages | Signaling only |
| Best For | Learning the pattern | Production showcase |

## What's Next

This example can be extended with:
- Scheduled messages (timer integration)
- Sound notifications
- File sharing
- Private messages
- Rooms list
- Persistent storage (database)
- Authentication

## License

MIT
