import { pool } from '../config/database.js';

export interface CreateBookingDTO {
  customerName: string;
  customerPhone: string;
  serviceIds: number[];
  startTime: string;
  // endTime is now calculated on the server
}

export class BookingService {
  static async createBooking(dto: CreateBookingDTO) {
    if (!dto.serviceIds || dto.serviceIds.length === 0) {
      throw new Error('AT_LEAST_ONE_SERVICE_REQUIRED');
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Calculate total duration from services
      const servicesQuery = 'SELECT id, duration_minutes, name FROM services WHERE id = ANY($1::int[])';
      const servicesResult = await client.query(servicesQuery, [dto.serviceIds]);
      
      if (servicesResult.rows.length !== dto.serviceIds.length) {
        throw new Error('INVALID_SERVICE_ID');
      }

      const totalDurationMinutes = servicesResult.rows.reduce((sum, s) => sum + s.duration_minutes, 0);
      const serviceNames = servicesResult.rows.map(s => s.name).join(', ');

      // Calculate end time
      const startTimeDate = new Date(dto.startTime);
      const endTimeDate = new Date(startTimeDate.getTime() + totalDurationMinutes * 60000);
      const endTimeIso = endTimeDate.toISOString();

      // 2. Pessimistic lock check for overlapping slots
      const overlapQuery = `
        SELECT id FROM bookings
        WHERE status = 'confirmed'
          AND start_time < $2
          AND end_time > $1
        FOR UPDATE;
      `;
      const overlapResult = await client.query(overlapQuery, [dto.startTime, endTimeIso]);

      if (overlapResult.rows.length > 0) {
        throw new Error('SLOT_ALREADY_BOOKED');
      }

      // 3. Insert into bookings (without service_id)
      const insertBookingQuery = `
        INSERT INTO bookings (customer_name, customer_phone, start_time, end_time)
        VALUES ($1, $2, $3, $4)
        RETURNING *;
      `;
      const bookingResult = await client.query(insertBookingQuery, [
        dto.customerName,
        dto.customerPhone,
        dto.startTime,
        endTimeIso
      ]);
      const booking = bookingResult.rows[0];

      // 4. Insert into booking_services
      for (const serviceId of dto.serviceIds) {
        await client.query(
          'INSERT INTO booking_services (booking_id, service_id) VALUES ($1, $2)',
          [booking.id, serviceId]
        );
      }

      await client.query('COMMIT');
      
      // Attach service names for Google Calendar description
      booking.serviceNames = serviceNames;
      
      return booking;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getAllBookings(date?: string, status?: string) {
    let query = `
      SELECT b.*, 
             string_agg(s.name, ', ') as service_name
      FROM bookings b
      LEFT JOIN booking_services bs ON b.id = bs.booking_id
      LEFT JOIN services s ON bs.service_id = s.id
      WHERE 1=1
    `;
    const values: any[] = [];
    let paramIndex = 1;

    if (date) {
      query += ` AND DATE(b.start_time AT TIME ZONE 'Asia/Ho_Chi_Minh') = $${paramIndex}`;
      values.push(date);
      paramIndex++;
    }

    if (status) {
      query += ` AND b.status = $${paramIndex}`;
      values.push(status);
      paramIndex++;
    }

    query += ` GROUP BY b.id ORDER BY b.start_time DESC`;

    const result = await pool.query(query, values);
    return result.rows;
  }

  static async updateBookingStatus(id: string, status: string) {
    const query = `
      UPDATE bookings
      SET status = $1
      WHERE id = $2
      RETURNING *;
    `;
    const result = await pool.query(query, [status, id]);
    if (result.rows.length === 0) throw new Error('Booking not found');
    return result.rows[0];
  }
}
