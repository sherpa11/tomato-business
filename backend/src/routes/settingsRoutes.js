import express from 'express';
import { getSettings, updateSettings } from '../controllers/settingsController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/', protect, getSettings);
router.put('/', protect, updateSettings);

export default router;
