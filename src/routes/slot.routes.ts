import { Router } from 'express';
import { getSlots } from '../controllers/slot.controller.js';

import { holdSlot, releaseSlot } from '../controllers/slot.controller.js';

const router = Router();

// Endpoint: Get Available Slots
router.get('/', getSlots);

// Endpoints: Hold and Release Slots
router.post('/hold', holdSlot);
router.delete('/hold', releaseSlot);

export default router;
