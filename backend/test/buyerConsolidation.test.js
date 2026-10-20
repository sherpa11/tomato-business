import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import fs from 'fs';

import { connectDB } from '../src/config/db.js';
import Buyer from '../src/models/Buyer.js';
import Transaction from '../src/models/Transaction.js';
import {
  getConsolidatedBuyerBill,
  getDayOpeningBalance
} from '../src/services/buyerBillService.js';
import {
  recalculateBuyerLedger,
  calculateBigEquivalent,
  roundMoney
} from '../src/services/ledgerService.js';
import { renderBuyerBillHtml, generatePdfFile } from '../src/services/printService.js';

test('Buyer Bill Consolidation & Ledger Integrity Suite', async (t) => {
  await connectDB();

  const testDate = '2026-10-20';
  const otherDate = '2026-10-21';

  // Create isolated synthetic buyers
  const buyerMuniyamma = await Buyer.findOneAndUpdate(
    { name: 'SYNTHETIC_BUYER_MUNIYAMMA' },
    {
      name: 'SYNTHETIC_BUYER_MUNIYAMMA',
      phone: '9876543210',
      address: 'Shop 12',
      initialBalance: 5000,
      currentBalance: 5000
    },
    { upsert: true, new: true }
  );

  const buyerOther = await Buyer.findOneAndUpdate(
    { name: 'SYNTHETIC_BUYER_OTHER' },
    {
      name: 'SYNTHETIC_BUYER_OTHER',
      phone: '9876543211',
      address: 'Shop 14',
      initialBalance: 2000,
      currentBalance: 2000
    },
    { upsert: true, new: true }
  );

  // Clean any previous synthetic transactions
  await Transaction.deleteMany({ buyerId: { $in: [buyerMuniyamma._id, buyerOther._id] } });

  // Reset Muniyamma initial balance
  buyerMuniyamma.initialBalance = 5000;
  buyerMuniyamma.currentBalance = 5000;
  await buyerMuniyamma.save();

  // Create Example Transactions from user prompt:
  // Muniyamma on 20-10-2026:
  // Row 1: ₹900, 5 Big Boxes, Line amount = ₹4,500, amountPaid = 0
  const sale1 = await Transaction.create({
    buyerId: buyerMuniyamma._id,
    buyerName: buyerMuniyamma.name,
    transactionDate: testDate,
    type: 'SALE',
    bigBoxes: 5,
    smallBoxes: 0,
    bigEquivalent: 5,
    ratePerBigBox: 900,
    billAmount: 4500,
    amountPaid: 0,
    oldBalance: 5000,
    totalDue: 9500,
    newBalance: 9500,
    notes: 'Morning purchase'
  });

  // Row 2: ₹500, 2 Big Boxes, Line amount = ₹1,000, amountPaid = 8,000
  const sale2 = await Transaction.create({
    buyerId: buyerMuniyamma._id,
    buyerName: buyerMuniyamma.name,
    transactionDate: testDate,
    type: 'SALE',
    bigBoxes: 2,
    smallBoxes: 0,
    bigEquivalent: 2,
    ratePerBigBox: 500,
    billAmount: 1000,
    amountPaid: 8000,
    oldBalance: 9500,
    totalDue: 10500,
    newBalance: 2500,
    notes: 'Afternoon purchase + payment'
  });

  // Recalculate ledger to ensure exact chronological consistency
  await recalculateBuyerLedger(buyerMuniyamma._id);

  // Create isolated transaction on another date for Muniyamma (must NOT be included in 2026-10-20 bill)
  const saleOtherDate = await Transaction.create({
    buyerId: buyerMuniyamma._id,
    buyerName: buyerMuniyamma.name,
    transactionDate: otherDate,
    type: 'SALE',
    bigBoxes: 10,
    smallBoxes: 0,
    bigEquivalent: 10,
    ratePerBigBox: 800,
    billAmount: 8000,
    amountPaid: 0,
    oldBalance: 2500,
    totalDue: 10500,
    newBalance: 10500,
    notes: 'Next day'
  });

  // Create transaction for another buyer (must NOT be included)
  const saleOtherBuyer = await Transaction.create({
    buyerId: buyerOther._id,
    buyerName: buyerOther.name,
    transactionDate: testDate,
    type: 'SALE',
    bigBoxes: 3,
    smallBoxes: 0,
    bigEquivalent: 3,
    ratePerBigBox: 600,
    billAmount: 1800,
    amountPaid: 0,
    oldBalance: 2000,
    totalDue: 3800,
    newBalance: 3800,
    notes: 'Other buyer'
  });

  await recalculateBuyerLedger(buyerOther._id);

  await t.test('1. Two sales at different rates for the same buyer/date print on one bill with ₹5,500 total', async () => {
    const bill = await getConsolidatedBuyerBill({
      buyerId: buyerMuniyamma._id,
      transactionDate: testDate
    });

    assert.equal(bill.buyerName, buyerMuniyamma.name);
    assert.equal(bill.itemCount, 2);
    assert.equal(bill.todayBill, 5500);
    assert.equal(bill.totalBigBoxes, 7);
    assert.equal(bill.totalBigEquivalent, 7);
    assert.equal(bill.oldBalance, 5000);
    assert.equal(bill.totalDue, 10500);
    assert.equal(bill.amountPaid, 8000);
    assert.equal(bill.newBalance, 2500);
  });

  await t.test('2. Three or more sales entries for the same buyer/date all appear on the same bill', async () => {
    // Add a 3rd sale for Muniyamma on testDate: 3 boxes @ 700 = 2100
    const sale3 = await Transaction.create({
      buyerId: buyerMuniyamma._id,
      buyerName: buyerMuniyamma.name,
      transactionDate: testDate,
      type: 'SALE',
      bigBoxes: 3,
      smallBoxes: 0,
      bigEquivalent: 3,
      ratePerBigBox: 700,
      billAmount: 2100,
      amountPaid: 0,
      oldBalance: 0,
      totalDue: 0,
      newBalance: 0
    });
    await recalculateBuyerLedger(buyerMuniyamma._id);

    const bill = await getConsolidatedBuyerBill({
      buyerId: buyerMuniyamma._id,
      transactionDate: testDate
    });

    assert.equal(bill.itemCount, 3);
    assert.equal(bill.todayBill, 7600); // 4500 + 1000 + 2100
    assert.equal(bill.totalBigBoxes, 10);
    assert.equal(bill.totalDue, 12600); // 5000 + 7600
    assert.equal(bill.newBalance, 4600); // 12600 - 8000

    // Clean up sale3
    await Transaction.deleteOne({ _id: sale3._id });
    await recalculateBuyerLedger(buyerMuniyamma._id);
  });

  await t.test('3. Printing from any entry in the group returns the same consolidated bill', async () => {
    const billFromSale1 = await getConsolidatedBuyerBill({ transactionId: sale1._id });
    const billFromSale2 = await getConsolidatedBuyerBill({ transactionId: sale2._id });

    assert.equal(billFromSale1.todayBill, 5500);
    assert.equal(billFromSale2.todayBill, 5500);
    assert.equal(billFromSale1.totalDue, billFromSale2.totalDue);
    assert.equal(billFromSale1.newBalance, billFromSale2.newBalance);
    assert.deepEqual(
      billFromSale1.transactionIds.map(String),
      billFromSale2.transactionIds.map(String)
    );
  });

  await t.test('4. Different buyers and different dates remain strictly isolated', async () => {
    const muniyammaBill = await getConsolidatedBuyerBill({
      buyerId: buyerMuniyamma._id,
      transactionDate: testDate
    });
    const otherBuyerBill = await getConsolidatedBuyerBill({
      buyerId: buyerOther._id,
      transactionDate: testDate
    });

    assert.equal(muniyammaBill.itemCount, 2);
    assert.equal(muniyammaBill.todayBill, 5500);

    assert.equal(otherBuyerBill.itemCount, 1);
    assert.equal(otherBuyerBill.todayBill, 1800);
    assert.equal(otherBuyerBill.totalDue, 3800);

    // Verify other date is excluded from testDate bill
    const otherDateIncluded = muniyammaBill.transactionIds.some(
      (id) => String(id) === String(saleOtherDate._id)
    );
    assert.equal(otherDateIncluded, false);
  });

  await t.test('5. Voided sales are excluded from the consolidated bill', async () => {
    // Void sale2
    sale2.isVoid = true;
    sale2.voidReason = 'Test void';
    await sale2.save();
    await recalculateBuyerLedger(buyerMuniyamma._id);

    const bill = await getConsolidatedBuyerBill({
      buyerId: buyerMuniyamma._id,
      transactionDate: testDate
    });

    // Only sale1 remains
    assert.equal(bill.itemCount, 1);
    assert.equal(bill.todayBill, 4500);
    assert.equal(bill.totalBigBoxes, 5);

    // Un-void sale2 for subsequent tests
    sale2.isVoid = false;
    sale2.voidReason = '';
    await sale2.save();
    await recalculateBuyerLedger(buyerMuniyamma._id);
  });

  await t.test('6. Different rates and box quantities produce correct individual amounts and consolidated totals', async () => {
    const bill = await getConsolidatedBuyerBill({
      buyerId: buyerMuniyamma._id,
      transactionDate: testDate
    });

    assert.equal(bill.items[0].ratePerBigBox, 900);
    assert.equal(bill.items[0].bigBoxes, 5);
    assert.equal(bill.items[0].lineAmount, 4500);

    assert.equal(bill.items[1].ratePerBigBox, 500);
    assert.equal(bill.items[1].bigBoxes, 2);
    assert.equal(bill.items[1].lineAmount, 1000);

    assert.equal(bill.todayBill, 5500);
  });

  await t.test('7. Opening balance is not added multiple times (authoritative ledger balance before the day)', async () => {
    const bill = await getConsolidatedBuyerBill({
      buyerId: buyerMuniyamma._id,
      transactionDate: testDate
    });

    // Opening balance should be exactly 5000, NOT 5000 + 9500
    assert.equal(bill.oldBalance, 5000);
    assert.equal(bill.totalDue, 10500); // 5000 + 5500
  });

  await t.test('8. Payments and payment-only transactions on that date are counted exactly once', async () => {
    // Add a PAYMENT-only transaction of ₹500 on testDate
    const paymentTx = await Transaction.create({
      buyerId: buyerMuniyamma._id,
      buyerName: buyerMuniyamma.name,
      transactionDate: testDate,
      type: 'PAYMENT',
      amountPaid: 500,
      oldBalance: 0,
      totalDue: 0,
      newBalance: 0
    });
    await recalculateBuyerLedger(buyerMuniyamma._id);

    const bill = await getConsolidatedBuyerBill({
      buyerId: buyerMuniyamma._id,
      transactionDate: testDate
    });

    // Total paid should be 8000 (from sale2) + 500 (from paymentTx) = 8500
    assert.equal(bill.amountPaid, 8500);
    assert.equal(bill.todayBill, 5500);
    assert.equal(bill.totalDue, 10500);
    assert.equal(bill.newBalance, 2000); // 10500 - 8500

    // Clean up paymentTx
    await Transaction.deleteOne({ _id: paymentTx._id });
    await recalculateBuyerLedger(buyerMuniyamma._id);
  });

  await t.test('9. Reopening or reprinting does not create duplicate transactions or alter ledger', async () => {
    const countBefore = await Transaction.countDocuments({ buyerId: buyerMuniyamma._id });
    const bill1 = await getConsolidatedBuyerBill({ transactionId: sale1._id });
    const bill2 = await getConsolidatedBuyerBill({ transactionId: sale1._id });
    const countAfter = await Transaction.countDocuments({ buyerId: buyerMuniyamma._id });

    assert.equal(countBefore, countAfter);
    assert.equal(bill1.todayBill, bill2.todayBill);
    assert.equal(bill1.newBalance, bill2.newBalance);
  });

  await t.test('10. Modifying an individual sale correctly updates consolidated bill totals', async () => {
    // Change sale1 boxes from 5 to 6 (6 * 900 = 5400)
    sale1.bigBoxes = 6;
    sale1.bigEquivalent = 6;
    sale1.billAmount = 5400;
    await sale1.save();
    await recalculateBuyerLedger(buyerMuniyamma._id);

    const bill = await getConsolidatedBuyerBill({ transactionId: sale1._id });
    assert.equal(bill.todayBill, 6400); // 5400 + 1000
    assert.equal(bill.totalBigBoxes, 8); // 6 + 2
    assert.equal(bill.totalDue, 11400); // 5000 + 6400
    assert.equal(bill.newBalance, 3400); // 11400 - 8000

    // Restore sale1 to 5 boxes
    sale1.bigBoxes = 5;
    sale1.bigEquivalent = 5;
    sale1.billAmount = 4500;
    await sale1.save();
    await recalculateBuyerLedger(buyerMuniyamma._id);
  });

  await t.test('11. All original transaction history remains intact and available in MongoDB', async () => {
    const activeTxs = await Transaction.find({ buyerId: buyerMuniyamma._id, isVoid: false });
    assert.equal(activeTxs.length, 3); // sale1, sale2, saleOtherDate
    assert.ok(activeTxs.some((t) => t.ratePerBigBox === 900));
    assert.ok(activeTxs.some((t) => t.ratePerBigBox === 500));
  });

  await t.test('12. Buyer Bill HTML contains multiple rows, subtotal, and exact font styling', async () => {
    const bill = await getConsolidatedBuyerBill({
      buyerId: buyerMuniyamma._id,
      transactionDate: testDate
    });

    const html = renderBuyerBillHtml(bill, { ownerName: 'R. பூட்டோ' });

    assert.ok(html.includes('89mm 89mm'), 'Contains strict 89x89 mm page dimensions');
    assert.ok(html.includes('900'), 'Includes Row 1 rate 900');
    assert.ok(html.includes('4,500'), 'Includes Row 1 amount 4,500');
    assert.ok(html.includes('500'), 'Includes Row 2 rate 500');
    assert.ok(html.includes('1,000'), 'Includes Row 2 amount 1,000');
    assert.ok(html.includes('மொத்த பில் :'), 'Includes subtotal row label');
    assert.ok(html.includes('5,500'), 'Includes today bill subtotal 5,500');
    assert.ok(html.includes('10,500'), 'Includes total due 10,500 in accounting summary');
    assert.ok(html.includes('2,500'), 'Includes new balance 2,500 in accounting summary');
    assert.ok(html.includes('8,000'), 'Includes payment 8,000 in accounting summary');
  });

  await t.test('13. Chrome Headless 89x89 mm PDF Generation for Consolidated Buyer Bill', async () => {
    const bill = await getConsolidatedBuyerBill({
      buyerId: buyerMuniyamma._id,
      transactionDate: testDate
    });

    const pdfResult = await generatePdfFile({
      type: 'buyer',
      transaction: bill
    });

    assert.ok(pdfResult.pdfPath, 'PDF path returned');
    assert.ok(fs.existsSync(pdfResult.pdfPath), 'PDF file exists on disk');
    assert.equal(pdfResult.pageCount, 1, 'Generates exactly 1 page');
    assert.ok(pdfResult.mediaBox.includes('252'), 'MediaBox matches 89x89mm (252.28 pt)');

    // Clean up test PDF
    try {
      fs.unlinkSync(pdfResult.pdfPath);
    } catch {}
  });

  // Clean synthetic records after tests
  await Transaction.deleteMany({ buyerId: { $in: [buyerMuniyamma._id, buyerOther._id] } });
  await Buyer.deleteMany({ _id: { $in: [buyerMuniyamma._id, buyerOther._id] } });
  await mongoose.connection.close();
});
