import Outlay from '../models/Outlay.js';
import Supplier from '../models/Supplier.js';
import { roundMoney } from '../services/ledgerService.js';

const ALLOWED_CATEGORIES = ['Supplier Payment', 'Vehicle Rent', 'Salary', 'Other Expenses'];
const ALLOWED_PAYMENT_MODES = ['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Other'];

export const getOutlays = async (req, res, next) => {
  try {
    const { date, startDate, endDate, category, search, supplierId, includeVoid } = req.query;
    let query = {};

    // Filter void entries
    if (includeVoid !== 'true') {
      query.isVoid = false;
    }

    // Date filtering
    if (date) {
      query.transactionDate = date;
    } else if (startDate || endDate) {
      query.transactionDate = {};
      if (startDate) query.transactionDate.$gte = startDate;
      if (endDate) query.transactionDate.$lte = endDate;
    }

    // Category filter
    if (category && category !== 'All') {
      if (ALLOWED_CATEGORIES.includes(category)) {
        query.category = category;
      }
    }

    // Supplier filter
    if (supplierId) {
      query.supplierId = supplierId;
    }

    // Search filter across description, recipient, notes, supplierName, linkedRef
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { description: searchRegex },
        { recipient: searchRegex },
        { notes: searchRegex },
        { supplierName: searchRegex },
        { linkedRef: searchRegex }
      ];
    }

    const outlays = await Outlay.find(query).sort({ transactionDate: -1, createdAt: 1 });

    // Aggregate totals for the filtered query (only non-void items count towards totals)
    let totalOutlay = 0;
    let operatingTotal = 0;
    let supplierTotal = 0;
    const categoryTotals = {
      'Supplier Payment': 0,
      'Vehicle Rent': 0,
      'Salary': 0,
      'Other Expenses': 0
    };

    let activeCount = 0;

    outlays.forEach((item) => {
      if (!item.isVoid) {
        const amt = Number(item.amount) || 0;
        totalOutlay += amt;
        activeCount += 1;

        if (item.category === 'Supplier Payment') {
          supplierTotal += amt;
        } else {
          // Independent operating expenses
          operatingTotal += amt;
        }

        if (categoryTotals[item.category] !== undefined) {
          categoryTotals[item.category] += amt;
        } else {
          categoryTotals[item.category] = amt;
        }
      }
    });

    res.json({
      success: true,
      count: outlays.length,
      activeCount,
      totals: {
        totalOutlay: roundMoney(totalOutlay),
        operatingTotal: roundMoney(operatingTotal),
        supplierTotal: roundMoney(supplierTotal),
        categoryTotals: {
          'Supplier Payment': roundMoney(categoryTotals['Supplier Payment']),
          'Vehicle Rent': roundMoney(categoryTotals['Vehicle Rent']),
          'Salary': roundMoney(categoryTotals['Salary']),
          'Other Expenses': roundMoney(categoryTotals['Other Expenses'])
        }
      },
      outlays
    });
  } catch (error) {
    next(error);
  }
};

export const getOutlaySummary = async (req, res, next) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    // Today's stats
    const todayOutlays = await Outlay.find({ transactionDate: targetDate, isVoid: false });

    let todayTotal = 0;
    let todayOperating = 0;
    let todaySupplier = 0;
    const todayCategories = {
      'Supplier Payment': 0,
      'Vehicle Rent': 0,
      'Salary': 0,
      'Other Expenses': 0
    };

    todayOutlays.forEach((item) => {
      const amt = Number(item.amount) || 0;
      todayTotal += amt;
      if (item.category === 'Supplier Payment') {
        todaySupplier += amt;
      } else {
        todayOperating += amt;
      }
      if (todayCategories[item.category] !== undefined) {
        todayCategories[item.category] += amt;
      }
    });

    res.json({
      success: true,
      date: targetDate,
      summary: {
        todayTotal: roundMoney(todayTotal),
        todayOperating: roundMoney(todayOperating),
        todaySupplier: roundMoney(todaySupplier),
        todayCount: todayOutlays.length,
        todayCategories: {
          'Supplier Payment': roundMoney(todayCategories['Supplier Payment']),
          'Vehicle Rent': roundMoney(todayCategories['Vehicle Rent']),
          'Salary': roundMoney(todayCategories['Salary']),
          'Other Expenses': roundMoney(todayCategories['Other Expenses'])
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

export const createOutlay = async (req, res, next) => {
  try {
    const {
      transactionDate,
      description,
      category,
      amount,
      recipient,
      notes,
      paymentMode,
      supplierId,
      purchaseId,
      supplierBillId,
      linkedRef
    } = req.body;

    if (!transactionDate || !/^\d{4}-\d{2}-\d{2}$/.test(transactionDate)) {
      return res.status(400).json({ success: false, message: 'Valid date (YYYY-MM-DD) is required' });
    }

    const finalDescription = (description || notes || recipient || '').trim();
    const finalCategory = category && ALLOWED_CATEGORIES.includes(category) ? category : 'Other Expenses';

    if (!finalDescription && !category) {
      return res.status(400).json({
        success: false,
        message: 'Expense description is required'
      });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be greater than zero' });
    }

    let resolvedSupplierName = '';
    let resolvedSupplierId = null;

    if (finalCategory === 'Supplier Payment') {
      if (supplierId) {
        const supplier = await Supplier.findById(supplierId);
        if (!supplier) {
          return res.status(404).json({ success: false, message: 'Selected supplier not found' });
        }
        resolvedSupplierId = supplier._id;
        resolvedSupplierName = supplier.name;
      }
    }

    const mode = ALLOWED_PAYMENT_MODES.includes(paymentMode) ? paymentMode : 'Cash';
    const finalRecipient = recipient?.trim() || resolvedSupplierName || finalDescription;

    const outlay = await Outlay.create({
      transactionDate,
      description: finalDescription,
      category: finalCategory,
      amount: roundMoney(numAmount),
      recipient: finalRecipient,
      notes: notes?.trim() || finalDescription,
      paymentMode: mode,
      supplierId: resolvedSupplierId,
      supplierName: resolvedSupplierName,
      purchaseId: purchaseId || null,
      supplierBillId: supplierBillId || null,
      linkedRef: linkedRef?.trim() || '',
      createdBy: req.user?._id || null,
      createdByName: req.user?.username || req.user?.name || 'Admin'
    });

    res.status(201).json({
      success: true,
      outlay,
      message: `Outlay of ₹${roundMoney(numAmount).toLocaleString('en-IN')} recorded successfully`
    });
  } catch (error) {
    next(error);
  }
};

export const updateOutlay = async (req, res, next) => {
  try {
    const { id } = req.params;
    const outlay = await Outlay.findById(id);

    if (!outlay) {
      return res.status(404).json({ success: false, message: 'Outlay record not found' });
    }

    if (outlay.isVoid) {
      return res.status(400).json({ success: false, message: 'Cannot edit a voided outlay record' });
    }

    const {
      transactionDate,
      description,
      category,
      amount,
      recipient,
      notes,
      paymentMode,
      supplierId,
      linkedRef
    } = req.body;

    if (description !== undefined) {
      outlay.description = description.trim();
      if (!outlay.recipient) outlay.recipient = description.trim();
      if (!outlay.notes) outlay.notes = description.trim();
    }

    if (transactionDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(transactionDate)) {
        return res.status(400).json({ success: false, message: 'Valid date (YYYY-MM-DD) is required' });
      }
      outlay.transactionDate = transactionDate;
    }

    if (category) {
      if (!ALLOWED_CATEGORIES.includes(category)) {
        return res.status(400).json({
          success: false,
          message: `Category must be one of: ${ALLOWED_CATEGORIES.join(', ')}`
        });
      }
      outlay.category = category;
    }

    if (amount !== undefined) {
      const numAmount = Number(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ success: false, message: 'Amount must be greater than zero' });
      }
      outlay.amount = roundMoney(numAmount);
    }

    if (paymentMode) {
      if (ALLOWED_PAYMENT_MODES.includes(paymentMode)) {
        outlay.paymentMode = paymentMode;
      }
    }

    if (recipient !== undefined) {
      outlay.recipient = recipient.trim();
    }

    if (notes !== undefined) {
      outlay.notes = notes.trim();
    }

    if (linkedRef !== undefined) {
      outlay.linkedRef = linkedRef.trim();
    }

    if (outlay.category === 'Supplier Payment' && supplierId) {
      const supplier = await Supplier.findById(supplierId);
      if (supplier) {
        outlay.supplierId = supplier._id;
        outlay.supplierName = supplier.name;
        if (!outlay.recipient) {
          outlay.recipient = supplier.name;
        }
      }
    }

    await outlay.save();

    res.json({
      success: true,
      outlay,
      message: 'Outlay updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

export const voidOutlay = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { voidReason } = req.body;

    const outlay = await Outlay.findById(id);

    if (!outlay) {
      return res.status(404).json({ success: false, message: 'Outlay record not found' });
    }

    if (outlay.isVoid) {
      return res.status(400).json({ success: false, message: 'This outlay record is already voided' });
    }

    outlay.isVoid = true;
    outlay.voidReason = voidReason?.trim() || 'Cancelled by Admin';
    outlay.voidedAt = new Date();
    outlay.voidedBy = req.user?._id || null;

    await outlay.save();

    res.json({
      success: true,
      outlay,
      message: 'Outlay record cancelled/voided successfully'
    });
  } catch (error) {
    next(error);
  }
};

export const deleteOutlay = async (req, res, next) => {
  try {
    const { id } = req.params;
    const outlay = await Outlay.findById(id);

    if (!outlay) {
      return res.status(404).json({ success: false, message: 'Outlay record not found' });
    }

    outlay.isVoid = true;
    outlay.voidReason = 'Deleted by Admin';
    outlay.voidedAt = new Date();
    outlay.voidedBy = req.user?._id || null;

    await outlay.save();

    res.json({
      success: true,
      message: 'Outlay record deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
