/**
 * Clock Synchronization System
 *
 * This implements the fair buzzer mechanic using clock synchronization.
 *
 * The Problem:
 * - Host has 0ms network latency (local)
 * - Players have 50-200ms network latency
 * - Naive "first message received" gives host unfair advantage
 *
 * The Solution:
 * 1. Sync clocks between host and players (calculate offset)
 * 2. When player buzzes, send: { localTime, offset }
 * 3. Host calculates: compensatedTime = localTime + offset
 * 4. Pick earliest compensatedTime = fair winner
 *
 * This is the same technique used in:
 * - Valorant (Riot Games)
 * - Overwatch (Blizzard)
 * - Any competitive multiplayer game using real-time networking
 */

export type ClockSyncSample = {
  clientSendTime: number;
  serverTime: number;
  clientReceiveTime: number;
  roundTripTime: number;
  offset: number; // How much to add to client time to get server time
};

export type ClockSyncState = {
  samples: ClockSyncSample[];
  currentOffset: number;
  lastSyncAt: number;
  isReady: boolean;
};

/**
 * Calculate clock offset using multiple samples
 *
 * We take the median offset from multiple samples to reduce
 * the impact of network jitter and outliers.
 */
export function calculateClockOffset(samples: ClockSyncSample[]): number {
  if (samples.length === 0) return 0;

  // Sort by offset
  const sorted = [...samples].sort((a, b) => a.offset - b.offset);

  // Take median
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1].offset + sorted[mid].offset) / 2;
  }
  return sorted[mid].offset;
}

/**
 * Create a clock sync sample from a ping-pong exchange
 *
 * @param clientSendTime - When client sent the ping (client clock)
 * @param serverTime - When server received ping (server clock)
 * @param clientReceiveTime - When client received pong (client clock)
 */
export function createClockSyncSample(
  clientSendTime: number,
  serverTime: number,
  clientReceiveTime: number
): ClockSyncSample {
  const roundTripTime = clientReceiveTime - clientSendTime;

  // Assume network latency is symmetric (half RTT each way)
  const estimatedServerReceiveTime = clientSendTime + roundTripTime / 2;

  // Offset = how much to add to client time to get server time
  const offset = serverTime - estimatedServerReceiveTime;

  return {
    clientSendTime,
    serverTime,
    clientReceiveTime,
    roundTripTime,
    offset,
  };
}

/**
 * Create a clock sync state manager
 *
 * This manages the clock synchronization process:
 * - Collects samples from ping-pong exchanges
 * - Calculates current offset
 * - Determines when sync is ready (enough samples)
 */
export function createClockSync(options: { samplesNeeded?: number } = {}) {
  const samplesNeeded = options.samplesNeeded ?? 5;

  let state: ClockSyncState = {
    samples: [],
    currentOffset: 0,
    lastSyncAt: 0,
    isReady: false,
  };

  const addSample = (sample: ClockSyncSample) => {
    state.samples.push(sample);

    // Keep only recent samples (last 10)
    if (state.samples.length > 10) {
      state.samples.shift();
    }

    // Recalculate offset
    state.currentOffset = calculateClockOffset(state.samples);
    state.lastSyncAt = Date.now();
    state.isReady = state.samples.length >= samplesNeeded;
  };

  const getOffset = () => state.currentOffset;

  const isReady = () => state.isReady;

  const getState = () => state;

  const reset = () => {
    state = {
      samples: [],
      currentOffset: 0,
      lastSyncAt: 0,
      isReady: false,
    };
  };

  return {
    addSample,
    getOffset,
    isReady,
    getState,
    reset,
  };
}

/**
 * Compensate a local timestamp to host time
 *
 * @param localTimestamp - Timestamp from player's clock
 * @param offset - Clock offset (from sync)
 * @returns Compensated timestamp in host time
 */
export function compensateTimestamp(
  localTimestamp: number,
  offset: number
): number {
  return localTimestamp + offset;
}

/**
 * Determine the winner from buzz submissions
 *
 * @param submissions - Array of buzz submissions with compensated timestamps
 * @returns The winning submission (earliest compensated time)
 */
export function determineWinner<T extends { compensatedTime: number }>(
  submissions: T[]
): T | null {
  if (submissions.length === 0) return null;

  return submissions.reduce((earliest, current) => {
    return current.compensatedTime < earliest.compensatedTime
      ? current
      : earliest;
  });
}
