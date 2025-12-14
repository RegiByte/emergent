/**
 * Player Transport Adapter
 * 
 * This manages WebRTC connection from the player side:
 * - Connects to host via data channel
 * - Receives game state snapshots
 * - Sends player intents (buzzes)
 * - Performs clock synchronization
 * 
 * The player is a lightweight client - it doesn't run the game logic,
 * it just observes state and sends intents.
 */

import { io, type Socket } from 'socket.io-client'
import { createClockSync, createClockSyncSample } from './clock-sync'
import type { SerializedGameSnapshot } from '../types'

export type PlayerTransportConfig = {
  signalingServerUrl: string
  sessionId: string
  playerName: string
}

export type PlayerTransportState = {
  sessionId: string
  peerId: string | null
  hostId: string | null
  playerName: string
  isConnected: boolean
  clockOffset: number
  clockSyncReady: boolean
  snapshot: SerializedGameSnapshot | null
}

export function createPlayerTransport(config: PlayerTransportConfig) {
  const { signalingServerUrl, sessionId, playerName } = config

  let socket: Socket | null = null
  let peerConnection: RTCPeerConnection | null = null
  let dataChannel: RTCDataChannel | null = null
  
  const clockSync = createClockSync({ samplesNeeded: 3 })

  let state: PlayerTransportState = {
    sessionId,
    peerId: null,
    hostId: null,
    playerName,
    isConnected: false,
    clockOffset: 0,
    clockSyncReady: false,
    snapshot: null,
  }

  const listeners = new Set<() => void>()

  const notify = () => {
    listeners.forEach((fn) => fn())
  }

  // ============================================
  // WebRTC Setup
  // ============================================

  const createPeer = (): RTCPeerConnection => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    })

    pc.onicecandidate = (event) => {
      if (event.candidate && socket && state.hostId) {
        socket.emit('signal:relay', {
          targetId: state.hostId,  // Send to HOST, not self!
          data: { type: 'ice', candidate: event.candidate },
        })
      }
    }

    pc.ondatachannel = (event) => {
      dataChannel = event.channel
      setupDataChannel(dataChannel)
    }

    pc.onconnectionstatechange = () => {
      console.log('[Player] Connection state:', pc.connectionState)
      if (pc.connectionState === 'connected') {
        state = { ...state, isConnected: true }
        notify()
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        state = { ...state, isConnected: false }
        notify()
      }
    }

    return pc
  }

  const setupDataChannel = (channel: RTCDataChannel) => {
    channel.onopen = () => {
      console.log('[Player] Data channel opened')
      
      // Send player joined message NOW (channel is open!)
      sendMessage({
        type: 'player-joined',
        playerName: state.playerName,
      })
    }

    channel.onclose = () => {
      console.log('[Player] Data channel closed')
      state = { ...state, isConnected: false }
      notify()
    }

    channel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        handleHostMessage(message)
      } catch (error) {
        console.error('[Player] Failed to parse message:', error)
      }
    }
  }

  // ============================================
  // Host Messages
  // ============================================

  const handleHostMessage = (message: any) => {
    switch (message.type) {
      case 'snapshot': {
        // Create new state object for React to detect change
        state = {
          ...state,
          snapshot: message.snapshot,
        }
        notify()
        break
      }

      case 'clock-sync-ping': {
        const clientReceiveTime = Date.now()
        const serverTime = message.serverTime
        
        // We need to track when we sent the request
        // For simplicity, we'll use the receive time as an approximation
        // In production, you'd track the send time properly
        const clientSendTime = clientReceiveTime - 50 // Estimate 50ms RTT
        
        const sample = createClockSyncSample(
          clientSendTime,
          serverTime,
          clientReceiveTime
        )
        
        clockSync.addSample(sample)
        
        // Create new state object for React to detect change
        state = {
          ...state,
          clockOffset: clockSync.getOffset(),
          clockSyncReady: clockSync.isReady(),
        }
        
        console.log('[Player] Clock sync sample:', {
          offset: sample.offset,
          rtt: sample.roundTripTime,
          ready: state.clockSyncReady,
        })
        
        // Send pong back
        sendMessage({
          type: 'clock-sync-pong',
          clientTime: clientReceiveTime,
          serverTime: serverTime,
        })
        
        notify()
        break
      }

      case 'game-started': {
        console.log('[Player] Game started')
        break
      }

      case 'game-reset': {
        console.log('[Player] Game reset')
        break
      }

      case 'winner-determined': {
        console.log('[Player] Winner:', message.winnerName)
        break
      }
    }
  }

  // ============================================
  // Signaling
  // ============================================

  const handleSignal = async (data: { fromId: string; data: any }) => {
    const { data: signalData } = data

    if (!peerConnection) {
      console.error('[Player] No peer connection')
      return
    }

    if (signalData.type === 'offer') {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(signalData.description))
      const answer = await peerConnection.createAnswer()
      await peerConnection.setLocalDescription(answer)

      // Send answer back to host
      socket?.emit('signal:relay', {
        targetId: state.hostId,  // Send to HOST, not self!
        data: { type: 'answer', description: answer },
      })
    } else if (signalData.type === 'ice') {
      await peerConnection.addIceCandidate(new RTCIceCandidate(signalData.candidate))
    }
  }

  // ============================================
  // Player Actions
  // ============================================

  const buzz = () => {
    if (!state.clockSyncReady) {
      console.warn('[Player] Clock not synced yet, buzz may be inaccurate')
    }

    const localTimestamp = Date.now()
    
    sendMessage({
      type: 'player-buzz',
      timestamp: localTimestamp,
      offset: state.clockOffset,
    })

    console.log('[Player] Buzzed!', {
      localTime: localTimestamp,
      offset: state.clockOffset,
      compensatedTime: localTimestamp + state.clockOffset,
    })
  }

  const sendMessage = (payload: unknown) => {
    if (dataChannel && dataChannel.readyState === 'open') {
      dataChannel.send(JSON.stringify(payload))
    } else {
      console.warn('[Player] Cannot send message, channel not open')
    }
  }

  // ============================================
  // Session Management
  // ============================================

  const joinSession = async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!socket) {
        reject(new Error('Socket not connected'))
        return
      }

      socket.emit('session:join', { sessionId }, (response: any) => {
        if (response.ok) {
          state = {
            ...state,
            peerId: response.data.peerId,
            hostId: response.data.hostId,
          }
          console.log(`[Player] Joined session: ${sessionId} as ${state.peerId}, host: ${state.hostId}`)
          
          // Create peer connection
          peerConnection = createPeer()
          
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
      console.log('[Player] Connected to signaling server')
    })

    socket.on('signal:receive', handleSignal)

    socket.on('session:ended', () => {
      console.log('[Player] Session ended')
      state = { ...state, isConnected: false }
      notify()
    })

    socket.on('disconnect', () => {
      console.log('[Player] Disconnected from signaling server')
      state = { ...state, isConnected: false }
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

    // Join session
    await joinSession()
  }

  const dispose = () => {
    dataChannel?.close()
    dataChannel = null

    peerConnection?.close()
    peerConnection = null

    socket?.disconnect()
    socket = null

    state = { ...state, isConnected: false }
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
    buzz,
    getState,
    subscribe,
  }
}

export type PlayerTransport = ReturnType<typeof createPlayerTransport>

