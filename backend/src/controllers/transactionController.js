import Transaction from '../models/Transaction.js';
import Buyer from '../models/Buyer.js';
import {
  calculateBigEquivalent,
  roundMoney,
  recalculateBuyerLedger,
  getBuyerOldBalance
} from '../services/ledgerService.js';
import { getConsolidatedBuyerBill } from '../services/buyerBillService.js';

/**
 * Record a SALE transaction:
 * Backend strictly computes:
 * - bigEquivalent = bigBoxes + (smallBoxes / 2)
 * - billAmount = bigEquivalent * ratePerBigBox
 * - oldBalance = chronological ledger balance prior to this record (or manual old balance adjusted)
 * - totalDue = oldBalance + billAmount
 * - newBalance = totalDue - amountPaid
 * 
 * If backdated, cascades recalculation to all subsequent transactions for this buyer.
 */
export const createSale = async (req, res, next) => {
  try {
    const { buyerId, transactionDate, bigBoxes, smallBoxes, ratePerBigBox, amountPaid, notes, manualOldBalance, items } = req.body;

    if (!buyerId) {
      return res.status(400).json({ success: false, message: 'Buyer is required' });
    }
    if (!transactionDate || !/^\d{4}-\d{2}-\d{2}$/.test(transactionDate)) {
      return res.status(400).json({ success: false, message: 'Valid transaction date (YYYY-MM-DD) is required' });
    }

    const buyer = await Buyer.findById(buyerId);
    if (!buyer) {
      return res.status(404).json({ success: false, message: 'Buyer not found' });
    }

    const paid = roundMoney(Number(amountPaid) || 0);
    if (paid < 0) {
      return res.status(400).json({ success: false, message: 'Payment amount cannot be negative' });
    }

    let processedItems = [];
    let big = 0;
    let small = 0;
    let bigEquivalent = 0;
    let rate = 0;
    let billAmount = 0;

    // Handle multiple crate & rate rows if provided
    if (Array.isArray(items) && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const rBig = Number(it.bigBoxes) || 0;
        const rSmall = Number(it.smallBoxes) || 0;
        const rRate = Math.round(Number(it.ratePerBigBox));

        if (rBig < 0 || rSmall < 0) {
          return res.status(400).json({ success: false, message: `Row ${i + 1}: Box quantities cannot be negative` });
        }
        if (rBig === 0 && rSmall === 0) {
          return res.status(400).json({ success: false, message: `Row ${i + 1}: Requires at least one Big or Small box` });
        }
        if (isNaN(rRate) || rRate <= 0) {
          return res.status(400).json({ success: false, message: `Row ${i + 1}: Selling rate per Big Box must be greater than zero` });
        }

        const rBigEq = calculateBigEquivalent(rBig, rSmall);
        const rLineAmt = roundMoney(rBigEq * rRate);

        big += rBig;
        small += rSmall;
        bigEquivalent += rBigEq;
        billAmount += rLineAmt;

        processedItems.push({
          bigBoxes: rBig,
          smallBoxes: rSmall,
          bigEquivalent: rBigEq,
          ratePerBigBox: rRate,
          lineAmount: rLineAmt,
          billAmount: rLineAmt
        });
      }

      billAmount = roundMoney(billAmount);
      rate = processedItems.length === 1 ? processedItems[0].ratePerBigBox : (bigEquivalent > 0 ? roundMoney(billAmount / bigEquivalent) : 0);
    } else {
      big = Number(bigBoxes) || 0;
      small = Number(smallBoxes) || 0;
      rate = Math.round(Number(ratePerBigBox));

      if (big < 0 || small < 0) {
        return res.status(400).json({ success: false, message: 'Box quantities cannot be negative' });
      }
      if (big === 0 && small === 0) {
        return res.status(400).json({ success: false, message: 'Sale transaction requires at least one Big or Small box' });
      }
      if (isNaN(rate) || rate <= 0) {
        return res.status(400).json({ success: false, message: 'Selling rate per Big Box must be greater than zero' });
      }

      bigEquivalent = calculateBigEquivalent(big, small);
      billAmount = roundMoney(bigEquivalent * rate);

      processedItems.push({
        bigBoxes: big,
        smallBoxes: small,
        bigEquivalent,
        ratePerBigBox: rate,
        lineAmount: billAmount,
        billAmount
      });
    }

    // If manual old balance is explicitly provided and differs from ledger, adjust initial balance
    if (manualOldBalance !== undefined && manualOldBalance !== null && manualOldBalance !== '' && !isNaN(Number(manualOldBalance))) {
      const manualOld = roundMoney(Number(manualOldBalance));
      const currentLedgerOld = await getBuyerOldBalance(buyer._id, transactionDate);
      const delta = roundMoney(manualOld - currentLedgerOld);

      if (Math.abs(delta) > 0) {
        buyer.initialBalance = roundMoney((buyer.initialBalance || 0) + delta);
        await buyer.save();
      }
    }

    // Initial creation with placeholder balances (will be strictly recomputed in chronological order)
    const transaction = await Transaction.create({
      buyerId: buyer._id,
      buyerName: buyer.name,
      transactionDate,
      type: 'SALE',
      bigBoxes: big,
      smallBoxes: small,
      bigEquivalent,
      ratePerBigBox: rate,
      billAmount,
      items: processedItems,
      amountPaid: paid,
      oldBalance: 0,
      totalDue: billAmount,
      newBalance: billAmount - paid,
      notes: notes ? notes.trim() : ''
    });

    // Run strict chronological ledger recalculation for this buyer
    await recalculateBuyerLedger(buyer._id);

    // Retrieve the final updated transaction with exact ledger values
    const finalTransaction = await Transaction.findById(transaction._id);

    res.status(201).json({
      success: true,
      transaction: finalTransaction,
      message: `Sale recorded successfully for ${buyer.name}`
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Record a PAYMENT-ONLY transaction:
 * - Boxes = 0
 * - billAmount = 0
 * - oldBalance = previous balance
 * - totalDue = oldBalance
 * - newBalance = oldBalance - amountPaid
 */
export const createPayment = async (req, res, next) => {
  try {
    const { buyerId, transactionDate, amountPaid, notes, manualOldBalance } = req.body;

    if (!buyerId) {
      return res.status(400).json({ success: false, message: 'Buyer is required' });
    }
    if (!transactionDate || !/^\d{4}-\d{2}-\d{2}$/.test(transactionDate)) {
      return res.status(400).json({ success: false, message: 'Valid transaction date (YYYY-MM-DD) is required' });
    }

    const buyer = await Buyer.findById(buyerId);
    if (!buyer) {
      return res.status(404).json({ success: false, message: 'Buyer not found' });
    }

    const paid = roundMoney(Number(amountPaid));
    if (isNaN(paid) || paid <= 0) {
      return res.status(400).json({ success: false, message: 'Payment amount must be greater than zero' });
    }

    // If manual old balance is explicitly provided and differs from ledger, adjust initial balance
    if (manualOldBalance !== undefined && manualOldBalance !== null && manualOldBalance !== '' && !isNaN(Number(manualOldBalance))) {
      const manualOld = roundMoney(Number(manualOldBalance));
      const currentLedgerOld = await getBuyerOldBalance(buyer._id, transactionDate);
      const delta = roundMoney(manualOld - currentLedgerOld);

      if (Math.abs(delta) > 0) {
        buyer.initialBalance = roundMoney((buyer.initialBalance || 0) + delta);
        await buyer.save();
      }
    }

    // Initial creation with placeholder
    const transaction = await Transaction.create({
      buyerId: buyer._id,
      buyerName: buyer.name,
      transactionDate,
      type: 'PAYMENT',
      bigBoxes: 0,
      smallBoxes: 0,
      bigEquivalent: 0,
      ratePerBigBox: 0,
      billAmount: 0,
      amountPaid: paid,
      oldBalance: 0,
      totalDue: 0,
      newBalance: -paid,
      notes: notes ? notes.trim() : ''
    });

    // Run strict chronological ledger recalculation
    await recalculateBuyerLedger(buyer._id);

    const finalTransaction = await Transaction.findById(transaction._id);

    res.status(201).json({
      success: true,
      transaction: finalTransaction,
      message: `Payment of ₹${paid.toLocaleString('en-IN')} recorded for ${buyer.name}`
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Record a BORROW transaction:
 * - Increases buyer's outstanding due (DEBIT)
 * - billAmount = borrowAmount
 * - amountPaid = 0
 * - Boxes = 0
 * - totalDue = oldBalance + borrowAmount
 * - newBalance = totalDue
 */
export const createBorrow = async (req, res, next) => {
  try {
    const { buyerId, transactionDate, amount, notes, manualOldBalance } = req.body;

    if (!buyerId) {
      return res.status(400).json({ success: false, message: 'Buyer is required' });
    }
    if (!transactionDate || !/^\d{4}-\d{2}-\d{2}$/.test(transactionDate)) {
      return res.status(400).json({ success: false, message: 'Valid transaction date (YYYY-MM-DD) is required' });
    }

    const buyer = await Buyer.findById(buyerId);
    if (!buyer) {
      return res.status(404).json({ success: false, message: 'Buyer not found' });
    }

    const borrowAmt = roundMoney(Number(amount));
    if (isNaN(borrowAmt) || borrowAmt <= 0) {
      return res.status(400).json({ success: false, message: 'Borrow amount must be greater than zero' });
    }

    // If manual old balance is explicitly provided and differs from ledger, adjust initial balance
    if (manualOldBalance !== undefined && manualOldBalance !== null && manualOldBalance !== '' && !isNaN(Number(manualOldBalance))) {
      const manualOld = roundMoney(Number(manualOldBalance));
      const currentLedgerOld = await getBuyerOldBalance(buyer._id, transactionDate);
      const delta = roundMoney(manualOld - currentLedgerOld);

      if (Math.abs(delta) > 0) {
        buyer.initialBalance = roundMoney((buyer.initialBalance || 0) + delta);
        await buyer.save();
      }
    }

    // Initial creation with placeholder
    const transaction = await Transaction.create({
      buyerId: buyer._id,
      buyerName: buyer.name,
      transactionDate,
      type: 'BORROW',
      bigBoxes: 0,
      smallBoxes: 0,
      bigEquivalent: 0,
      ratePerBigBox: 0,
      billAmount: borrowAmt,
      amountPaid: 0,
      oldBalance: 0,
      totalDue: borrowAmt,
      newBalance: borrowAmt,
      notes: notes ? notes.trim() : ''
    });

    // Run strict chronological ledger recalculation
    await recalculateBuyerLedger(buyer._id);

    const finalTransaction = await Transaction.findById(transaction._id);

    res.status(201).json({
      success: true,
      transaction: finalTransaction,
      message: `Borrow entry of ₹${borrowAmt.toLocaleString('en-IN')} recorded for ${buyer.name}`
    });
  } catch (error) {
    next(error);
  }
};

export const getTransactions = async (req, res, next) => {
  try {
    const { date, startDate, endDate, buyerId, type, isVoid } = req.query;
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

    if (buyerId) {
      query.buyerId = buyerId;
    }

    if (type) {
      query.type = type.toUpperCase();
    }

    const transactions = await Transaction.find(query).sort({ transactionDate: -1, createdAt: -1 });

    // Summary totals for filtered query
    let totalSalesAmount = 0;
    let totalAmountPaid = 0;
    let totalBigBoxes = 0;
    let totalSmallBoxes = 0;
    let totalBigEquivalent = 0;

    transactions.forEach((tx) => {
      if (!tx.isVoid) {
        if (tx.type === 'SALE') {
          totalSalesAmount += tx.billAmount;
          totalBigBoxes += tx.bigBoxes;
          totalSmallBoxes += tx.smallBoxes;
          totalBigEquivalent += tx.bigEquivalent;
        }
        totalAmountPaid += tx.amountPaid;
      }
    });

    res.json({
      success: true,
      count: transactions.length,
      totals: {
        totalSalesAmount: roundMoney(totalSalesAmount),
        totalAmountPaid: roundMoney(totalAmountPaid),
        totalBigBoxes,
        totalSmallBoxes,
        totalBigEquivalent: roundMoney(totalBigEquivalent)
      },
      transactions
    });
  } catch (error) {
    next(error);
  }
};

export const getTransactionById = async (req, res, next) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }
    res.json({ success: true, transaction });
  } catch (error) {
    next(error);
  }
};

export const voidTransaction = async (req, res, next) => {
  try {
    const { voidReason } = req.body;
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    if (transaction.isVoid) {
      return res.status(400).json({ success: false, message: 'This transaction is already voided' });
    }

    transaction.isVoid = true;
    transaction.voidReason = voidReason || 'Voided by user';
    await transaction.save();

    // Trigger chronological recalculation of all subsequent transactions for this buyer
    await recalculateBuyerLedger(transaction.buyerId);

    const updated = await Transaction.findById(transaction._id);

    res.json({
      success: true,
      transaction: updated,
      message: 'Transaction voided and buyer balance recalculated successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve consolidated buyer bill for a buyer and operational date.
 */
export const getConsolidatedBill = async (req, res, next) => {
  try {
    const { buyerId, transactionDate, transactionId } = req.query;
    const bill = await getConsolidatedBuyerBill({
      buyerId,
      transactionDate,
      transactionId
    });
    res.json({ success: true, bill });
  } catch (error) {
    next(error);
  }
};
