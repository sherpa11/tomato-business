import Purchase from '../models/Purchase.js';
import Supplier from '../models/Supplier.js';
import { calculateBigEquivalent, roundMoney } from '../services/ledgerService.js';
import {
  getConsolidatedSupplierBill,
  saveSupplierBillDeductions
} from '../services/supplierBillService.js';

export const createPurchase = async (req, res, next) => {
  try {
    const { supplierId, transactionDate, bigBoxes, smallBoxes, ratePerBigBox, notes, items } = req.body;

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

    let processedItems = [];
    let totalBig = 0;
    let totalSmall = 0;
    let totalBigEq = 0;
    let totalAmount = 0;

    if (Array.isArray(items) && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const b = Number(it.bigBoxes) || 0;
        const s = Number(it.smallBoxes) || 0;
        const rate = Math.round(Number(it.ratePerBigBox));

        if (b < 0 || s < 0) {
          return res.status(400).json({ success: false, message: `Row ${i + 1}: Box quantities cannot be negative` });
        }
        if (b === 0 && s === 0) {
          return res.status(400).json({ success: false, message: `Row ${i + 1}: At least one box (Big or Small) is required` });
        }
        if (isNaN(rate) || rate <= 0) {
          return res.status(400).json({ success: false, message: `Row ${i + 1}: Purchase rate must be greater than zero` });
        }

        const eq = calculateBigEquivalent(b, s);
        const lineAmt = roundMoney(eq * rate);

        totalBig += b;
        totalSmall += s;
        totalBigEq += eq;
        totalAmount += lineAmt;

        processedItems.push({
          bigBoxes: b,
          smallBoxes: s,
          bigEquivalent: eq,
          ratePerBigBox: rate,
          lineAmount: lineAmt,
          totalAmount: lineAmt,
          notes: it.notes ? it.notes.trim() : ''
        });
      }
    } else {
      const big = Number(bigBoxes) || 0;
      const small = Number(smallBoxes) || 0;
      const rate = Math.round(Number(ratePerBigBox));

      if (big < 0 || small < 0) {
        return res.status(400).json({ success: false, message: 'Box quantities cannot be negative' });
      }
      if (big === 0 && small === 0) {
        return res.status(400).json({ success: false, message: 'At least one box (Big or Small) is required for purchase' });
      }
      if (isNaN(rate) || rate <= 0) {
        return res.status(400).json({ success: false, message: 'Purchase rate per Big Box must be greater than zero' });
      }

      totalBig = big;
      totalSmall = small;
      totalBigEq = calculateBigEquivalent(big, small);
      totalAmount = roundMoney(totalBigEq * rate);

      processedItems.push({
        bigBoxes: big,
        smallBoxes: small,
        bigEquivalent: totalBigEq,
        ratePerBigBox: rate,
        lineAmount: totalAmount,
        totalAmount,
        notes: notes ? notes.trim() : ''
      });
    }

    totalBigEq = Math.round((totalBigEq + Number.EPSILON) * 10) / 10;
    totalAmount = roundMoney(totalAmount);

    const effectiveRate = processedItems.length === 1
      ? processedItems[0].ratePerBigBox
      : (totalBigEq > 0 ? roundMoney(totalAmount / totalBigEq) : 0);

    const purchase = await Purchase.create({
      supplierId: supplier._id,
      supplierName: supplier.name,
      transactionDate,
      bigBoxes: totalBig,
      smallBoxes: totalSmall,
      bigEquivalent: totalBigEq,
      ratePerBigBox: effectiveRate,
      totalAmount,
      items: processedItems,
      notes: notes ? notes.trim() : ''
    });

    res.status(201).json({
      success: true,
      purchase,
      message: `Purchase recorded: ${totalBigEq} Big Box Eqv (${processedItems.length} lot${processedItems.length > 1 ? 's' : ''}) = ₹${totalAmount.toLocaleString('en-IN')}`
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

export const updatePurchase = async (req, res, next) => {
  try {
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) {
      return res.status(404).json({ success: false, message: 'Purchase not found' });
    }
    if (purchase.isVoid) {
      return res.status(400).json({ success: false, message: 'Cannot edit a voided purchase' });
    }

    const { bigBoxes, smallBoxes, ratePerBigBox, notes, transactionDate, supplierId } = req.body;

    if (supplierId) {
      const supplier = await Supplier.findById(supplierId);
      if (supplier) {
        purchase.supplierId = supplier._id;
        purchase.supplierName = supplier.name;
      }
    }

    if (transactionDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(transactionDate)) {
        return res.status(400).json({ success: false, message: 'Valid transaction date (YYYY-MM-DD) is required' });
      }
      purchase.transactionDate = transactionDate;
    }

    if (bigBoxes !== undefined) purchase.bigBoxes = Number(bigBoxes) || 0;
    if (smallBoxes !== undefined) purchase.smallBoxes = Number(smallBoxes) || 0;
    if (ratePerBigBox !== undefined) purchase.ratePerBigBox = Number(ratePerBigBox) || 0;

    purchase.bigEquivalent = calculateBigEquivalent(purchase.bigBoxes, purchase.smallBoxes);
    purchase.totalAmount = roundMoney(purchase.bigEquivalent * purchase.ratePerBigBox);

    if (notes !== undefined) {
      purchase.notes = notes.trim();
    }

    await purchase.save();

    res.json({
      success: true,
      purchase,
      message: 'Purchase updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

