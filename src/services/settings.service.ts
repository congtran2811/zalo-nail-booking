import { pool } from '../config/database.js';

export class SettingsService {
  // --- Google Configs ---
  static async getGoogleConfigs() {
    const result = await pool.query('SELECT * FROM google_configs ORDER BY created_at DESC');
    return result.rows;
  }

  static async addGoogleConfig(email: string, accessToken: string, refreshToken: string, expiryDate: number) {
    const query = `
      INSERT INTO google_configs (email, access_token, refresh_token, expiry_date)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const result = await pool.query(query, [email, accessToken, refreshToken, expiryDate]);
    return result.rows[0];
  }

  static async activateGoogleConfig(id: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('UPDATE google_configs SET is_active = false');
      await client.query('UPDATE google_configs SET is_active = true WHERE id = $1', [id]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  static async deleteGoogleConfig(id: string) {
    await pool.query('DELETE FROM google_configs WHERE id = $1', [id]);
  }

  // --- Business Hours ---
  static async getBusinessHours() {
    const result = await pool.query('SELECT * FROM business_hours ORDER BY day_of_week ASC');
    return result.rows;
  }

  static async updateBusinessHour(dayOfWeek: number, openTime: string, closeTime: string, isClosed: boolean) {
    const query = `
      UPDATE business_hours
      SET open_time = $2, close_time = $3, is_closed = $4
      WHERE day_of_week = $1
      RETURNING *;
    `;
    const result = await pool.query(query, [dayOfWeek, openTime, closeTime, isClosed]);
    return result.rows[0];
  }

  // --- Blocked Slots ---
  static async getBlockedSlots() {
    const result = await pool.query('SELECT * FROM blocked_slots ORDER BY start_time ASC');
    return result.rows;
  }

  static async addBlockedSlot(startTime: string, endTime: string, reason: string) {
    const query = `
      INSERT INTO blocked_slots (start_time, end_time, reason)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const result = await pool.query(query, [startTime, endTime, reason]);
    return result.rows[0];
  }

  static async deleteBlockedSlot(id: string) {
    await pool.query('DELETE FROM blocked_slots WHERE id = $1', [id]);
  }
}
