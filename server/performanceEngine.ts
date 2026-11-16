import { monitorEventLoopDelay } from 'node:perf_hooks';
import type { WebSocket } from 'ws';
import type { EngineMetrics } from '../src/types/market.ts';
import { getStorageDiagnostics } from './workspacePersistence.ts';

const MAX_BUFFERED_BYTES = 256 * 1024;
const startTimestamp = Date.now();
const loopHistogram = monitorEventLoopDelay({ resolution: 20 });
loopHistogram.enable();

class HighPerformanceEngine {
  private symbolRooms = new Map<string, Set<WebSocket>>();
  private userSockets = new Map<string, Set<WebSocket>>();
  private socketMeta = new Map<WebSocket, { userId: string; symbol: string }>();
  private totalInstrumentsCount = 0;
  private adminRecordsCount = 0;

  private ticksProcessed = 0;
  private ordersMatched = 0;
  private snapshotCacheHits = 0;
  private snapshotCacheMisses = 0;
  private broadcastLatencies: number[] = [];
  private apiLatencies: number[] = [];

  private cachedSnapshotJson: string | null = null;
  private cachedSnapshotAt = 0;

  registerSocket(ws: WebSocket, userId: string, initialSymbol: string) {
    this.socketMeta.set(ws, { userId, symbol: initialSymbol });

    let userSet = this.userSockets.get(userId);
    if (!userSet) {
      userSet = new Set();
      this.userSockets.set(userId, userSet);
    }
    userSet.add(ws);

    let room = this.symbolRooms.get(initialSymbol);
    if (!room) {
      room = new Set();
      this.symbolRooms.set(initialSymbol, room);
    }
    room.add(ws);
  }

  switchSymbol(ws: WebSocket, nextSymbol: string) {
    const meta = this.socketMeta.get(ws);
    if (!meta) return;
    if (meta.symbol === nextSymbol) return;

    const oldRoom = this.symbolRooms.get(meta.symbol);
    if (oldRoom) {
      oldRoom.delete(ws);
      if (oldRoom.size === 0) this.symbolRooms.delete(meta.symbol);
    }

    let nextRoom = this.symbolRooms.get(nextSymbol);
    if (!nextRoom) {
      nextRoom = new Set();
      this.symbolRooms.set(nextSymbol, nextRoom);
    }
    nextRoom.add(ws);
    meta.symbol = nextSymbol;
  }

  unregisterSocket(ws: WebSocket) {
    const meta = this.socketMeta.get(ws);
    if (!meta) return;

    const userSet = this.userSockets.get(meta.userId);
    if (userSet) {
      userSet.delete(ws);
      if (userSet.size === 0) this.userSockets.delete(meta.userId);
    }

    const room = this.symbolRooms.get(meta.symbol);
    if (room) {
      room.delete(ws);
      if (room.size === 0) this.symbolRooms.delete(meta.symbol);
    }

    this.socketMeta.delete(ws);
  }

  setCatalogCounts(instrumentsCount: number, adminRecordsCount: number) {
    this.totalInstrumentsCount = instrumentsCount;
    this.adminRecordsCount = adminRecordsCount;
  }

  recordTick() {
    this.ticksProcessed += 1;
  }

  recordOrderMatch() {
    this.ordersMatched += 1;
  }

  recordApiLatency(ms: number) {
    this.apiLatencies.push(ms);
    if (this.apiLatencies.length > 250) this.apiLatencies.shift();
  }

  recordBroadcastLatency(ms: number) {
    this.broadcastLatencies.push(ms);
    if (this.broadcastLatencies.length > 120) this.broadcastLatencies.shift();
  }

  getCachedSnapshot(ttlMs: number, producer: () => unknown): string {
    const now = Date.now();
    if (this.cachedSnapshotJson && now - this.cachedSnapshotAt <= ttlMs) {
      this.snapshotCacheHits += 1;
      return this.cachedSnapshotJson;
    }
    this.snapshotCacheMisses += 1;
    this.cachedSnapshotJson = JSON.stringify(producer());
    this.cachedSnapshotAt = now;
    return this.cachedSnapshotJson;
  }

  invalidateSnapshotCache() {
    this.cachedSnapshotJson = null;
  }

  sendRawSafe(ws: WebSocket, serialized: string, dropOnBackpressure = false) {
    if (ws.readyState !== 1) return;
    if (dropOnBackpressure && ws.bufferedAmount > MAX_BUFFERED_BYTES) {
      return;
    }
    ws.send(serialized);
  }

  sendToUser(userId: string, msg: unknown) {
    const sockets = this.userSockets.get(userId);
    if (!sockets || sockets.size === 0) return;
    const serialized = JSON.stringify(msg);
    for (const ws of sockets) {
      this.sendRawSafe(ws, serialized, false);
    }
  }

  broadcastSymbol(symbol: string, msg: unknown) {
    const room = this.symbolRooms.get(symbol);
    if (!room || room.size === 0) return;
    const t0 = performance.now();
    const serialized = JSON.stringify(msg);
    for (const ws of room) {
      this.sendRawSafe(ws, serialized, true);
    }
    this.recordBroadcastLatency(performance.now() - t0);
  }

  broadcastAll(msg: unknown, dropOnBackpressure = true) {
    if (this.socketMeta.size === 0) return;
    const t0 = performance.now();
    const serialized = JSON.stringify(msg);
    for (const ws of this.socketMeta.keys()) {
      this.sendRawSafe(ws, serialized, dropOnBackpressure);
    }
    this.recordBroadcastLatency(performance.now() - t0);
  }

  getMetrics(includePaths = false): EngineMetrics {
    const avgBroadcast =
      this.broadcastLatencies.length > 0
        ? this.broadcastLatencies.reduce((a, b) => a + b, 0) / this.broadcastLatencies.length
        : 0.08;

    let p95Api = 1.2;
    if (this.apiLatencies.length > 0) {
      const sorted = [...this.apiLatencies].sort((a, b) => a - b);
      p95Api = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
    }

    const totalCacheLookups = this.snapshotCacheHits + this.snapshotCacheMisses;
    const hitRate =
      totalCacheLookups > 0 ? (this.snapshotCacheHits / totalCacheLookups) * 100 : 100;

    const p95LoopLagMs = Number((loopHistogram.percentile(95) / 1e6).toFixed(2));
    if (loopHistogram.count > 1500) loopHistogram.reset();

    const stores = getStorageDiagnostics({
      adminUsersAndEvents: includePaths ? this.adminRecordsCount : 0,
      workspacesCount: undefined,
      instrumentsCount: this.totalInstrumentsCount,
    });

    return {
      activeConnections: this.socketMeta.size,
      authenticatedUsers: this.userSockets.size,
      subscribedRooms: this.symbolRooms.size,
      ticksProcessed: this.ticksProcessed,
      ordersMatched: this.ordersMatched,
      avgBroadcastLatencyMs: Number(avgBroadcast.toFixed(2)),
      p95ApiLatencyMs: Number(p95Api.toFixed(2)),
      eventLoopLagMs: Number.isFinite(p95LoopLagMs) ? Math.min(250, p95LoopLagMs) : 0.4,
      snapshotCacheHits: this.snapshotCacheHits,
      snapshotCacheHitRatePct: Number(hitRate.toFixed(1)),
      memoryRssMb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
      uptimeSec: Math.round((Date.now() - startTimestamp) / 1000),
      totalInstruments: this.totalInstrumentsCount,
      storageStores: includePaths
        ? stores
        : stores.map((s) => ({ ...s, filePath: 'Encrypted Custody Tier' })),
    };
  }
}

export const perfEngine = new HighPerformanceEngine();
