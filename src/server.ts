import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';
import { BookingService } from './services/booking.service.js';
import { LockService } from './services/lock.service.js';
import { CalendarService } from './services/calendar.service.js';
import { SlotService } from './services/slot.service.js';
import { generateZaloDeepLink } from './utils/zalo.js';

// Admin API
import { adminAuthMiddleware } from './middlewares/auth.middleware.js';
import { loginAdmin } from './controllers/admin/auth.controller.js';
import { getServices, createService, updateService, deleteService } from './controllers/admin/service.controller.js';
import { getBookings, updateBookingStatus, createManualBooking } from './controllers/admin/booking.controller.js';
import { getBlockedSlots, createBlockedSlot, deleteBlockedSlot } from './controllers/admin/blocked.controller.js';
import { getBusinessHours, updateBusinessHours } from './controllers/admin/business-hours.controller.js';
import { getGoogleConfigs, createGoogleConfig, updateGoogleConfig, activateGoogleConfig, deleteGoogleConfig, getGoogleAuthUrl, googleAuthCallback } from './controllers/admin/google.controller.js';


dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

// Shop owner's Zalo phone number (loaded from env or fallback)
const SHOP_PHONE = process.env.SHOP_ZALO_PHONE || '0900000000';

// Serve static frontend from public/
app.use(express.static(path.join(__dirname, '..', 'public'), {
  extensions: ['html']
}));
app.use(express.json());


// ─── Real-time Socket.IO ─────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Hold a slot via WebSocket (primary method)
  socket.on('hold_slot', async (data: { slotKey: string }) => {
    const success = await LockService.acquireSlotHold(data.slotKey, socket.id);
    if (success) {
      io.emit('slot_held', { slotKey: data.slotKey, by: socket.id });
    } else {
      socket.emit('hold_failed', { slotKey: data.slotKey, message: 'Slot is currently being held' });
    }
  });

  // Release a held slot when user cancels selection
  socket.on('release_slot', async (data: { slotKey: string }) => {
    await LockService.releaseSlotHold(data.slotKey, socket.id);
    io.emit('slot_released', { slotKey: data.slotKey });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// ─── REST Endpoints ──────────────────────────────────────────────────────────

// Endpoint: Ping to avoid Render spindown
app.get('/ping', (_req, res) => {
  res.status(200).send('PONG');
});

// ── Task 2.1: Available Slots ──────────────────────────────────────────────
// GET /api/slots?date=YYYY-MM-DD
// Returns all 30-min slots for that day, filtering out confirmed bookings and
// active Redis holds.
app.get('/api/slots', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date || typeof date !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Query param "date" is required (format: YYYY-MM-DD)'
      });
    }

    const slots = await SlotService.getAvailableSlots(date);
    return res.status(200).json({ success: true, date, slots });
  } catch (error: any) {
    if (error.message === 'INVALID_DATE_FORMAT') {
      return res.status(400).json({ success: false, message: 'Invalid date format. Use YYYY-MM-DD.' });
    }
    return res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
});

// ── Task 2.2: REST Slot Hold (WebSocket fallback) ──────────────────────────
// POST /api/slots/hold
// Body: { slotKey: string, sessionId: string }
// Holds a slot via Redis for 180 seconds. Use this when WebSocket is unavailable.
app.post('/api/slots/hold', async (req, res) => {
  try {
    const { slotKey, sessionId } = req.body as { slotKey?: string; sessionId?: string };

    if (!slotKey || !sessionId) {
      return res.status(400).json({
        success: false,
        message: '"slotKey" and "sessionId" are required in the request body'
      });
    }

    const success = await LockService.acquireSlotHold(slotKey, sessionId);

    if (success) {
      // Broadcast to all WebSocket clients so the UI reflects the hold
      io.emit('slot_held', { slotKey, by: sessionId });
      return res.status(200).json({
        success: true,
        message: 'Slot held for 180 seconds',
        slotKey,
        expiresInSeconds: 180
      });
    } else {
      return res.status(409).json({
        success: false,
        message: 'Slot is currently being held by another user',
        slotKey
      });
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
});

// DELETE /api/slots/hold — Release a held slot
app.delete('/api/slots/hold', async (req, res) => {
  try {
    const { slotKey, sessionId } = req.body as { slotKey?: string; sessionId?: string };
    if (!slotKey || !sessionId) {
      return res.status(400).json({ success: false, message: '"slotKey" and "sessionId" are required' });
    }
    await LockService.releaseSlotHold(slotKey, sessionId);
    io.emit('slot_released', { slotKey });
    return res.status(200).json({ success: true, message: 'Slot released', slotKey });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
});

// ── Booking Creation ───────────────────────────────────────────────────────
// POST /api/bookings
// Body: CreateBookingDTO + optional serviceName for Zalo link
app.post('/api/bookings', async (req, res) => {
  try {
    const { serviceName, ...bookingDto } = req.body;
    const booking = await BookingService.createBooking(bookingDto);

    // Notify connected clients via WebSockets
    io.emit('booking_confirmed', { startTime: booking.start_time, endTime: booking.end_time });

    // Build Zalo deep-link for customer to message the shop
    const zaloLink = generateZaloDeepLink(SHOP_PHONE, {
      customerName: booking.customer_name,
      serviceName: serviceName || 'Dịch vụ Nail/Spa',
      startTime: booking.start_time,
      endTime: booking.end_time
    });

    // Asynchronously sync to Google Calendar (non-blocking)
    // On success, persist the Google Event ID back to the booking row
    CalendarService.syncBookingToGoogleCalendar(booking)
      .then(eventId => {
        if (eventId) BookingService.setGoogleEventId(booking.id, eventId);
      })
      .catch(err => console.error('[server] Google Calendar sync error:', err));

    return res.status(201).json({ success: true, booking, zaloLink });
  } catch (error: any) {
    const msg = error.message as string;

    // 400 — Client input errors
    const inputErrors: Record<string, string> = {
      MISSING_CUSTOMER_NAME: 'Thiếu tên khách hàng',
      MISSING_CUSTOMER_PHONE: 'Thiếu số điện thoại',
      MISSING_TIME_RANGE: 'Thiếu thời gian đặt lịch',
      INVALID_TIME_RANGE: 'Thời gian kết thúc phải sau thời gian bắt đầu',
      INVALID_SERVICE: 'Dịch vụ không tồn tại'
    };
    if (msg in inputErrors) {
      return res.status(400).json({ success: false, message: inputErrors[msg] });
    }

    // 409 — Booking conflict
    if (msg === 'SLOT_ALREADY_BOOKED') {
      return res.status(409).json({ success: false, message: 'Khung giờ này vừa có người đặt' });
    }

    // 500 — Unexpected server error
    console.error('[POST /api/bookings] Unexpected error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ', error: msg });
  }
});

// ─── ADMIN API ───────────────────────────────────────────────────────────────

app.post('/api/admin/login', loginAdmin);

// Services CRUD (protected)
app.get('/api/admin/services', adminAuthMiddleware, getServices);
app.post('/api/admin/services', adminAuthMiddleware, createService);
app.put('/api/admin/services/:id', adminAuthMiddleware, updateService);
app.delete('/api/admin/services/:id', adminAuthMiddleware, deleteService);

// Bookings
app.get('/api/admin/bookings', adminAuthMiddleware, getBookings);
app.patch('/api/admin/bookings/:id/status', adminAuthMiddleware, updateBookingStatus);
app.post('/api/admin/bookings/manual', adminAuthMiddleware, createManualBooking);

// Business Hours
app.get('/api/admin/business-hours', adminAuthMiddleware, getBusinessHours);
app.put('/api/admin/business-hours', adminAuthMiddleware, updateBusinessHours);

// Blocked Slots
app.get('/api/admin/blocked-slots', adminAuthMiddleware, getBlockedSlots);
app.post('/api/admin/blocked-slots', adminAuthMiddleware, createBlockedSlot);
app.delete('/api/admin/blocked-slots/:id', adminAuthMiddleware, deleteBlockedSlot);

// Google Calendar Configs
app.get('/api/admin/google-configs', adminAuthMiddleware, getGoogleConfigs);
app.post('/api/admin/google-configs', adminAuthMiddleware, createGoogleConfig);
app.put('/api/admin/google-configs/:id', adminAuthMiddleware, updateGoogleConfig);
app.patch('/api/admin/google-configs/:id/activate', adminAuthMiddleware, activateGoogleConfig);
app.delete('/api/admin/google-configs/:id', adminAuthMiddleware, deleteGoogleConfig);

// Google OAuth
app.get('/api/admin/google-auth/url', adminAuthMiddleware, getGoogleAuthUrl);
app.get('/api/admin/google-auth/callback', googleAuthCallback);

// ─── Start Server ─────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`   GET  /ping`);
  console.log(`   GET  /api/slots?date=YYYY-MM-DD`);
  console.log(`   POST /api/slots/hold`);
  console.log(`   DEL  /api/slots/hold`);
  console.log(`   POST /api/bookings`);
});
