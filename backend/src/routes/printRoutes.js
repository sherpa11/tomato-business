import express from 'express';
import {
  getPrinterStatus,
  directPrintBill,
  streamBillPdf
} from '../controllers/printController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Allow checking printer status
router.get('/status', protect, getPrinterStatus);

// Direct print endpoint
router.post('/direct', protect, directPrintBill);

// Stream 1-page PDF
router.post('/pdf', protect, streamBillPdf);

export default router;
