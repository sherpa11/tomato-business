import express from 'express';
import { getSettings, updateSettings } from '../controllers/settingsController.js';
import { protect, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.get('/', protect, getSettings);
router.put('/', protect, requireAdmin, updateSettings);

export default router;
