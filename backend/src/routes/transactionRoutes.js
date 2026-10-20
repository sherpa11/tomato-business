import express from 'express';
import {
  createSale,
  createPayment,
  getTransactions,
  getTransactionById,
  voidTransaction,
  getConsolidatedBill
} from '../controllers/transactionController.js';
import { protect } from '../middleware/auth.js';
import { validateObjectId } from '../middleware/security.js';

const router = express.Router();

router.post('/sale', protect, createSale);
router.post('/payment', protect, createPayment);
router.get('/', protect, getTransactions);
router.get('/consolidated', protect, getConsolidatedBill);
router.get('/:id', protect, validateObjectId('id'), getTransactionById);
router.post('/:id/void', protect, validateObjectId('id'), voidTransaction);

export default router;
