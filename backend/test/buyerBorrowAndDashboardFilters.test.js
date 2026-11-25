import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import mongoose from 'mongoose';
import Buyer from '../src/models/Buyer.js';
import Transaction from '../src/models/Transaction.js';
import { recalculateBuyerLedger } from '../src/services/ledgerService.js';
import { connectDB } from '../src/config/db.js';

describe('Buyer Borrow Accounting & Dashboard Filters Suite', () => {
  let testBuyer;

  before(async () => {
    await connectDB();
    // Create a dedicated isolated test buyer
    testBuyer = await Buyer.create({
      name: `Test_Borrow_Buyer_${Date.now()}`,
      phone: '9999900000',
      initialBalance: 10000,
      currentBalance: 10000,
      active: true
    });
  });

  after(async () => {
    if (testBuyer) {
      await Transaction.deleteMany({ buyerId: testBuyer._id });
      await Buyer.findByIdAndDelete(testBuyer._id);
    }
    await mongoose.connection.close();
  });

  test('1. Transaction model enum allows "BORROW"', () => {
    const typeEnum = Transaction.schema.path('type').enumValues;
    assert.ok(typeEnum.includes('BORROW'), 'Transaction type enum must include BORROW');
    assert.ok(typeEnum.includes('SALE'), 'Transaction type enum must include SALE');
    assert.ok(typeEnum.includes('PAYMENT'), 'Transaction type enum must include PAYMENT');
  });

  test('2. Borrow accounting: adds borrow amount to balance due (10,000 + 2,000 = 12,000)', async () => {
    const borrowTx = await Transaction.create({
      buyerId: testBuyer._id,
      buyerName: testBuyer.name,
      transactionDate: '2026-11-25',
      type: 'BORROW',
      bigBoxes: 0,
      smallBoxes: 0,
      bigEquivalent: 0,
      ratePerBigBox: 0,
      billAmount: 2000,
      amountPaid: 0,
      oldBalance: 0,
      totalDue: 2000,
      newBalance: 2000,
      notes: 'Cash advance for truck fare'
    });

    const result = await recalculateBuyerLedger(testBuyer._id);
    assert.strictEqual(result.currentBalance, 12000, 'Current balance must increase to 12,000');

    const updatedTx = await Transaction.findById(borrowTx._id);
    assert.strictEqual(updatedTx.oldBalance, 10000, 'Old balance must be 10,000');
    assert.strictEqual(updatedTx.totalDue, 12000, 'Total due must be 12,000');
    assert.strictEqual(updatedTx.amountPaid, 0, 'Amount paid must remain 0');
    assert.strictEqual(updatedTx.newBalance, 12000, 'New balance must be 12,000');
  });

  test('3. Voiding a borrow entry correctly reverses the balance back to 10,000', async () => {
    const borrowTx = await Transaction.findOne({ buyerId: testBuyer._id, type: 'BORROW' });
    assert.ok(borrowTx, 'Borrow transaction must exist');

    borrowTx.isVoid = true;
    borrowTx.voidReason = 'Test void';
    await borrowTx.save();

    const result = await recalculateBuyerLedger(testBuyer._id);
    assert.strictEqual(result.currentBalance, 10000, 'Balance must return to 10,000 after voiding');

    // Restore for subsequent tests
    borrowTx.isVoid = false;
    await borrowTx.save();
    await recalculateBuyerLedger(testBuyer._id);
  });

  test('4. Payments Received filter logic combines multiple payments for the same buyer', () => {
    const mockTally = [
      { buyerId: 'b1', buyerName: 'Rajiv Gandhi', paid: 2000, isVoid: false },
      { buyerId: 'b1', buyerName: 'Rajiv Gandhi', paid: 3000, isVoid: false },
      { buyerId: 'b2', buyerName: 'CNP Royal', paid: 2500, isVoid: false },
      { buyerId: 'b3', buyerName: 'No Pay Buyer', paid: 0, isVoid: false },
      { buyerId: 'b4', buyerName: 'Voided Pay', paid: 5000, isVoid: true }
    ];

    const map = new Map();
    mockTally.forEach((tx) => {
      if (tx.isVoid) return;
      const paid = Math.round(Number(tx.paid || 0));
      if (paid > 0) {
        const key = tx.buyerId;
        if (!map.has(key)) {
          map.set(key, { buyerId: tx.buyerId, buyerName: tx.buyerName, totalPaid: paid });
        } else {
          map.get(key).totalPaid += paid;
        }
      }
    });

    const results = Array.from(map.values());
    assert.strictEqual(results.length, 2, 'Only buyers who paid should appear');

    const rajiv = results.find((r) => r.buyerName === 'Rajiv Gandhi');
    assert.ok(rajiv);
    assert.strictEqual(rajiv.totalPaid, 5000, 'Rajiv Gandhi payments must sum to 5,000');

    const cnp = results.find((r) => r.buyerName === 'CNP Royal');
    assert.ok(cnp);
    assert.strictEqual(cnp.totalPaid, 2500, 'CNP Royal payment must be 2,500');
  });

  test('5. Boxes Purchased by Rate filter: keeps different rates separate, combines same rates, never averages', () => {
    const mockSales = [
      {
        buyerId: 'b1',
        buyerName: 'Rajiv Gandhi',
        type: 'SALE',
        isVoid: false,
        items: [
          { bigBoxes: 4, smallBoxes: 0, ratePerBigBox: 900 },
          { bigBoxes: 2, smallBoxes: 0, ratePerBigBox: 700 }
        ]
      },
      {
        buyerId: 'b1',
        buyerName: 'Rajiv Gandhi',
        type: 'SALE',
        isVoid: false,
        items: [
          { bigBoxes: 3, smallBoxes: 0, ratePerBigBox: 900 }
        ]
      },
      {
        buyerId: 'b2',
        buyerName: 'CNP Royal',
        type: 'SALE',
        isVoid: false,
        items: [
          { bigBoxes: 3, smallBoxes: 0, ratePerBigBox: 800 }
        ]
      }
    ];

    const rateMap = new Map();
    mockSales.forEach((tx) => {
      if (tx.isVoid || tx.type !== 'SALE') return;
      tx.items.forEach((item) => {
        const big = Number(item.bigBoxes) || 0;
        const small = Number(item.smallBoxes) || 0;
        const rate = Math.round(Number(item.ratePerBigBox) || 0);
        if ((big > 0 || small > 0) && rate > 0) {
          const boxType = big > 0 && small > 0 ? 'MIXED' : (big > 0 ? 'BIG' : 'SMALL');
          const key = `${tx.buyerId}__${rate}__${boxType}`;
          if (!rateMap.has(key)) {
            rateMap.set(key, { buyerId: tx.buyerId, buyerName: tx.buyerName, rate, bigBoxes: big, smallBoxes: small });
          } else {
            rateMap.get(key).bigBoxes += big;
            rateMap.get(key).smallBoxes += small;
          }
        }
      });
    });

    const results = Array.from(rateMap.values());
    assert.strictEqual(results.length, 3, 'Must have 3 distinct rate entries');

    const rajiv900 = results.find((r) => r.buyerName === 'Rajiv Gandhi' && r.rate === 900);
    assert.ok(rajiv900, 'Rajiv Gandhi @ ₹900 must exist');
    assert.strictEqual(rajiv900.bigBoxes, 7, 'Rajiv Gandhi @ ₹900 boxes must sum to 7 (4 + 3)');
    assert.strictEqual(rajiv900.rate, 900, 'Rate must remain exact ₹900 (not averaged)');

    const rajiv700 = results.find((r) => r.buyerName === 'Rajiv Gandhi' && r.rate === 700);
    assert.ok(rajiv700, 'Rajiv Gandhi @ ₹700 must exist on a separate line');
    assert.strictEqual(rajiv700.bigBoxes, 2, 'Rajiv Gandhi @ ₹700 boxes must be 2');
    assert.strictEqual(rajiv700.rate, 700, 'Rate must remain exact ₹700 (not averaged)');

    const cnp800 = results.find((r) => r.buyerName === 'CNP Royal' && r.rate === 800);
    assert.ok(cnp800, 'CNP Royal @ ₹800 must exist');
    assert.strictEqual(cnp800.bigBoxes, 3);
    assert.strictEqual(cnp800.rate, 800);
  });
});
