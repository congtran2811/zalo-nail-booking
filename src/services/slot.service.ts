import { pool } from '../config/database.js';
import { redis } from '../config/redis.js';

export interface TimeSlot {
  start: string; // ISO string
  end: string;   // ISO string
  available: boolean;
}

/**
 * Generate all possible slots for a given date based on shop hours.
 * Slot intervals: 30 minutes (default)
 */
function generateDaySlots(date: string, openTimeStr: string, closeTimeStr: string, intervalMinutes = 30): Array<{ start: Date; end: Date }> {
  const slots: Array<{ start: Date; end: Date }> = [];
  
  let current = new Date(`${date}T${openTimeStr}+07:00`);
  const closeTime = new Date(`${date}T${closeTimeStr}+07:00`);

  while (current < closeTime) {
    const slotEnd = new Date(current.getTime() + intervalMinutes * 60 * 1000);
    if (slotEnd <= closeTime) {
      slots.push({ start: new Date(current), end: slotEnd });
    }
    current = slotEnd;
  }

  return slots;
}

export class SlotService {
  /**
   * GET /api/slots?date=YYYY-MM-DD
   * Returns available slots, filtering out:
   *   1. Bookings confirmed in PostgreSQL
   *   2. Admin Blocked Slots (blocked_slots table)
   *   3. Active Redis holds (lock:hold:*)
   */
  static async getAvailableSlots(date: string): Promise<TimeSlot[]> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error('INVALID_DATE_FORMAT');
    }

    // 1. Fetch confirmed bookings for this date from PostgreSQL
    const bookingQuery = `
      SELECT start_time, end_time FROM bookings
      WHERE status = 'confirmed'
        AND DATE(start_time AT TIME ZONE 'Asia/Ho_Chi_Minh') = $1::date
    `;
    const { rows: bookedSlots } = await pool.query(bookingQuery, [date]);

    // 1.5. Fetch blocked slots for this date
    const blockedQuery = `
      SELECT start_time, end_time FROM blocked_slots
      WHERE DATE(start_time AT TIME ZONE 'Asia/Ho_Chi_Minh') = $1::date
         OR DATE(end_time AT TIME ZONE 'Asia/Ho_Chi_Minh') = $1::date
    `;
    const { rows: blockedSlots } = await pool.query(blockedQuery, [date]);

    // 2. Fetch active Redis holds: keys matching lock:hold:YYYY-MM-DD_*
    const pattern = `lock:hold:${date}_*`;
    const heldKeys = await redis.keys(pattern);
    const heldSlotKeys = new Set(heldKeys.map((k: string) => k.replace('lock:hold:', '')));

    // 2.5 Fetch Business Hours for the day of week
    const targetDate = new Date(`${date}T00:00:00+07:00`);
    const dayOfWeek = targetDate.getDay(); // 0 for Sunday, 1 for Monday
    
    const { rows: businessRows } = await pool.query(
      'SELECT open_time, close_time, is_closed FROM business_hours WHERE day_of_week = $1',
      [dayOfWeek]
    );

    const bizHours = businessRows[0] || { open_time: '08:00:00', close_time: '20:00:00', is_closed: false };
    
    if (bizHours.is_closed) {
      return []; // Shop is closed this day
    }

    // 3. Generate all possible day slots based on business hours
    let allSlots = generateDaySlots(date, bizHours.open_time, bizHours.close_time);

    // 3.5. Filter out past slots
    const now = new Date();
    allSlots = allSlots.filter(slot => slot.start > now);

    // 4. Mark each slot as available or not
    return allSlots.map(slot => {
      const slotKey = `${date}_${slot.start.toISOString()}`;

      // Check overlap with a confirmed booking
      const isBooked = bookedSlots.some(b =>
        new Date(b.start_time) < slot.end && new Date(b.end_time) > slot.start
      );

      // Check overlap with admin blocked slots
      const isBlocked = blockedSlots.some(b => 
        new Date(b.start_time) < slot.end && new Date(b.end_time) > slot.start
      );

      // Check if Redis hold exists for this slot
      const isHeld = heldSlotKeys.has(slotKey);

      return {
        start: slot.start.toISOString(),
        end: slot.end.toISOString(),
        available: !isBooked && !isBlocked && !isHeld
      };
    });
  }
}
