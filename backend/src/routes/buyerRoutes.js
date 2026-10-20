import express from 'express';
import {
  getBuyers,
  getBuyerById,
  createBuyer,
  updateBuyer,
  getBuyerLedger,
  recalculateBuyer,
  deleteBuyer
} from '../controllers/buyerController.js';
import { protect } from '../middleware/auth.js';
import { validateObjectId } from '../middleware/security.js';

const router = express.Router();

router.get('/', protect, getBuyers);
router.post('/', protect, createBuyer);
router.get('/:id', protect, validateObjectId('id'), getBuyerById);
router.put('/:id', protect, validateObjectId('id'), updateBuyer);
router.delete('/:id', protect, validateObjectId('id'), deleteBuyer);
router.get('/:id/ledger', protect, validateObjectId('id'), getBuyerLedger);
router.post('/:id/recalculate', protect, validateObjectId('id'), recalculateBuyer);

export default router;

