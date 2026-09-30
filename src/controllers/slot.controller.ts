import { Request, Response } from 'express';
import { pool } from '../config/database.js';
import { LockService } from '../services/lock.service.js';
import { getIO } from '../socket/index.js';

export const getSlots = async (req: Request, res: Response) => {
  try {
    const { date } = req.query;
    if (!date || typeof date !== 'string') {
      return res.status(400).json({ success: false, message: 'Date is required (YYYY-MM-DD)' });
    }

    // Default business hours: 09:00 to 18:00
    const startHour = 9;
    const endHour = 18;
    const slotDurationMinutes = 30;

    const allSlots = [];
    const dateObj = new Date(date);
    
    // Generate all slots
    for (let hour = startHour; hour < endHour; hour++) {
      for (let min = 0; min < 60; min += slotDurationMinutes) {
        const h = hour.toString().padStart(2, '0');
        const m = min.toString().padStart(2, '0');
        allSlots.push(`${h}:${m}`);
      }
    }

    // Fetch existing bookings for this date
    const bookingsQuery = `
      SELECT start_time, end_time 
      FROM bookings 
      WHERE status = 'confirmed' 
        AND DATE(start_time AT TIME ZONE 'UTC') = $1
    `;
    const bookingsResult = await pool.query(bookingsQuery, [date]);

    const bookedIntervals = bookingsResult.rows.map(b => ({
      start: new Date(b.start_time).getTime(),
      end: new Date(b.end_time).getTime()
    }));

    const availableSlots = [];

    for (const timeStr of allSlots) {
      const [h, m] = timeStr.split(':').map(Number);
      const timeStrFormatted = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`;
      const slotIsoString = `${date}T${timeStrFormatted}+07:00`;
      const slotStartTime = new Date(slotIsoString).getTime();
      
      const slotEndTime = slotStartTime + (slotDurationMinutes * 60000);

      // Check if this slot overlaps with any confirmed booking
      let isBooked = false;
      for (const booking of bookedIntervals) {
        if (slotStartTime < booking.end && slotEndTime > booking.start) {
          isBooked = true;
          break;
        }
      }

      // Also check Redis if it's currently held
      const slotKey = `${date}_${slotIsoString}`;
      const isHeld = await LockService.isSlotHeld(slotKey);

      availableSlots.push({
        start: slotIsoString,
        available: !isBooked && !isHeld
      });
    }

    return res.status(200).json({ success: true, slots: availableSlots });
  } catch (error: any) {
    console.error('Error fetching slots:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const holdSlot = async (req: Request, res: Response) => {
  try {
    const { slotKey, sessionId } = req.body;
    if (!slotKey || !sessionId) {
      return res.status(400).json({ success: false, message: 'Missing parameters' });
    }
    const success = await LockService.acquireSlotHold(slotKey, sessionId);
    if (success) {
      const io = getIO();
      if (io) io.emit('slot_held', { slotKey, by: sessionId });
      return res.status(200).json({ success: true });
    } else {
      return res.status(409).json({ success: false, message: 'Slot is currently being held' });
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const releaseSlot = async (req: Request, res: Response) => {
  try {
    const { slotKey, sessionId } = req.body;
    if (!slotKey || !sessionId) {
      return res.status(400).json({ success: false, message: 'Missing parameters' });
    }
    // We only release it if it's currently held by this sessionId (or we just release it for simplicity)
    await LockService.releaseSlotHold(slotKey, sessionId);
    const io = getIO();
    if (io) io.emit('slot_released', { slotKey });
    return res.status(200).json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
