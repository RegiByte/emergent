/**
 * Host Transport Adapter
 * 
 * This manages WebRTC connections from the host side:
 * - Creates data channels to each player
 * - Broadcasts game state snapshots
 * - Receives player intents (buzzes)
 * - Handles clock synchronization
 * 
 * This is an orthogonal resource - the game runtime doesn't know
 * about WebRTC. It just dispatches events and executes effects.
 */

import { io, type Socket } from 'socket.io-client'
import type { GameRuntime } from './runtime'
import type { SerializedGameSnapshot } from '../types'

export type HostTransportConfig = {
  runtime: GameRuntime
  signalingServerUrl: string
}

export type HostTransportState = {
  sessionId: string | null
  hostToken: string | null
  peers: Map<string, RTCPeerConnection>
  dataChannels: Map<string, RTCDataChannel>
  isConnected: boolean
}

export function createHostTransport(config: HostTransportConfig) {
  const { runtime, signalingServerUrl } = config

  let socket: Socket | null = null
  let state: HostTransportState = {
    sessionId: null,
    hostToken: null,
    peers: new Map(),
    dataChannels: new Map(),
    isConnected: false,
  }

  const listeners = new Set<() => void>()

  const notify = () => {
    listeners.forEach((fn) => fn())
  }

  // ============================================
  // WebRTC Setup
  // ============================================

  const createPeerConnection = (peerId: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    })

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('signal:relay', {
          targetId: peerId,
          data: { type: 'ice', candidate: event.candidate },
        })
      }
    }

    pc.onconnectionstatechange = () => {
      console.log(`[Host] Peer ${peerId} connection state:`, pc.connectionState)
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        handlePeerDisconnect(peerId)
      }
    }

    return pc
  }

  const createDataChannel = (pc: RTCPeerConnection, peerId: string): RTCDataChannel => {
    const channel = pc.createDataChannel('game', {
      ordered: true,
    })

    channel.onopen = () => {
      console.log(`[Host] Data channel opened for peer ${peerId}`)
      state.dataChannels.set(peerId, channel)
      notify()

      // Send initial snapshot
      broadcastSnapshot()
    }

    channel.onclose = () => {
      console.log(`[Host] Data channel closed for peer ${peerId}`)
      state.dataChannels.delete(peerId)
      notify()
    }

    channel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        handlePlayerMessage(peerId, message)
      } catch (error) {
        console.error('[Host] Failed to parse message:', error)
      }
    }

    return channel
  }

  // ============================================
  // Signaling
  // ============================================

  const handlePeerJoined = async (peerId: string) => {
    console.log(`[Host] Peer joined: ${peerId}`)

    const pc = createPeerConnection(peerId)
    state.peers.set(peerId, pc)

    const channel = createDataChannel(pc, peerId)

    // Create offer
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)

    // Send offer via signaling
    socket?.emit('signal:relay', {
      targetId: peerId,
      data: { type: 'offer', description: offer },
    })

    notify()
  }

  const handlePeerLeft = (peerId: string) => {
    console.log(`[Host] Peer left: ${peerId}`)
    handlePeerDisconnect(peerId)
  }

  const handlePeerDisconnect = (peerId: string) => {
    const pc = state.peers.get(peerId)
    if (pc) {
      pc.close()
      state.peers.delete(peerId)
    }

    const channel = state.dataChannels.get(peerId)
    if (channel) {
      channel.close()
      state.dataChannels.delete(peerId)
    }

    // Notify runtime
    runtime.dispatch({
      type: 'player:left',
      playerId: peerId,
    })

    notify()
  }

  const handleSignal = async (data: { fromId: string; data: any }) => {
    const { fromId, data: signalData } = data

    const pc = state.peers.get(fromId)
    if (!pc) {
      console.error(`[Host] No peer connection for ${fromId}`)
      return
    }

    if (signalData.type === 'answer') {
      await pc.setRemoteDescription(new RTCSessionDescription(signalData.description))
    } else if (signalData.type === 'ice') {
      await pc.addIceCandidate(new RTCIceCandidate(signalData.candidate))
    }
  }

  // ============================================
  // Player Messages
  // ============================================

  const handlePlayerMessage = (peerId: string, message: any) => {
    console.log(`[Host] Message from ${peerId}:`, message.type)

    switch (message.type) {
      case 'player-joined': {
        runtime.dispatch({
          type: 'player:joined',
          playerId: peerId,
          playerName: message.playerName,
        })
        break
      }

      case 'player-buzz': {
        runtime.dispatch({
          type: 'player:buzz',
          playerId: peerId,
          timestamp: message.timestamp,
          offset: message.offset,
        })
        break
      }

      case 'clock-sync-pong': {
        // Player has completed clock sync
        runtime.dispatch({
          type: 'clock:sync-response',
          playerId: peerId,
          serverTime: message.serverTime,
        })
        break
      }
    }
  }

  // ============================================
  // Broadcasting
  // ============================================

  const broadcastSnapshot = () => {
    const snapshot = runtime.store.getState().snapshot

    // Serialize (Map → Object)
    const serialized: SerializedGameSnapshot = {
      ...snapshot,
      players: Object.fromEntries(snapshot.players),
    }

    const message = {
      type: 'snapshot',
      snapshot: serialized,
    }

    // Send to all connected players
    state.dataChannels.forEach((channel) => {
      if (channel.readyState === 'open') {
        channel.send(JSON.stringify(message))
      }
    })
  }

  const sendToPlayer = (playerId: string, payload: unknown) => {
    const channel = state.dataChannels.get(playerId)
    if (channel && channel.readyState === 'open') {
      channel.send(JSON.stringify(payload))
    }
  }

  const broadcastMessage = (payload: unknown) => {
    state.dataChannels.forEach((channel) => {
      if (channel.readyState === 'open') {
        channel.send(JSON.stringify(payload))
      }
    })
  }

  // ============================================
  // Clock Sync
  // ============================================

  const startClockSync = (playerId: string) => {
    // Send multiple pings for better accuracy
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        sendToPlayer(playerId, {
          type: 'clock-sync-ping',
          serverTime: Date.now(),
        })
      }, i * 200) // 200ms apart
    }
  }

  // ============================================
  // Session Management
  // ============================================

  const createSession = async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!socket) {
        reject(new Error('Socket not connected'))
        return
      }

      socket.emit('session:create', (response: any) => {
        if (response.ok) {
          state.sessionId = response.data.sessionId
          state.hostToken = response.data.hostToken
          state.isConnected = true
          console.log(`[Host] Session created: ${state.sessionId}`)
          notify()
          resolve()
        } else {
          reject(new Error(response.error))
        }
      })
    })
  }

  // ============================================
  // Lifecycle
  // ============================================

  const start = async () => {
    socket = io(signalingServerUrl, {
      transports: ['websocket', 'polling'],
    })

    socket.on('connect', () => {
      console.log('[Host] Connected to signaling server')
    })

    socket.on('session:peer-joined', (data: { peerId: string }) => {
      handlePeerJoined(data.peerId)
    })

    socket.on('session:peer-left', (data: { peerId: string }) => {
      handlePeerLeft(data.peerId)
    })

    socket.on('signal:receive', handleSignal)

    socket.on('disconnect', () => {
      console.log('[Host] Disconnected from signaling server')
      state.isConnected = false
      notify()
    })

    // Wait for socket to connect
    await new Promise<void>((resolve) => {
      if (socket!.connected) {
        resolve()
      } else {
        socket!.once('connect', () => resolve())
      }
    })

    // Create session
    await createSession()

    // Subscribe to store state changes (not runtime events!)
    runtime.store.subscribe(() => {
      broadcastSnapshot()
    })
  }

  const dispose = () => {
    // Close all peer connections
    state.peers.forEach((pc) => pc.close())
    state.peers.clear()

    // Close all data channels
    state.dataChannels.forEach((channel) => channel.close())
    state.dataChannels.clear()

    // Disconnect socket
    socket?.disconnect()
    socket = null

    state.isConnected = false
    notify()
  }

  const getState = () => state

  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  return {
    start,
    dispose,
    getState,
    subscribe,
    broadcastMessage,
    sendMessage: sendToPlayer,
    onClockSync: startClockSync,
  }
}

export type HostTransport = ReturnType<typeof createHostTransport>

