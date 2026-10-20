import express from 'express';
import {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  getSupplierPurchases,
  deleteSupplier
} from '../controllers/supplierController.js';
import { protect } from '../middleware/auth.js';
import { validateObjectId } from '../middleware/security.js';

const router = express.Router();

router.get('/', protect, getSuppliers);
router.post('/', protect, createSupplier);
router.get('/:id', protect, validateObjectId('id'), getSupplierById);
router.put('/:id', protect, validateObjectId('id'), updateSupplier);
router.delete('/:id', protect, validateObjectId('id'), deleteSupplier);
router.get('/:id/purchases', protect, validateObjectId('id'), getSupplierPurchases);

export default router;

