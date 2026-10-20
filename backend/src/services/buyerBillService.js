import Transaction from '../models/Transaction.js';
import Buyer from '../models/Buyer.js';
import { roundMoney, roundBoxes } from './ledgerService.js';
import { formatItemBoxDescription } from './supplierBillService.js';

/**
 * Retrieves the true opening balance of a buyer prior to any transactions on transactionDate.
 * Looks for the most recent active transaction strictly before transactionDate.
 * If none exists, falls back to the buyer's initialBalance.
 */
export const getDayOpeningBalance = async (buyerId, transactionDate) => {
  const priorTx = await Transaction.findOne({
    buyerId,
    transactionDate: { $lt: transactionDate },
    isVoid: false
  }).sort({ transactionDate: -1, createdAt: -1, _id: -1 });

  if (priorTx) {
    return roundMoney(priorTx.newBalance);
  }

  const buyer = await Buyer.findById(buyerId);
  return roundMoney(buyer?.initialBalance || 0);
};

/**
 * Retrieves the complete consolidated buyer bill for a buyer and operational date.
 * Groups all active sales entries on that date into a single bill.
 */
export const getConsolidatedBuyerBill = async ({ buyerId, transactionDate, transactionId }) => {
  let bId = buyerId;
  let date = transactionDate;

  // Resolve buyerId and transactionDate from transactionId if not provided
  if (transactionId && (!bId || !date)) {
    const tx = await Transaction.findById(transactionId);
    if (!tx) {
      throw new Error(`Transaction record '${transactionId}' not found.`);
    }
    bId = tx.buyerId;
    date = tx.transactionDate;
  }

  // Handle nested object if buyerId was passed as an object
  if (bId && typeof bId === 'object' && bId._id) {
    bId = bId._id;
  }

  if (!bId || !date) {
    throw new Error('Buyer ID and transaction date are required.');
  }

  // 1. Fetch all active (non-void) transactions for this buyer and date in chronological order
  const dayTransactions = await Transaction.find({
    buyerId: bId,
    transactionDate: date,
    isVoid: false
  }).sort({ createdAt: 1, _id: 1 });

  // Buyer information
  const buyerDoc = await Buyer.findById(bId);
  const buyerName = buyerDoc?.name || dayTransactions[0]?.buyerName || 'வாடிக்கையாளர்';

  // 2. Authoritative opening balance before the day's first transaction
  const openingBalance = await getDayOpeningBalance(bId, date);

  // 3. Process active sales on this date
  const sales = dayTransactions.filter((tx) => tx.type === 'SALE');

  let totalBigBoxes = 0;
  let totalSmallBoxes = 0;
  let totalBigEquivalent = 0;
  let todayBill = 0;

  const items = sales.map((s, index) => {
    const big = Number(s.bigBoxes) || 0;
    const small = Number(s.smallBoxes) || 0;
    const bigEq = Number(s.bigEquivalent) || roundBoxes(big + small / 2);
    const rate = Number(s.ratePerBigBox) || 0;
    const lineAmount = roundMoney(s.billAmount || (bigEq * rate));

    totalBigBoxes += big;
    totalSmallBoxes += small;
    totalBigEquivalent += bigEq;
    todayBill += lineAmount;

    const desc = formatItemBoxDescription(big, small);

    return {
      _id: s._id,
      lotNumber: s._id ? String(s._id).slice(-4) : `00${index + 1}`,
      ratePerBigBox: rate,
      bigBoxes: big,
      smallBoxes: small,
      bigEquivalent: bigEq,
      lineAmount,
      billAmount: lineAmount,
      totalAmount: lineAmount,
      descLine1: desc.line1,
      descLine2: desc.line2,
      qtyText: big > 0 && small === 0 ? `${big}` : `${bigEq}`,
      notes: s.notes || ''
    };
  });

  todayBill = roundMoney(todayBill);

  // 4. Calculate total payments made on this date across all transactions (SALE + PAYMENT)
  let totalPaid = 0;
  dayTransactions.forEach((tx) => {
    totalPaid += Number(tx.amountPaid || 0);
  });
  totalPaid = roundMoney(totalPaid);

  // 5. Consolidated accounting ledger totals
  // Today's Bill = sum of all eligible sales line amounts
  // Total Due = opening balance + today's consolidated sales
  // New Balance = Total Due - total paid on that date
  const totalDue = roundMoney(openingBalance + todayBill);
  const newBalance = roundMoney(totalDue - totalPaid);
  const isAdvance = newBalance < 0;

  return {
    buyerId: bId,
    buyerName,
    transactionDate: date,
    transactionIds: dayTransactions.map((tx) => tx._id),
    itemCount: items.length,
    items,
    totalBigBoxes,
    totalSmallBoxes,
    totalBigEquivalent: roundMoney(totalBigEquivalent),
    todayBill,
    billAmount: todayBill,
    oldBalance: openingBalance,
    totalDue,
    amountPaid: totalPaid,
    paid: totalPaid,
    newBalance,
    isAdvance
  };
};
