import { Router } from 'express';
import bookingRoutes from './booking.routes.js';
import slotRoutes from './slot.routes.js';

const router = Router();

// API routes
router.use('/bookings', bookingRoutes);
router.use('/slots', slotRoutes);

export default router;
