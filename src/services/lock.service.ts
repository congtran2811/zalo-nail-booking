import { redis } from '../config/redis.js';

/**
 * Redis Distributed Lock — Slot Hold Service
 *
 * Uses Redis SET NX EX for atomic, TTL-bounded slot reservation.
 * This prevents race conditions when multiple users try to book the same slot.
 */
export class LockService {
  private static readonly HOLD_TTL_SECONDS = 180; // 3 minutes

  /**
   * Attempt to acquire a temporary hold on a time slot.
   *
   * Uses SET ... NX EX which is atomic in Redis — guarantees that only
   * one caller succeeds even under concurrent load.
   *
   * @param slotKey   - Unique identifier for the slot (e.g. "2026-10-01_08:00")
   * @param sessionId - The socket.id or REST session token of the requester
   * @returns true if lock acquired, false if slot is already held
   */
  static async acquireSlotHold(slotKey: string, sessionId: string): Promise<boolean> {
    try {
      const key = `lock:hold:${slotKey}`;
      const result = await redis.set(key, sessionId, 'EX', this.HOLD_TTL_SECONDS, 'NX');
      return result === 'OK';
    } catch (err) {
      console.error(`[LockService] acquireSlotHold failed for key="${slotKey}":`, err);
      // On Redis failure, deny the hold to prevent phantom availability
      return false;
    }
  }

  /**
   * Release a held slot.
   *
   * Only the session that originally acquired the hold can release it.
   * This prevents a user from accidentally releasing another user's hold.
   *
   * @param slotKey   - Unique identifier for the slot
   * @param sessionId - Must match the value stored in Redis
   */
  static async releaseSlotHold(slotKey: string, sessionId: string): Promise<void> {
    try {
      const key = `lock:hold:${slotKey}`;
      const currentSession = await redis.get(key);
      if (currentSession === sessionId) {
        await redis.del(key);
      }
    } catch (err) {
      console.error(`[LockService] releaseSlotHold failed for key="${slotKey}":`, err);
      // Non-critical: TTL will expire the key automatically
    }
  }

  /**
   * Check if a slot is currently held by anyone.
   *
   * @param slotKey - Unique identifier for the slot
   * @returns The sessionId holding it, or null if free
   */
  static async getSlotHolder(slotKey: string): Promise<string | null> {
    try {
      const key = `lock:hold:${slotKey}`;
      return await redis.get(key);
    } catch (err) {
      console.error(`[LockService] getSlotHolder failed for key="${slotKey}":`, err);
      return null;
    }
  }

  /**
   * Get remaining TTL in seconds for a held slot.
   *
   * @param slotKey - Unique identifier for the slot
   * @returns seconds remaining, -2 if key not found, -1 if no TTL set
   */
  static async getSlotHoldTTL(slotKey: string): Promise<number> {
    try {
      const key = `lock:hold:${slotKey}`;
      return await redis.ttl(key);
    } catch (err) {
      console.error(`[LockService] getSlotHoldTTL failed for key="${slotKey}":`, err);
      return -2;
    }
  }
}
