import { Request, Response } from 'express';
import { BookingService } from '../services/booking.service.js';
import { CalendarService } from '../services/calendar.service.js';
import { getIO } from '../socket/index.js';

export const createBooking = async (req: Request, res: Response) => {
  try {
    const booking = await BookingService.createBooking(req.body);

    // Notify connected clients via WebSockets
    const io = getIO();
    if (io) {
      io.emit('booking_confirmed', { startTime: booking.start_time, endTime: booking.end_time });
    }

    // Asynchronously sync to Google Calendar
    CalendarService.syncBookingToGoogleCalendar(booking).catch(console.error);

    return res.status(201).json({ success: true, booking });
  } catch (error: any) {
    if (error.message === 'SLOT_ALREADY_BOOKED') {
      return res.status(409).json({ success: false, message: 'Khung giờ này vừa có người đặt' });
    }
    return res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};
