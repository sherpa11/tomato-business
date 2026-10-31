import Purchase from '../models/Purchase.js';
import Transaction from '../models/Transaction.js';
import Buyer from '../models/Buyer.js';
import Supplier from '../models/Supplier.js';
import { roundMoney, roundBoxes } from '../services/ledgerService.js';

export const getDashboardSummary = async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const date = req.query.date || today;

    // Concurrently fetch today purchases, transactions, active buyer balances and counts in parallel
    const [purchases, transactions, buyers, buyerCount, supplierCount] = await Promise.all([
      Purchase.find({ transactionDate: date, isVoid: false })
        .sort({ createdAt: -1 })
        .lean(),
      Transaction.find({ transactionDate: date, isVoid: false })
        .sort({ createdAt: 1, _id: 1 })
        .lean(),
      Buyer.find({ active: true })
        .select('currentBalance')
        .lean(),
      Buyer.countDocuments({ active: true }),
      Supplier.countDocuments({ active: true })
    ]);

    let totalPurchaseAmount = 0;
    let totalPurchasedBigBoxes = 0;
    let totalPurchasedSmallBoxes = 0;
    let totalPurchasedBigEquivalent = 0;

    purchases.forEach((p) => {
      totalPurchaseAmount += p.totalAmount;
      totalPurchasedBigBoxes += p.bigBoxes;
      totalPurchasedSmallBoxes += p.smallBoxes;
      totalPurchasedBigEquivalent += p.bigEquivalent;
    });

    let totalSalesAmount = 0;
    let totalAmountReceived = 0;
    let totalSoldBigBoxes = 0;
    let totalSoldSmallBoxes = 0;
    let totalSoldBigEquivalent = 0;

    const tallyTable = transactions.map((tx) => {
      if (tx.type === 'SALE') {
        totalSalesAmount += tx.billAmount;
        totalSoldBigBoxes += tx.bigBoxes;
        totalSoldSmallBoxes += tx.smallBoxes;
        totalSoldBigEquivalent += tx.bigEquivalent;
      }
      totalAmountReceived += tx.amountPaid;

      let boxDescription = '0 Boxes (Payment Only)';
      if (tx.type === 'SALE') {
        boxDescription = `${tx.bigBoxes} Big`;
        if (tx.smallBoxes > 0) {
          boxDescription += ` + ${tx.smallBoxes} Small`;
        }
      }

      return {
        id: tx._id,
        transactionId: tx._id,
        type: tx.type,
        buyerId: tx.buyerId,
        buyerName: tx.buyerName,
        oldBalance: roundMoney(tx.oldBalance),
        boxDescription,
        bigBoxes: tx.bigBoxes,
        smallBoxes: tx.smallBoxes,
        bigEquivalent: tx.bigEquivalent,
        ratePerBigBox: tx.ratePerBigBox,
        todayBill: roundMoney(tx.billAmount),
        totalDue: roundMoney(tx.totalDue),
        paid: roundMoney(tx.amountPaid),
        newBalance: roundMoney(tx.newBalance),
        notes: tx.notes,
        createdAt: tx.createdAt
      };
    });

    let totalOutstanding = 0;
    let totalAdvanceCredit = 0;

    buyers.forEach((b) => {
      if (b.currentBalance > 0) {
        totalOutstanding += b.currentBalance;
      } else if (b.currentBalance < 0) {
        totalAdvanceCredit += Math.abs(b.currentBalance);
      }
    });

    res.json({
      success: true,
      date,
      summary: {
        totalPurchase: roundMoney(totalPurchaseAmount),
        totalSales: roundMoney(totalSalesAmount),
        totalAmountReceived: roundMoney(totalAmountReceived),
        totalCustomerOutstanding: roundMoney(totalOutstanding),
        totalAdvanceCredit: roundMoney(totalAdvanceCredit),
        boxesPurchased: {
          big: totalPurchasedBigBoxes,
          small: totalPurchasedSmallBoxes,
          equivalent: roundBoxes(totalPurchasedBigEquivalent)
        },
        boxesSold: {
          big: totalSoldBigBoxes,
          small: totalSoldSmallBoxes,
          equivalent: roundBoxes(totalSoldBigEquivalent)
        },
        buyerCount,
        supplierCount
      },
      todayPurchases: purchases,
      todayTally: tallyTable
    });
  } catch (error) {
    next(error);
  }
};
