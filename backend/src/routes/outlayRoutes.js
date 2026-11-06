import express from 'express';
import {
  getOutlays,
  getOutlaySummary,
  createOutlay,
  updateOutlay,
  voidOutlay,
  deleteOutlay
} from '../controllers/outlayController.js';
import { protect, requireAdmin } from '../middleware/auth.js';
import { validateObjectId } from '../middleware/security.js';

const router = express.Router();

// Strict RBAC: All Outlay endpoints are strictly Admin-only.
// Authenticated Accountant requests will be rejected with HTTP 403 Forbidden.
router.use(protect, requireAdmin);

router.get('/', getOutlays);
router.get('/summary', getOutlaySummary);
router.post('/', createOutlay);
router.put('/:id', validateObjectId('id'), updateOutlay);
router.delete('/:id', validateObjectId('id'), deleteOutlay);
router.post('/:id/void', validateObjectId('id'), voidOutlay);

export default router;
