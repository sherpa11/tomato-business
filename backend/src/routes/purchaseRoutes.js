import express from 'express';
import {
  createPurchase,
  getPurchases,
  getPurchaseById,
  updatePurchase,
  voidPurchase,
  getConsolidatedBill,
  saveBillDeductions
} from '../controllers/purchaseController.js';
import { protect, requireAdmin } from '../middleware/auth.js';
import { validateObjectId } from '../middleware/security.js';

const router = express.Router();

// Strict RBAC: All purchase & supplier bill operations are Admin-only
router.get('/', protect, requireAdmin, getPurchases);
router.post('/', protect, requireAdmin, createPurchase);

// Consolidated supplier bill routes (must be defined before /:id)
router.get('/consolidated', protect, requireAdmin, getConsolidatedBill);
router.put('/consolidated/deductions', protect, requireAdmin, saveBillDeductions);

router.get('/:id', protect, requireAdmin, validateObjectId('id'), getPurchaseById);
router.put('/:id', protect, requireAdmin, validateObjectId('id'), updatePurchase);
router.post('/:id/void', protect, requireAdmin, validateObjectId('id'), voidPurchase);

export default router;
