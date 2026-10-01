import { Router } from 'express';
import { getServices, addService, updateService, deleteService } from '../controllers/service.controller.js';

const router = Router();

router.get('/', getServices);
router.post('/', addService);
router.put('/:id', updateService);
router.delete('/:id', deleteService);

export default router;
