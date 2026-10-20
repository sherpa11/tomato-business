import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import Buyer from '../src/models/Buyer.js';
import Purchase from '../src/models/Purchase.js';
import Transaction from '../src/models/Transaction.js';
import {
  calculateBigEquivalent,
  roundMoney,
  recalculateBuyerLedger
} from '../src/services/ledgerService.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tomato_billing';

const runTests = async () => {
  await mongoose.connect(MONGODB_URI);
  console.log('Testing Accounting Rules & Data Integrity...\n');

  let passed = 0;
  let failed = 0;

  const assertEqual = (label, actual, expected) => {
    if (actual === expected) {
      console.log(`✅ [PASS] ${label}: ${actual}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${label}: Expected ${expected}, got ${actual}`);
      failed++;
    }
  };

  // Rule 1 & 2: Box Equivalence
  assertEqual('2 Small Boxes = 1 Big Eqv', calculateBigEquivalent(0, 2), 1);
  assertEqual('10 Big Boxes = 10 Big Eqv', calculateBigEquivalent(10, 0), 10);
  assertEqual('8 Big + 2 Small Boxes = 9 Big Eqv', calculateBigEquivalent(8, 2), 9);
  assertEqual('4 Small Boxes = 2 Big Eqv', calculateBigEquivalent(0, 4), 2);
  assertEqual('1 Small Box = 0.5 Big Eqv', calculateBigEquivalent(0, 1), 0.5);

  // Supplier A1 Purchase Test
  const a1Purchase = await Purchase.findOne({ supplierName: 'A1', isVoid: false });
  assertEqual('A1 Big Boxes', a1Purchase.bigBoxes, 250);
  assertEqual('A1 Rate', a1Purchase.ratePerBigBox, 1000);
  assertEqual('A1 Total Amount (250 x 1000 = 2,50,000)', a1Purchase.totalAmount, 250000);

  // Buyer B1: Old Bal 2500, 10 Big @ 1100 = 11000, Total Due 13500, Paid 12500, New Bal 1000
  const b1 = await Buyer.findOne({ name: 'B1' });
  const b1Tx = await Transaction.findOne({ buyerId: b1._id, isVoid: false });
  assertEqual('B1 Initial Balance', b1.initialBalance, 2500);
  assertEqual('B1 Bill Amount', b1Tx.billAmount, 11000);
  assertEqual('B1 Old Balance', b1Tx.oldBalance, 2500);
  assertEqual('B1 Total Due', b1Tx.totalDue, 13500);
  assertEqual('B1 Amount Paid', b1Tx.amountPaid, 12500);
  assertEqual('B1 New Balance', b1Tx.newBalance, 1000);
  assertEqual('B1 Current Balance in DB', b1.currentBalance, 1000);

  // Buyer B2: Old Bal 1000, 5 Big @ 1100 = 5500, Total Due 6500, Paid 6000, New Bal 500
  const b2 = await Buyer.findOne({ name: 'B2' });
  const b2Tx = await Transaction.findOne({ buyerId: b2._id, isVoid: false });
  assertEqual('B2 Initial Balance', b2.initialBalance, 1000);
  assertEqual('B2 Bill Amount', b2Tx.billAmount, 5500);
  assertEqual('B2 Total Due', b2Tx.totalDue, 6500);
  assertEqual('B2 Amount Paid', b2Tx.amountPaid, 6000);
  assertEqual('B2 New Balance', b2Tx.newBalance, 500);
  assertEqual('B2 Current Balance in DB', b2.currentBalance, 500);

  // Buyer B5: Payment-only (3000 old, paid 3000, new 0)
  const b5 = await Buyer.findOne({ name: 'B5' });
  const b5Tx = await Transaction.findOne({ buyerId: b5._id, isVoid: false });
  assertEqual('B5 Payment Only Type', b5Tx.type, 'PAYMENT');
  assertEqual('B5 Boxes = 0', b5Tx.bigBoxes + b5Tx.smallBoxes, 0);
  assertEqual('B5 Bill Amount = 0', b5Tx.billAmount, 0);
  assertEqual('B5 Old Balance', b5Tx.oldBalance, 3000);
  assertEqual('B5 New Balance', b5Tx.newBalance, 0);
  assertEqual('B5 Current Balance', b5.currentBalance, 0);

  // Buyer B7: Mixed (8 Big + 2 Small @ 1100 = 9900)
  const b7 = await Buyer.findOne({ name: 'B7' });
  const b7Tx = await Transaction.findOne({ buyerId: b7._id, isVoid: false });
  assertEqual('B7 Big Equivalent', b7Tx.bigEquivalent, 9);
  assertEqual('B7 Bill Amount', b7Tx.billAmount, 9900);

  // Buyer B8: Overpayment / Credit (Old 1000, 2 Big @ 1100 = 2200, Total Due 3200, Paid 4000 => -800)
  const b8 = await Buyer.findOne({ name: 'B8' });
  const b8Tx = await Transaction.findOne({ buyerId: b8._id, isVoid: false });
  assertEqual('B8 Old Balance', b8Tx.oldBalance, 1000);
  assertEqual('B8 Total Due', b8Tx.totalDue, 3200);
  assertEqual('B8 Amount Paid', b8Tx.amountPaid, 4000);
  assertEqual('B8 New Balance (-800 credit)', b8Tx.newBalance, -800);
  assertEqual('B8 Current Balance in DB', b8.currentBalance, -800);

  // Test Chronological Recalculation on Backdated insertion and Void
  // Create a temporary test buyer
  const testBuyer = await Buyer.create({
    name: 'Test_Chronology_' + Date.now(),
    initialBalance: 1000,
    currentBalance: 1000
  });

  // Day 2 Tx: 10 Big @ 1000 = 10000, Paid 5000. Balance becomes: 1000 + 10000 - 5000 = 6000
  const txDay2 = await Transaction.create({
    buyerId: testBuyer._id,
    buyerName: testBuyer.name,
    transactionDate: '2026-10-02',
    type: 'SALE',
    bigBoxes: 10,
    smallBoxes: 0,
    bigEquivalent: 10,
    ratePerBigBox: 1000,
    billAmount: 10000,
    amountPaid: 5000,
    oldBalance: 1000,
    totalDue: 11000,
    newBalance: 6000
  });

  // Now insert a BACKDATED transaction on Day 1: 5 Big @ 1000 = 5000, Paid 2000
  // Timeline should become:
  // Initial: 1000
  // Day 1: Old 1000 + Bill 5000 = 6000 - 2000 = New 4000
  // Day 2: Old 4000 + Bill 10000 = 14000 - 5000 = New 9000
  const txDay1 = await Transaction.create({
    buyerId: testBuyer._id,
    buyerName: testBuyer.name,
    transactionDate: '2026-10-01',
    type: 'SALE',
    bigBoxes: 5,
    smallBoxes: 0,
    bigEquivalent: 5,
    ratePerBigBox: 1000,
    billAmount: 5000,
    amountPaid: 2000,
    oldBalance: 0,
    totalDue: 0,
    newBalance: 0
  });

  // Trigger recalculate
  await recalculateBuyerLedger(testBuyer._id);

  const updatedDay1 = await Transaction.findById(txDay1._id);
  const updatedDay2 = await Transaction.findById(txDay2._id);
  const updatedBuyer = await Buyer.findById(testBuyer._id);

  assertEqual('Backdated Day 1 Old Balance', updatedDay1.oldBalance, 1000);
  assertEqual('Backdated Day 1 New Balance', updatedDay1.newBalance, 4000);
  assertEqual('Cascaded Day 2 Old Balance', updatedDay2.oldBalance, 4000);
  assertEqual('Cascaded Day 2 Total Due', updatedDay2.totalDue, 14000);
  assertEqual('Cascaded Day 2 New Balance', updatedDay2.newBalance, 9000);
  assertEqual('Buyer Current Balance after Backdate', updatedBuyer.currentBalance, 9000);

  // Now void Day 1 transaction and verify cascade
  updatedDay1.isVoid = true;
  updatedDay1.voidReason = 'Test void';
  await updatedDay1.save();
  await recalculateBuyerLedger(testBuyer._id);

  const day2AfterVoid = await Transaction.findById(txDay2._id);
  const buyerAfterVoid = await Buyer.findById(testBuyer._id);
  assertEqual('Day 2 Old Balance after Voiding Day 1', day2AfterVoid.oldBalance, 1000);
  assertEqual('Day 2 New Balance after Voiding Day 1', day2AfterVoid.newBalance, 6000);
  assertEqual('Buyer Current Balance after Void', buyerAfterVoid.currentBalance, 6000);

  // Clean up test buyer
  await Transaction.deleteMany({ buyerId: testBuyer._id });
  await Buyer.deleteOne({ _id: testBuyer._id });

  console.log(`\n========================================`);
  console.log(`TEST SUMMARY: ${passed} passed, ${failed} failed.`);
  console.log(`========================================\n`);

  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
};

runTests();
