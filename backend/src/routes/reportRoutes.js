import express from 'express';
import { getReports } from '../controllers/reportController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/', protect, getReports);

export default router;
