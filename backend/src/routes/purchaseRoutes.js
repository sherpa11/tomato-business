import express from 'express';
import {
  createPurchase,
  getPurchases,
  getPurchaseById,
  voidPurchase,
  getConsolidatedBill,
  saveBillDeductions
} from '../controllers/purchaseController.js';
import { protect } from '../middleware/auth.js';
import { validateObjectId } from '../middleware/security.js';

const router = express.Router();

router.get('/', protect, getPurchases);
router.post('/', protect, createPurchase);

// Consolidated supplier bill routes (must be defined before /:id)
router.get('/consolidated', protect, getConsolidatedBill);
router.put('/consolidated/deductions', protect, saveBillDeductions);

router.get('/:id', protect, validateObjectId('id'), getPurchaseById);
router.post('/:id/void', protect, validateObjectId('id'), voidPurchase);

export default router;
