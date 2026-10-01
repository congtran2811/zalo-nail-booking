import { Router } from 'express';
import { 
  login, getBookings, updateBookingStatus,
  getGoogleAuthUrl, handleGoogleCallback, getGoogleConfigs, activateGoogleConfig, deleteGoogleConfig,
  getBusinessHours, updateBusinessHours,
  getBlockedSlots, addBlockedSlot, deleteBlockedSlot
} from '../controllers/admin.controller.js';

const router = Router();

// Admin Authentication
router.post('/login', login);

// Endpoints for admin bookings
router.get('/bookings', getBookings);
router.patch('/bookings/:id/status', updateBookingStatus);

// Endpoints for admin settings
router.get('/google-auth/url', getGoogleAuthUrl);
router.get('/google-auth/callback', handleGoogleCallback);
router.get('/google-configs', getGoogleConfigs);
router.patch('/google-configs/:id/activate', activateGoogleConfig);
router.delete('/google-configs/:id', deleteGoogleConfig);

router.get('/business-hours', getBusinessHours);
router.put('/business-hours', updateBusinessHours);

router.get('/blocked-slots', getBlockedSlots);
router.post('/blocked-slots', addBlockedSlot);
router.delete('/blocked-slots/:id', deleteBlockedSlot);

export default router;
