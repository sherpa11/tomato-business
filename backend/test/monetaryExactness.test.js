import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import Buyer from '../src/models/Buyer.js';
import Transaction from '../src/models/Transaction.js';
import {
  calculateBigEquivalent,
  roundMoney,
  recalculateBuyerLedger,
  getBuyerOldBalance
} from '../src/services/ledgerService.js';
import { renderBuyerBillHtml } from '../src/services/printService.js';

test('Monetary Values & Whole-Rupee Exactness Suite', async (t) => {
  await connectDB();

  await t.test('1. roundMoney preserves exact integers and prevents float decimals', () => {
    // Exact entered values
    assert.equal(roundMoney(833), 833);
    assert.equal(roundMoney(4999), 4999);
    assert.equal(roundMoney(4998), 4998);
    assert.equal(roundMoney(0), 0);

    // Floating-point math artifacts are rounded to whole rupees without decimals
    assert.equal(roundMoney(4999.98), 5000);
    assert.equal(roundMoney(4399.97), 4400);
    assert.equal(roundMoney(833.00), 833);
    assert.equal(roundMoney(416.5), 417);
  });

  await t.test('2. Exact calculation: 6 boxes x 833 rate = 4998 exactly', () => {
    const bigBoxes = 6;
    const smallBoxes = 0;
    const ratePerBigBox = 833;
    const bigEq = calculateBigEquivalent(bigBoxes, smallBoxes);
    const billAmount = roundMoney(bigEq * ratePerBigBox);

    assert.equal(bigEq, 6);
    assert.equal(billAmount, 4998);
    assert.equal(Number.isInteger(billAmount), true);
  });

  const testBuyer = await Buyer.findOneAndUpdate(
    { name: 'TEST_EXACT_MONEY_BUYER' },
    { name: 'TEST_EXACT_MONEY_BUYER', phone: '9842199999', initialBalance: 1000, currentBalance: 1000 },
    { upsert: true, new: true }
  );

  // Clean old test transactions
  await Transaction.deleteMany({ buyerId: testBuyer._id });

  await t.test('3. Ledger preserves exact whole-rupee amounts and enforces Previous + Today - Paid = New', async () => {
    // 1. Transaction 1: Sale of 6 boxes @ 833 = 4998 bill, paid 3000
    // Previous: 1000
    // Today: 4998
    // Total Due: 1000 + 4998 = 5998
    // Amount Paid: 3000
    // New Balance: 5998 - 3000 = 2998
    const tx1 = await Transaction.create({
      buyerId: testBuyer._id,
      buyerName: testBuyer.name,
      transactionDate: '2026-11-20',
      type: 'SALE',
      bigBoxes: 6,
      smallBoxes: 0,
      bigEquivalent: 6,
      ratePerBigBox: 833,
      billAmount: 4998,
      amountPaid: 3000,
      oldBalance: 1000,
      totalDue: 5998,
      newBalance: 2998
    });

    await recalculateBuyerLedger(testBuyer._id);
    const updatedTx1 = await Transaction.findById(tx1._id);

    assert.equal(updatedTx1.oldBalance, 1000);
    assert.equal(updatedTx1.billAmount, 4998);
    assert.equal(updatedTx1.totalDue, 5998);
    assert.equal(updatedTx1.amountPaid, 3000);
    assert.equal(updatedTx1.newBalance, 2998);
    assert.equal(Number.isInteger(updatedTx1.newBalance), true);

    // 2. Transaction 2: Payment of exactly ₹2,998 to settle
    const tx2 = await Transaction.create({
      buyerId: testBuyer._id,
      buyerName: testBuyer.name,
      transactionDate: '2026-11-21',
      type: 'PAYMENT',
      amountPaid: 2998,
      oldBalance: 2998,
      totalDue: 2998,
      newBalance: 0
    });

    await recalculateBuyerLedger(testBuyer._id);
    const updatedTx2 = await Transaction.findById(tx2._id);
    const updatedBuyer = await Buyer.findById(testBuyer._id);

    assert.equal(updatedTx2.oldBalance, 2998);
    assert.equal(updatedTx2.amountPaid, 2998);
    assert.equal(updatedTx2.newBalance, 0);
    assert.equal(updatedBuyer.currentBalance, 0);
  });

  await t.test('4. Multi-row sale preserves exact line amounts in ledger', async () => {
    await Transaction.deleteMany({ buyerId: testBuyer._id });
    testBuyer.initialBalance = 0;
    await testBuyer.save();

    // Row 1: 3 boxes @ 833 = 2499
    // Row 2: 3 boxes @ 833 = 2499
    // Total Bill: 4998
    const txMulti = await Transaction.create({
      buyerId: testBuyer._id,
      buyerName: testBuyer.name,
      transactionDate: '2026-11-22',
      type: 'SALE',
      bigBoxes: 6,
      smallBoxes: 0,
      bigEquivalent: 6,
      ratePerBigBox: 833,
      billAmount: 4998,
      items: [
        { bigBoxes: 3, smallBoxes: 0, bigEquivalent: 3, ratePerBigBox: 833, lineAmount: 2499, billAmount: 2499 },
        { bigBoxes: 3, smallBoxes: 0, bigEquivalent: 3, ratePerBigBox: 833, lineAmount: 2499, billAmount: 2499 }
      ],
      amountPaid: 4998,
      oldBalance: 0,
      totalDue: 4998,
      newBalance: 0
    });

    await recalculateBuyerLedger(testBuyer._id);
    const reloaded = await Transaction.findById(txMulti._id);

    assert.equal(reloaded.billAmount, 4998);
    assert.equal(reloaded.items[0].lineAmount, 2499);
    assert.equal(reloaded.items[1].lineAmount, 2499);
    assert.equal(reloaded.totalDue, 4998);
    assert.equal(reloaded.newBalance, 0);
  });

  await t.test('5. renderBuyerBillHtml outputs whole rupees with 00 paise in receipt columns', () => {
    const tx = {
      buyerName: 'Ramesh',
      transactionDate: '2026-11-20',
      bigBoxes: 6,
      smallBoxes: 0,
      ratePerBigBox: 833,
      billAmount: 4998,
      amountPaid: 3000,
      oldBalance: 1000,
      totalDue: 5998,
      newBalance: 2998
    };

    const htmlA6 = renderBuyerBillHtml(tx, 'A6');
    assert.ok(htmlA6.includes('4,998'));
    assert.ok(htmlA6.includes('833'));
    // Should NOT contain fractional paise like 98 or 33
    assert.ok(!htmlA6.includes('4,998.'));
    assert.ok(!htmlA6.includes('4,999.'));

    const htmlSquare = renderBuyerBillHtml(tx, 'Square');
    assert.ok(htmlSquare.includes('4,998'));
    assert.ok(htmlSquare.includes('833'));
    assert.ok(!htmlSquare.includes('4,998.'));
  });

  // Cleanup
  await Transaction.deleteMany({ buyerId: testBuyer._id });
  await Buyer.deleteOne({ _id: testBuyer._id });
  await mongoose.disconnect();
});
