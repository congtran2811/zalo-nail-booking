import { Router } from 'express';
import { createBooking } from '../controllers/booking.controller.js';

const router = Router();

// Endpoint: Booking Creation
router.post('/', createBooking);

export default router;
