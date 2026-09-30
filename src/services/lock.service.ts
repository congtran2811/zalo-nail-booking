import { redis } from '../config/redis.js';

export class LockService {
  /**
   * Temporary hold on a slot for 3 minutes (180 seconds)
   */
  static async acquireSlotHold(slotKey: string, sessionId: string): Promise<boolean> {
    const key = `lock:hold:${slotKey}`;
    const result = await redis.set(key, sessionId, 'EX', 180, 'NX');
    return result === 'OK';
  }

  static async releaseSlotHold(slotKey: string, sessionId: string): Promise<void> {
    const key = `lock:hold:${slotKey}`;
    const currentSession = await redis.get(key);
    if (currentSession === sessionId) {
      await redis.del(key);
    }
  }

  static async isSlotHeld(slotKey: string): Promise<boolean> {
    const key = `lock:hold:${slotKey}`;
    const currentSession = await redis.get(key);
    return currentSession !== null;
  }
}
