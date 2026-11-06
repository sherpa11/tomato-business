import express from 'express';
import { getReports } from '../controllers/reportController.js';
import { protect, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Strict RBAC: Reports are Admin-only
router.get('/', protect, requireAdmin, getReports);

export default router;
