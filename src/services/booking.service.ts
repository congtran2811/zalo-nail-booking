import { pool } from '../config/database.js';

export interface CreateBookingDTO {
  customerName: string;
  customerPhone: string;
  serviceId: number;
  startTime: string;
  endTime: string;
}

export class BookingService {
  static async createBooking(dto: CreateBookingDTO) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Pessimistic lock check for overlapping slots
      const overlapQuery = `
        SELECT id FROM bookings
        WHERE status = 'confirmed'
          AND start_time < $2
          AND end_time > $1
        FOR UPDATE;
      `;

      const overlapResult = await client.query(overlapQuery, [dto.startTime, dto.endTime]);

      if (overlapResult.rows.length > 0) {
        throw new Error('SLOT_ALREADY_BOOKED');
      }

      const insertQuery = `
        INSERT INTO bookings (customer_name, customer_phone, service_id, start_time, end_time)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *;
      `;

      const result = await client.query(insertQuery, [
        dto.customerName,
        dto.customerPhone,
        dto.serviceId,
        dto.startTime,
        dto.endTime
      ]);

      await client.query('COMMIT');
      return result.rows[0];

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
