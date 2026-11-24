import Buyer from '../models/Buyer.js';
import Transaction from '../models/Transaction.js';

export const roundMoney = (val) => {
  return Math.round(Number(val || 0));
};

export const roundBoxes = (val) => {
  return Math.round((Number(val || 0) + Number.EPSILON) * 10) / 10;
};

/**
 * Calculates Big Box equivalent:
 * 1 Big Box = 1
 * 1 Small Box = 0.5 Big Box
 */
export const calculateBigEquivalent = (bigBoxes = 0, smallBoxes = 0) => {
  const big = Number(bigBoxes) || 0;
  const small = Number(smallBoxes) || 0;
  return roundBoxes(big + small / 2);
};

/**
 * Recalculates the entire chronological ledger for a specific buyer.
 * Strictly enforces:
 * Initial Balance + sum(Sale Bills) - sum(All Amount Paid) = Final Balance
 * 
 * Updates oldBalance, totalDue, newBalance for every active transaction in chronological order.
 * Updates Buyer.currentBalance.
 */
export const recalculateBuyerLedger = async (buyerId) => {
  const buyer = await Buyer.findById(buyerId);
  if (!buyer) {
    throw new Error(`Buyer not found with ID ${buyerId}`);
  }

  // Active (non-void) transactions in strict chronological order
  const transactions = await Transaction.find({ buyerId, isVoid: false })
    .sort({ transactionDate: 1, createdAt: 1, _id: 1 });

  let runningBalance = roundMoney(buyer.initialBalance || 0);

  for (const tx of transactions) {
    const oldBalance = runningBalance;
    let totalDue = 0;
    let newBalance = 0;

    if (tx.type === 'SALE') {
      const bigEq = calculateBigEquivalent(tx.bigBoxes, tx.smallBoxes);
      let bill = 0;
      if (Array.isArray(tx.items) && tx.items.length > 0) {
        bill = tx.items.reduce((sum, it) => {
          const itEq = calculateBigEquivalent(it.bigBoxes, it.smallBoxes);
          const itRate = Math.round(Number(it.ratePerBigBox) || 0);
          const itAmt = (it.lineAmount !== undefined && it.lineAmount !== null && !isNaN(Number(it.lineAmount)))
            ? Math.round(Number(it.lineAmount))
            : (it.billAmount !== undefined && it.billAmount !== null && !isNaN(Number(it.billAmount)))
            ? Math.round(Number(it.billAmount))
            : Math.round(itEq * itRate);
          return sum + itAmt;
        }, 0);
      } else if (tx.billAmount !== undefined && tx.billAmount !== null && !isNaN(Number(tx.billAmount)) && Number(tx.billAmount) > 0) {
        bill = Math.round(Number(tx.billAmount));
      } else {
        const rate = Math.round(Number(tx.ratePerBigBox) || 0);
        bill = Math.round(bigEq * rate);
      }

      bill = roundMoney(bill);
      totalDue = roundMoney(oldBalance + bill);
      newBalance = roundMoney(totalDue - Number(tx.amountPaid || 0));

      tx.bigEquivalent = bigEq;
      tx.billAmount = bill;
    } else {
      // PAYMENT
      tx.bigBoxes = 0;
      tx.smallBoxes = 0;
      tx.bigEquivalent = 0;
      tx.ratePerBigBox = 0;
      tx.billAmount = 0;

      totalDue = oldBalance;
      newBalance = roundMoney(oldBalance - Number(tx.amountPaid || 0));
    }

    tx.oldBalance = oldBalance;
    tx.totalDue = totalDue;
    tx.newBalance = newBalance;
    await tx.save();

    runningBalance = newBalance;
  }

  buyer.currentBalance = runningBalance;
  await buyer.save();

  return {
    buyerId,
    initialBalance: buyer.initialBalance,
    currentBalance: runningBalance,
    transactionCount: transactions.length
  };
};

/**
 * Get the buyer's balance prior to a new transaction on transactionDate.
 * If creating a transaction at the end of the timeline, this is the current active balance.
 * If backdating, calculates balance up to the given transactionDate and time.
 */
export const getBuyerOldBalance = async (buyerId, transactionDate = null) => {
  const buyer = await Buyer.findById(buyerId);
  if (!buyer) {
    throw new Error(`Buyer not found with ID ${buyerId}`);
  }

  // If no date specified or for quick check, return current ledger balance
  if (!transactionDate) {
    return roundMoney(buyer.currentBalance);
  }

  // For backdated calculation:
  // Transactions strictly before this date, or if on same date, all existing ones
  const priorTransactions = await Transaction.find({
    buyerId,
    isVoid: false,
    transactionDate: { $lte: transactionDate }
  }).sort({ transactionDate: 1, createdAt: 1, _id: 1 });

  let balance = roundMoney(buyer.initialBalance || 0);
  for (const tx of priorTransactions) {
    balance = tx.newBalance;
  }

  return roundMoney(balance);
};
