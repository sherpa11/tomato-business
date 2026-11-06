import express from 'express';
import {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  getSupplierPurchases,
  deleteSupplier
} from '../controllers/supplierController.js';
import { protect, requireAdmin } from '../middleware/auth.js';
import { validateObjectId } from '../middleware/security.js';

const router = express.Router();

// Strict RBAC: All supplier operations are Admin-only
router.get('/', protect, requireAdmin, getSuppliers);
router.post('/', protect, requireAdmin, createSupplier);
router.get('/:id', protect, requireAdmin, validateObjectId('id'), getSupplierById);
router.put('/:id', protect, requireAdmin, validateObjectId('id'), updateSupplier);
router.delete('/:id', protect, requireAdmin, validateObjectId('id'), deleteSupplier);
router.get('/:id/purchases', protect, requireAdmin, validateObjectId('id'), getSupplierPurchases);

export default router;

