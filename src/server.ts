import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { BookingService } from './services/booking.service.js';
import { LockService } from './services/lock.service.js';
import { CalendarService } from './services/calendar.service.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

app.use(express.json());

// Real-time Socket Connection
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('hold_slot', async (data: { slotKey: string }) => {
    const success = await LockService.acquireSlotHold(data.slotKey, socket.id);
    if (success) {
      io.emit('slot_held', { slotKey: data.slotKey, by: socket.id });
    } else {
      socket.emit('hold_failed', { slotKey: data.slotKey, message: 'Slot is currently being held' });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Endpoint: Ping to avoid Render spindown
app.get('/ping', (_req, res) => {
  res.status(200).send('PONG');
});

// Endpoint: Booking Creation
app.post('/api/bookings', async (req, res) => {
  try {
    const booking = await BookingService.createBooking(req.body);

    // Notify connected clients via WebSockets
    io.emit('booking_confirmed', { startTime: booking.start_time, endTime: booking.end_time });

    // Asynchronously sync to Google Calendar
    CalendarService.syncBookingToGoogleCalendar(booking).catch(console.error);

    return res.status(201).json({ success: true, booking });
  } catch (error: any) {
    if (error.message === 'SLOT_ALREADY_BOOKED') {
      return res.status(409).json({ success: false, message: 'Khung giờ này vừa có người đặt' });
    }
    return res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
