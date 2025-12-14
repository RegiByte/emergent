# Quick Start Guide

Get the multiplayer buzzer running in 2 minutes.

## Prerequisites

- Node.js 18+ installed
- Two browser windows (or devices on same network)

## Steps

### 1. Install & Run

```bash
npm install
npm run dev
```

This starts:
- Backend (signaling server) on `http://localhost:8000`
- Frontend (game UI) on `http://localhost:3000`

### 2. Host Setup

**Browser 1:**
1. Go to `http://localhost:3000`
2. Click **"Host Game"**
3. Note the **session code** (e.g., "A7E0")

### 3. Player Setup

**Browser 2:**
1. Go to `http://localhost:3000`
2. Click **"Join Game"**
3. Enter the **session code** from host
4. Enter your **player name**
5. Click **"Join"**

**Repeat for more players** (Browser 3, 4, etc.)

### 4. Play!

**On Host Screen:**
1. Wait for 2+ players to join
2. Click **"Start Game"**
3. Watch countdown: **3... 2... 1... GO!**

**On Player Screens:**
1. Wait for countdown
2. Click **BUZZ** as fast as possible!
3. Fastest player wins! 🎉

### 5. Play Again

**On Host Screen:**
- Click **"Play Again"** to reset
- Repeat from step 4

## Troubleshooting

**Players can't connect?**
- Check that backend is running (should see "Signaling server ready" in terminal)
- Check browser console for errors
- Try refreshing both host and player pages

**Connection dropped?**
- Refresh the page and rejoin
- WebRTC connections can be sensitive to network changes

**Countdown not showing?**
- Make sure you have 2+ players joined
- Check that all players show "✓ Clock synced"

## Next Steps

- Read `README.md` for architecture overview
- Explore `frontend/src/system/` for implementation details
- Check `docs/development-log/` for development history

## Tips

**For best experience:**
- Use Chrome or Edge (best WebRTC support)
- Host on a device with stable connection
- Players can use phones/tablets
- Keep all devices on same network for lowest latency

**For demos:**
- Use incognito windows to simulate multiple users
- Or use different browsers (Chrome, Firefox, Safari)
- Or use different devices (laptop + phones)

Enjoy! 🎮⚡
