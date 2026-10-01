import { Router } from 'express';
import bookingRoutes from './booking.routes.js';
import slotRoutes from './slot.routes.js';

import adminRoutes from './admin.routes.js';
import serviceRoutes from './service.routes.js';

const router = Router();

// API routes
router.use('/bookings', bookingRoutes);
router.use('/slots', slotRoutes);
router.use('/admin', adminRoutes);
router.use('/admin/services', serviceRoutes);

export default router;
