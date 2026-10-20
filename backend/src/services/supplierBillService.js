import Purchase from '../models/Purchase.js';
import Supplier from '../models/Supplier.js';
import SupplierBill from '../models/SupplierBill.js';
import { roundMoney } from './ledgerService.js';

/**
 * Format description line for an item based on its big and small box counts.
 */
export const formatItemBoxDescription = (bigBoxes = 0, smallBoxes = 0) => {
  const big = Number(bigBoxes) || 0;
  const small = Number(smallBoxes) || 0;

  if (big > 0 && small > 0) {
    return {
      line1: 'தக்காளி பெட்டி',
      line2: `(${big} Big + ${small} Small)`
    };
  } else if (small > 0 && big === 0) {
    return {
      line1: 'தக்காளி சிறிய பெட்டி',
      line2: `(${small} Small)`
    };
  }
  return {
    line1: 'தக்காளி பெரிய பெட்டி',
    line2: big > 0 ? `(${big} Big)` : '(Big Box)'
  };
};

/**
 * Retrieves the complete consolidated supplier bill for a supplier and operational date.
 * Groups all purchase entries on that date into a single bill.
 */
export const getConsolidatedSupplierBill = async ({ supplierId, transactionDate, purchaseId }) => {
  let suppId = supplierId;
  let date = transactionDate;

  // If purchaseId was provided, resolve supplier and date from that purchase
  if (purchaseId && (!suppId || !date)) {
    const p = await Purchase.findById(purchaseId);
    if (!p) {
      throw new Error(`Purchase record '${purchaseId}' not found.`);
    }
    suppId = p.supplierId;
    date = p.transactionDate;
  }

  if (!suppId || !date) {
    throw new Error('Supplier ID and transaction date are required.');
  }

  // 1. Fetch all active (non-void) purchases for this supplier and date
  const purchases = await Purchase.find({
    supplierId: suppId,
    transactionDate: date,
    isVoid: false
  }).sort({ createdAt: 1, _id: 1 });

  // Supplier info
  const supplierDoc = await Supplier.findById(suppId);
  const supplierName = supplierDoc?.name || purchases[0]?.supplierName || 'Unknown Supplier';

  // 2. Fetch saved deductions for this supplier & date
  const billDoc = await SupplierBill.findOne({
    supplierId: suppId,
    transactionDate: date
  });

  const commission = roundMoney(billDoc?.commission || 0);
  const gate = roundMoney(billDoc?.gate || 0);
  const coolie = roundMoney(billDoc?.coolie || 0);
  const rent = roundMoney(billDoc?.rent || 0);
  const debit = roundMoney(billDoc?.debit || 0);

  // 3. Process line items
  let totalBigBoxes = 0;
  let totalSmallBoxes = 0;
  let totalBigEquivalent = 0;
  let grossTotal = 0;

  const items = purchases.map((p, index) => {
    const big = Number(p.bigBoxes) || 0;
    const small = Number(p.smallBoxes) || 0;
    const bigEq = Number(p.bigEquivalent) || (big + small / 2);
    const rate = Number(p.ratePerBigBox) || 0;
    // Line amount = quantity x rate
    const lineAmount = roundMoney(p.totalAmount || (bigEq * rate));

    totalBigBoxes += big;
    totalSmallBoxes += small;
    totalBigEquivalent += bigEq;
    grossTotal += lineAmount;

    const desc = formatItemBoxDescription(big, small);

    return {
      _id: p._id,
      lotNumber: p._id ? String(p._id).slice(-4) : `00${index + 1}`,
      bigBoxes: big,
      smallBoxes: small,
      bigEquivalent: bigEq,
      ratePerBigBox: rate,
      lineAmount,
      totalAmount: lineAmount,
      descLine1: desc.line1,
      descLine2: desc.line2,
      qtyText: big > 0 && small === 0 ? `${big}` : `${bigEq}`,
      notes: p.notes || ''
    };
  });

  grossTotal = roundMoney(grossTotal);
  const totalDeductions = roundMoney(commission + gate + coolie + rent + debit);
  const netTotal = roundMoney(grossTotal - totalDeductions);

  // Lot number identifier
  const lotNum = purchases.length > 0 ? String(purchases[0]._id).slice(-4) : '0001';

  return {
    supplierId: suppId,
    supplierName,
    transactionDate: date,
    lotNumber: lotNum,
    purchaseIds: purchases.map((p) => p._id),
    itemCount: items.length,
    items,
    totalBigBoxes,
    totalSmallBoxes,
    totalBigEquivalent: roundMoney(totalBigEquivalent),
    grossTotal,
    deductions: {
      commission,
      gate,
      coolie,
      rent,
      debit,
      totalDeductions
    },
    netTotal,
    notes: billDoc?.notes || ''
  };
};

/**
 * Saves or updates deduction values for a consolidated supplier bill.
 */
export const saveSupplierBillDeductions = async ({
  supplierId,
  transactionDate,
  commission = 0,
  gate = 0,
  coolie = 0,
  rent = 0,
  debit = 0,
  notes = ''
}) => {
  if (!supplierId || !transactionDate) {
    throw new Error('Supplier ID and transaction date are required.');
  }

  // Parse and validate non-negative values
  const parseVal = (val, name) => {
    if (val === '' || val === null || val === undefined) return 0;
    const num = Number(val);
    if (isNaN(num) || num < 0) {
      throw new Error(`Deduction '${name}' must be a non-negative number.`);
    }
    return roundMoney(num);
  };

  const parsedCommission = parseVal(commission, 'கமிஷன்');
  const parsedGate = parseVal(gate, 'கேட்');
  const parsedCoolie = parseVal(coolie, 'கூலி');
  const parsedRent = parseVal(rent, 'வாடகை');
  const parsedDebit = parseVal(debit, 'பற்று');

  const supplier = await Supplier.findById(supplierId);
  const supplierName = supplier?.name || 'Supplier';

  await SupplierBill.findOneAndUpdate(
    { supplierId, transactionDate },
    {
      supplierId,
      supplierName,
      transactionDate,
      commission: parsedCommission,
      gate: parsedGate,
      coolie: parsedCoolie,
      rent: parsedRent,
      debit: parsedDebit,
      notes: typeof notes === 'string' ? notes.trim() : ''
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return getConsolidatedSupplierBill({ supplierId, transactionDate });
};
