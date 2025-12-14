# Multiplayer Buzzer Game

A real-time multiplayer buzzer game with fair timing, built to demonstrate the **Observer Pattern** with Emergent and Braided.

## What It Demonstrates

- **Event-Driven Architecture** - Pure handlers, effects as data (Emergent)
- **Resource Management** - Deterministic lifecycle on frontend and backend (Braided)
- **Observer Pattern** - Systems in closures, React observes (Z-axis architecture)
- **Fair Timing** - Clock synchronization eliminates network latency (±5-15ms accuracy)
- **WebRTC Networking** - Peer-to-peer communication with signaling server

## Quick Start

```bash
# Install dependencies
npm install

# Run both backend and frontend
npm run dev
```

Then:
1. Open `http://localhost:3000` in browser 1 → **Host Game**
2. Open `http://localhost:3000` in browser 2 → **Join Game** (enter session code)
3. Click **Start Game** on host
4. Watch the countdown: **3... 2... 1... GO!**
5. Click **BUZZ** on player screens
6. Fastest player wins! 🎉

## Architecture

### The Observer Pattern (Z-Axis)

```
React Components (X-Y plane)
       ↓ observes
Zustand Store (Z-axis)
       ↓ updates
Game Runtime (Emergent)
       ↓ effects
Transport Layer (WebRTC)
```

**Key insight:** React doesn't own state, it observes it. Systems live in closures.

### Event Flow (Emergent)

```
Event → Handler (pure) → Effects → Executor (impure)
```

Example:
```typescript
// Event: Player buzzed
{ type: 'player:buzz', playerId: 'abc', timestamp: 123, offset: 5 }

// Handler: Pure function
(state, event) => [
  { type: 'state:update', snapshot: {...} },
  { type: 'transport:broadcast', payload: {...} }
]

// Executor: Side effects
'state:update': (effect) => store.setState(effect.snapshot)
'transport:broadcast': (effect) => channel.send(effect.payload)
```

### Resource Management (Braided)

**Backend:**
```
Express App → HTTP Server → Socket.IO → Signaling
```

**Frontend (Host):**
```
Zustand Store → Game Runtime → Transport → WebRTC
```

All resources start/halt in correct order with dependency resolution.

### Fair Timing

1. **Clock Sync** - 5 ping-pong exchanges, median offset calculation
2. **Compensated Timestamps** - `hostTime = localTime + offset`
3. **Winner Determination** - Earliest compensated timestamp wins

Same technique used in Valorant, Overwatch, and other competitive games.

## Code Structure

```
backend/
  src/server.ts          # Signaling server (Socket.IO)

frontend/src/
  App.tsx                # Role selection (Host/Player)
  HostScreen.tsx         # TV/big screen view
  PlayerScreen.tsx       # Phone/player view
  
  system/
    types.ts             # Game events, effects, state
    runtime.ts           # Event handlers (pure functions)
    system.ts            # Braided resource definitions
    clock-sync.ts        # Clock synchronization logic
    transport-host.ts    # WebRTC host (broadcasts state)
    transport-player.ts  # WebRTC player (receives state)
```

### Key Files to Read

**Start here:**
1. `types.ts` - Understand the domain (events, effects, state)
2. `runtime.ts` - See pure event handlers in action
3. `system.ts` - See resource lifecycle management
4. `HostScreen.tsx` - See React observing the system

**Deep dives:**
- `clock-sync.ts` - Fair timing implementation
- `transport-host.ts` - WebRTC + Emergent integration
- `transport-player.ts` - Lightweight client

## Features

- ✅ **Countdown** - Dramatic 3-2-1-GO! before buzzing
- ✅ **Fair Timing** - Network latency eliminated via clock sync
- ✅ **Real-time Updates** - All players see state changes instantly
- ✅ **Multiple Rounds** - Reset and play again
- ✅ **Beautiful UI** - Gradients, animations, responsive design

## Known Limitations

### Connection Stability
WebRTC peer-to-peer connections may occasionally drop due to network changes, NAT traversal, or firewall restrictions.

**Workaround:** Refresh the page to reconnect.

**Future Enhancement:** Automatic reconnection with exponential backoff.

## Tech Stack

- **Frontend:** React, TypeScript, Vite
- **Backend:** Node.js, Express, Socket.IO
- **Libraries:** Emergent (events), Braided (resources), Zustand (state)
- **Networking:** WebRTC (peer-to-peer), Socket.IO (signaling)

## Development

See `docs/development-log/` for detailed development history, bug fixes, and architectural decisions.

## License

MIT
