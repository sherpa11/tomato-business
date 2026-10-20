import Purchase from '../models/Purchase.js';
import Supplier from '../models/Supplier.js';
import { calculateBigEquivalent, roundMoney } from '../services/ledgerService.js';
import {
  getConsolidatedSupplierBill,
  saveSupplierBillDeductions
} from '../services/supplierBillService.js';

export const createPurchase = async (req, res, next) => {
  try {
    const { supplierId, transactionDate, bigBoxes, smallBoxes, ratePerBigBox, notes } = req.body;

    if (!supplierId) {
      return res.status(400).json({ success: false, message: 'Supplier is required' });
    }
    if (!transactionDate || !/^\d{4}-\d{2}-\d{2}$/.test(transactionDate)) {
      return res.status(400).json({ success: false, message: 'Valid transaction date (YYYY-MM-DD) is required' });
    }

    const supplier = await Supplier.findById(supplierId);
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    const big = Number(bigBoxes) || 0;
    const small = Number(smallBoxes) || 0;
    const rate = Number(ratePerBigBox);

    if (big < 0 || small < 0) {
      return res.status(400).json({ success: false, message: 'Box quantities cannot be negative' });
    }
    if (big === 0 && small === 0) {
      return res.status(400).json({ success: false, message: 'At least one box (Big or Small) is required for purchase' });
    }
    if (isNaN(rate) || rate <= 0) {
      return res.status(400).json({ success: false, message: 'Purchase rate per Big Box must be greater than zero' });
    }

    const bigEquivalent = calculateBigEquivalent(big, small);
    const totalAmount = roundMoney(bigEquivalent * rate);

    const purchase = await Purchase.create({
      supplierId: supplier._id,
      supplierName: supplier.name,
      transactionDate,
      bigBoxes: big,
      smallBoxes: small,
      bigEquivalent,
      ratePerBigBox: rate,
      totalAmount,
      notes: notes ? notes.trim() : ''
    });

    res.status(201).json({
      success: true,
      purchase,
      message: `Purchase recorded: ${bigEquivalent} Big Box Eqv @ ₹${rate.toLocaleString('en-IN')} = ₹${totalAmount.toLocaleString('en-IN')}`
    });
  } catch (error) {
    next(error);
  }
};

export const getPurchases = async (req, res, next) => {
  try {
    const { date, startDate, endDate, supplierId, isVoid } = req.query;
    let query = {};

    if (isVoid !== undefined) {
      query.isVoid = isVoid === 'true';
    }

    if (date) {
      query.transactionDate = date;
    } else if (startDate || endDate) {
      query.transactionDate = {};
      if (startDate) query.transactionDate.$gte = startDate;
      if (endDate) query.transactionDate.$lte = endDate;
    }

    if (supplierId) {
      query.supplierId = supplierId;
    }

    const purchases = await Purchase.find(query).sort({ transactionDate: -1, createdAt: -1 });

    // Aggregate totals for the filtered results
    let totalBigBoxes = 0;
    let totalSmallBoxes = 0;
    let totalBigEquivalent = 0;
    let totalAmount = 0;

    purchases.forEach((p) => {
      if (!p.isVoid) {
        totalBigBoxes += p.bigBoxes;
        totalSmallBoxes += p.smallBoxes;
        totalBigEquivalent += p.bigEquivalent;
        totalAmount += p.totalAmount;
      }
    });

    res.json({
      success: true,
      count: purchases.length,
      totals: {
        totalBigBoxes,
        totalSmallBoxes,
        totalBigEquivalent: roundMoney(totalBigEquivalent),
        totalAmount: roundMoney(totalAmount)
      },
      purchases
    });
  } catch (error) {
    next(error);
  }
};

export const getPurchaseById = async (req, res, next) => {
  try {
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) {
      return res.status(404).json({ success: false, message: 'Purchase not found' });
    }
    res.json({ success: true, purchase });
  } catch (error) {
    next(error);
  }
};

export const voidPurchase = async (req, res, next) => {
  try {
    const { voidReason } = req.body;
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) {
      return res.status(404).json({ success: false, message: 'Purchase not found' });
    }

    if (purchase.isVoid) {
      return res.status(400).json({ success: false, message: 'This purchase is already voided' });
    }

    purchase.isVoid = true;
    purchase.voidReason = voidReason || 'Voided by user';
    await purchase.save();

    res.json({ success: true, purchase, message: 'Purchase voided successfully' });
  } catch (error) {
    next(error);
  }
};

export const getConsolidatedBill = async (req, res, next) => {
  try {
    const { supplierId, transactionDate, purchaseId } = req.query;
    const bill = await getConsolidatedSupplierBill({
      supplierId,
      transactionDate,
      purchaseId
    });
    res.json({ success: true, bill });
  } catch (error) {
    next(error);
  }
};

export const saveBillDeductions = async (req, res, next) => {
  try {
    const { supplierId, transactionDate, commission, gate, coolie, rent, debit, notes } = req.body;
    const bill = await saveSupplierBillDeductions({
      supplierId,
      transactionDate,
      commission,
      gate,
      coolie,
      rent,
      debit,
      notes
    });
    res.json({ success: true, message: 'Deductions saved successfully', bill });
  } catch (error) {
    next(error);
  }
};

