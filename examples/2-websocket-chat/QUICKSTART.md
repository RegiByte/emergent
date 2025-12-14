# WebSocket Chat - Quick Start Guide

Get the chat app running in 2 minutes! 🚀

## Prerequisites

- Node.js 18+ installed
- Terminal/command line access

## Installation & Running

### 1. Install Dependencies

```bash
cd examples/2-websocket-chat
npm install
```

### 2. Start the App

```bash
npm run dev
```

This starts:
- **Backend** on http://localhost:8000 (Socket.IO server)
- **Frontend** on http://localhost:3000 (React app)

### 3. Open in Browser

Navigate to http://localhost:3000

## Testing the Chat

### Option 1: Create a Room

1. Click **"Create Room"**
2. Enter your name (e.g., "Alice")
3. Click **"Create Room"** button
4. You'll see a room code (e.g., "A1B2")
5. Share this code with others!

### Option 2: Join a Room

1. Get a room code from someone
2. Click **"Join Room"**
3. Enter the room code
4. Enter your name (e.g., "Bob")
5. Click **"Join Room"** button

### Multiple Users (Testing Locally)

Open multiple browser windows/tabs:

**Window 1:**
- Create room as "Alice"
- Note the room code (e.g., "A1B2")

**Window 2:**
- Join room "A1B2" as "Bob"

**Window 3:**
- Join room "A1B2" as "Charlie"

Now chat between all windows! 💬

## Features to Try

### Send Messages
- Type in the message input at the bottom
- Press Enter or click "Send"
- See your message appear instantly

### Emoji Reactions
- Hover over any message
- Click the 😊 button
- Select an emoji (👍, ❤️, 😂, 🎉, 🤔, 👀)
- Click again to remove your reaction

### Typing Indicators
- Start typing in one window
- See "X is typing..." in other windows
- Stops after 2 seconds of inactivity

### User Presence
- See all online users in the left sidebar
- Users are removed when they leave

## Troubleshooting

### "System not ready"
- Wait a few seconds for resources to initialize
- Check browser console for errors

### "Failed to create/join room"
- Make sure backend is running (check terminal)
- Check http://localhost:8000/health (should return `{"status":"ok"}`)

### Messages not appearing
- Check browser console for WebSocket errors
- Verify both backend and frontend are running
- Try refreshing the page

### Port already in use
If port 8000 or 3000 is taken:

```bash
# Change backend port
PORT=8001 npm run dev:backend

# Change frontend port (edit vite.config.ts)
# Change server.port to 3001
```

## Architecture Overview

```
Browser 1           Browser 2           Browser 3
   ↓                   ↓                   ↓
WebSocket          WebSocket          WebSocket
   ↓                   ↓                   ↓
        Socket.IO Server (Backend)
                ↓
          Room Store (Memory)
          - Messages
          - Users
          - Reactions
```

Each browser:
1. Connects via WebSocket
2. Joins a room
3. Sends/receives messages in real-time
4. Observes state changes via React hooks

## Next Steps

- Read `README.md` for architecture details
- Explore `frontend/src/system/runtime.ts` for Emergent handlers
- Check `backend/src/server.ts` for Braided resources
- Try adding new features (scheduled messages, sounds, etc.)

## Tips for Demos

1. **Open side-by-side windows** - Makes real-time updates obvious
2. **Use different names** - Easier to see who's who
3. **Try reactions** - Shows the interactive nature
4. **Type slowly** - Shows typing indicators clearly
5. **Leave and rejoin** - Shows presence management

Enjoy chatting! 🌊✨
