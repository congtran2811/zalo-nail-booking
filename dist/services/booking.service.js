import { pool } from '../config/database.js';
/**
 * Booking Service — PostgreSQL Transaction Layer
 *
 * Handles atomic booking creation with pessimistic locking (SELECT FOR UPDATE)
 * to prevent race conditions / double-booking of the same time slot.
 */
export class BookingService {
    /**
     * Create a new booking inside a serializable transaction.
     *
     * Flow:
     *  1. BEGIN transaction
     *  2. SELECT … FOR UPDATE — acquire a row-level lock on all confirmed bookings
     *     that overlap the requested time range
     *  3. If any overlap found → throw SLOT_ALREADY_BOOKED (triggers ROLLBACK)
     *  4. INSERT new booking
     *  5. COMMIT
     *
     * If any step fails, the catch block ensures ROLLBACK before re-throwing.
     *
     * @throws Error('SLOT_ALREADY_BOOKED') when the time range is taken
     * @throws Error('INVALID_SERVICE')     when serviceId does not exist
     * @throws Error for any other DB error
     */
    static async createBooking(dto) {
        // Input validation before touching the DB
        if (!dto.customerName?.trim())
            throw new Error('MISSING_CUSTOMER_NAME');
        if (!dto.customerPhone?.trim())
            throw new Error('MISSING_CUSTOMER_PHONE');
        if (!dto.startTime || !dto.endTime)
            throw new Error('MISSING_TIME_RANGE');
        if (new Date(dto.startTime) >= new Date(dto.endTime)) {
            throw new Error('INVALID_TIME_RANGE');
        }
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            // 1. Lock the parent service row FOR UPDATE to serialize concurrent requests.
            // This forces transactions for the same service to execute sequentially,
            // preventing phantom reads when checking for overlapping bookings.
            const serviceCheck = await client.query('SELECT id FROM services WHERE id = $1 FOR UPDATE', [dto.serviceId]);
            if (serviceCheck.rows.length === 0) {
                throw new Error('INVALID_SERVICE');
            }
            // Pessimistic lock: lock all overlapping confirmed bookings.
            // Overlap condition: existing.start_time < new.end AND existing.end_time > new.start
            const overlapQuery = `
        SELECT id FROM bookings
        WHERE status = 'confirmed'
          AND start_time < $2::timestamptz
          AND end_time   > $1::timestamptz
        FOR UPDATE;
      `;
            const overlapResult = await client.query(overlapQuery, [
                dto.startTime,
                dto.endTime
            ]);
            if (overlapResult.rows.length > 0) {
                throw new Error('SLOT_ALREADY_BOOKED');
            }
            // No conflict — insert the new booking
            const insertQuery = `
        INSERT INTO bookings
          (customer_name, customer_phone, service_id, start_time, end_time)
        VALUES ($1, $2, $3, $4::timestamptz, $5::timestamptz)
        RETURNING *;
      `;
            const result = await client.query(insertQuery, [
                dto.customerName.trim(),
                dto.customerPhone.trim(),
                dto.serviceId,
                dto.startTime,
                dto.endTime
            ]);
            await client.query('COMMIT');
            return result.rows[0];
        }
        catch (error) {
            // Always rollback on any failure to avoid dirty state
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            // Always release client back to the pool
            client.release();
        }
    }
    /**
     * Fetch all bookings for a given date (for admin dashboard or debugging).
     *
     * @param date - YYYY-MM-DD string
     */
    static async getBookingsByDate(date) {
        const query = `
      SELECT * FROM bookings
      WHERE DATE(start_time AT TIME ZONE 'Asia/Ho_Chi_Minh') = $1::date
        AND status = 'confirmed'
      ORDER BY start_time ASC;
    `;
        try {
            const { rows } = await pool.query(query, [date]);
            return rows;
        }
        catch (err) {
            console.error('[BookingService] getBookingsByDate error:', err);
            throw err;
        }
    }
    /**
     * Update the Google Calendar event ID after async calendar sync.
     */
    static async setGoogleEventId(bookingId, googleEventId) {
        try {
            await pool.query('UPDATE bookings SET google_event_id = $1 WHERE id = $2', [googleEventId, bookingId]);
        }
        catch (err) {
            console.error('[BookingService] setGoogleEventId error:', err);
            // Non-critical: log but don't throw
        }
    }
}
