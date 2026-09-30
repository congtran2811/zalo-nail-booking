import { Router } from 'express';
import bookingRoutes from './booking.routes.js';

const router = Router();

// Booking routes
router.use('/bookings', bookingRoutes);

export default router;
