import Purchase from '../models/Purchase.js';
import Transaction from '../models/Transaction.js';
import Buyer from '../models/Buyer.js';
import { roundMoney, roundBoxes } from '../services/ledgerService.js';

export const getReports = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate) dateFilter.$gte = startDate;
    if (endDate) dateFilter.$lte = endDate;

    const hasDateFilter = Object.keys(dateFilter).length > 0;
    const purchaseQuery = { isVoid: false };
    const txQuery = { isVoid: false };

    if (hasDateFilter) {
      purchaseQuery.transactionDate = dateFilter;
      txQuery.transactionDate = dateFilter;
    }

    // Concurrently fetch purchases, transactions, and buyers with projections and lean documents
    const [purchases, transactions, buyers] = await Promise.all([
      Purchase.find(purchaseQuery)
        .select('totalAmount bigBoxes smallBoxes bigEquivalent transactionDate')
        .sort({ transactionDate: 1, createdAt: 1 })
        .lean(),
      Transaction.find(txQuery)
        .select('type billAmount amountPaid bigBoxes smallBoxes bigEquivalent transactionDate')
        .sort({ transactionDate: 1, createdAt: 1 })
        .lean(),
      Buyer.find({ active: true })
        .select('name phone currentBalance')
        .sort({ currentBalance: -1 })
        .lean()
    ]);

    let totalPurchases = 0;
    let totalPurchasedBigBoxes = 0;
    let totalPurchasedSmallBoxes = 0;
    let totalPurchasedBigEq = 0;

    purchases.forEach((p) => {
      totalPurchases += p.totalAmount;
      totalPurchasedBigBoxes += p.bigBoxes;
      totalPurchasedSmallBoxes += p.smallBoxes;
      totalPurchasedBigEq += p.bigEquivalent;
    });

    let totalSales = 0;
    let totalReceived = 0;
    let totalSoldBigBoxes = 0;
    let totalSoldSmallBoxes = 0;
    let totalSoldBigEq = 0;

    const dailyBreakdownMap = {};

    transactions.forEach((tx) => {
      const d = tx.transactionDate;
      if (!dailyBreakdownMap[d]) {
        dailyBreakdownMap[d] = {
          date: d,
          purchaseAmount: 0,
          salesAmount: 0,
          receivedAmount: 0,
          boxesSoldEq: 0,
          boxesPurchasedEq: 0
        };
      }

      if (tx.type === 'SALE') {
        totalSales += tx.billAmount;
        totalSoldBigBoxes += tx.bigBoxes;
        totalSoldSmallBoxes += tx.smallBoxes;
        totalSoldBigEq += tx.bigEquivalent;
        dailyBreakdownMap[d].salesAmount += tx.billAmount;
        dailyBreakdownMap[d].boxesSoldEq += tx.bigEquivalent;
      }

      totalReceived += tx.amountPaid;
      dailyBreakdownMap[d].receivedAmount += tx.amountPaid;
    });

    purchases.forEach((p) => {
      const d = p.transactionDate;
      if (!dailyBreakdownMap[d]) {
        dailyBreakdownMap[d] = {
          date: d,
          purchaseAmount: 0,
          salesAmount: 0,
          receivedAmount: 0,
          boxesSoldEq: 0,
          boxesPurchasedEq: 0
        };
      }
      dailyBreakdownMap[d].purchaseAmount += p.totalAmount;
      dailyBreakdownMap[d].boxesPurchasedEq += p.bigEquivalent;
    });

    const dailyBreakdown = Object.values(dailyBreakdownMap).sort((a, b) => a.date.localeCompare(b.date));

    // Buyer Outstanding Summary (computed from parallel-fetched buyers)
    let totalCustomerOutstanding = 0;
    let totalCustomerCredit = 0;

    const buyerBalances = buyers.map((b) => {
      if (b.currentBalance > 0) {
        totalCustomerOutstanding += b.currentBalance;
      } else if (b.currentBalance < 0) {
        totalCustomerCredit += Math.abs(b.currentBalance);
      }
      return {
        _id: b._id,
        name: b.name,
        phone: b.phone,
        currentBalance: roundMoney(b.currentBalance)
      };
    });

    res.json({
      success: true,
      period: {
        startDate: startDate || 'All Time',
        endDate: endDate || 'All Time'
      },
      summary: {
        totalPurchases: roundMoney(totalPurchases),
        totalSales: roundMoney(totalSales),
        totalReceived: roundMoney(totalReceived),
        totalCustomerOutstanding: roundMoney(totalCustomerOutstanding),
        totalCustomerCredit: roundMoney(totalCustomerCredit),
        boxesPurchased: {
          big: totalPurchasedBigBoxes,
          small: totalPurchasedSmallBoxes,
          equivalent: roundBoxes(totalPurchasedBigEq)
        },
        boxesSold: {
          big: totalSoldBigBoxes,
          small: totalSoldSmallBoxes,
          equivalent: roundBoxes(totalSoldBigEq)
        }
      },
      dailyBreakdown,
      buyerBalances
    });
  } catch (error) {
    next(error);
  }
};
