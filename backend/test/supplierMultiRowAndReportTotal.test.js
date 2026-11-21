import test from 'node:test';
import assert from 'node:assert/strict';
import { connectDB } from '../src/config/db.js';
import Supplier from '../src/models/Supplier.js';
import Purchase from '../src/models/Purchase.js';
import SupplierBill from '../src/models/SupplierBill.js';
import { getConsolidatedSupplierBill } from '../src/services/supplierBillService.js';
import { renderSupplierBillHtml } from '../src/services/printService.js';

const calculateBigEquivalent = (bigBoxes = 0, smallBoxes = 0) => {
  return Number(bigBoxes || 0) + (Number(smallBoxes || 0) / 2);
};

const roundMoney = (amount) => {
  const num = Number(amount) || 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

test('Supplier Multi-Row & Buyer Ledger Total Suite', async (t) => {
  await connectDB();

  await t.test('1. Box equivalent calculations and multi-row summation', () => {
    // Test 2 small boxes = 1 big box rule
    assert.equal(calculateBigEquivalent(0, 2), 1);
    assert.equal(calculateBigEquivalent(5, 4), 7);
    assert.equal(calculateBigEquivalent(10, 1), 10.5);

    // Multi-row purchase mock
    const rows = [
      { bigBoxes: 5, smallBoxes: 2, ratePerBigBox: 1000 },  // 6 big eqv @ 1000 = 6000
      { bigBoxes: 10, smallBoxes: 0, ratePerBigBox: 900 },  // 10 big eqv @ 900 = 9000
      { bigBoxes: 0, smallBoxes: 8, ratePerBigBox: 800 }    // 4 big eqv @ 800 = 3200
    ];

    let totalBig = 0;
    let totalSmall = 0;
    let totalBigEqv = 0;
    let totalAmount = 0;

    const items = rows.map((r) => {
      const eq = calculateBigEquivalent(r.bigBoxes, r.smallBoxes);
      const lineAmt = roundMoney(eq * r.ratePerBigBox);
      totalBig += r.bigBoxes;
      totalSmall += r.smallBoxes;
      totalBigEqv += eq;
      totalAmount += lineAmt;
      return {
        bigBoxes: r.bigBoxes,
        smallBoxes: r.smallBoxes,
        bigEquivalent: eq,
        ratePerBigBox: r.ratePerBigBox,
        lineAmount: lineAmt
      };
    });

    totalBigEqv = Math.round((totalBigEqv + Number.EPSILON) * 10) / 10;
    totalAmount = roundMoney(totalAmount);

    assert.equal(totalBig, 15);
    assert.equal(totalSmall, 10);
    assert.equal(totalBigEqv, 20); // 15 + 5 = 20
    assert.equal(totalAmount, 18200); // 6000 + 9000 + 3200 = 18200
    assert.equal(items.length, 3);
    assert.equal(items[0].lineAmount, 6000);
    assert.equal(items[1].lineAmount, 9000);
    assert.equal(items[2].lineAmount, 3200);
  });

  const testDate = '2026-11-21';
  const testSupplier = await Supplier.findOneAndUpdate(
    { name: 'TEST_MULTI_ROW_SUPPLIER' },
    { name: 'TEST_MULTI_ROW_SUPPLIER', phone: '9876543210', village: 'Ottanchathiram' },
    { upsert: true, new: true }
  );

  // Clean old test records
  await Purchase.deleteMany({ supplierId: testSupplier._id });
  await SupplierBill.deleteMany({ supplierId: testSupplier._id });

  await t.test('2. Supplier bill consolidation unrolls multi-row purchase items from DB', async () => {
    await Purchase.create({
      supplierId: testSupplier._id,
      supplierName: testSupplier.name,
      transactionDate: testDate,
      bigBoxes: 15,
      smallBoxes: 10,
      bigEquivalent: 20,
      ratePerBigBox: 1000,
      totalAmount: 18200,
      items: [
        { bigBoxes: 5, smallBoxes: 2, bigEquivalent: 6, ratePerBigBox: 1000, lineAmount: 6000 },
        { bigBoxes: 10, smallBoxes: 0, bigEquivalent: 10, ratePerBigBox: 900, lineAmount: 9000 },
        { bigBoxes: 0, smallBoxes: 8, bigEquivalent: 4, ratePerBigBox: 800, lineAmount: 3200 }
      ]
    });

    const bill = await getConsolidatedSupplierBill({
      supplierId: testSupplier._id.toString(),
      transactionDate: testDate
    });

    assert.equal(bill.supplierName, 'TEST_MULTI_ROW_SUPPLIER');
    assert.equal(bill.transactionDate, testDate);
    assert.equal(bill.grossTotal, 18200);
    assert.equal(bill.netTotal, 18200);
    assert.equal(bill.totalBigEquivalent, 20);
    assert.equal(bill.totalBigBoxes, 15);
    assert.equal(bill.totalSmallBoxes, 10);

    // Check that the items are unrolled into individual line items
    assert.equal(bill.items.length, 3);
    assert.equal(bill.items[0].ratePerBigBox, 1000);
    assert.equal(bill.items[0].lineAmount, 6000);
    assert.equal(bill.items[1].ratePerBigBox, 900);
    assert.equal(bill.items[1].lineAmount, 9000);
    assert.equal(bill.items[2].ratePerBigBox, 800);
    assert.equal(bill.items[2].lineAmount, 3200);
  });

  await t.test('3. Backward compatibility for legacy single-row supplier purchases', async () => {
    // Delete previous test purchase
    await Purchase.deleteMany({ supplierId: testSupplier._id });

    await Purchase.create({
      supplierId: testSupplier._id,
      supplierName: testSupplier.name,
      transactionDate: testDate,
      bigBoxes: 8,
      smallBoxes: 4,
      bigEquivalent: 10,
      ratePerBigBox: 950,
      totalAmount: 9500
      // legacy without items array
    });

    const bill = await getConsolidatedSupplierBill({
      supplierId: testSupplier._id.toString(),
      transactionDate: testDate
    });

    assert.equal(bill.grossTotal, 9500);
    assert.equal(bill.netTotal, 9500);
    assert.equal(bill.items.length, 1);
    assert.equal(bill.items[0].ratePerBigBox, 950);
    assert.equal(bill.items[0].lineAmount, 9500);
    assert.equal(bill.items[0].bigEquivalent, 10);
  });

  await t.test('4. renderSupplierBillHtml prints multiple rows accurately', () => {
    const purchaseData = {
      supplierName: 'TEST_MULTI_ROW_SUPPLIER',
      transactionDate: '2026-11-21',
      items: [
        { bigBoxes: 5, smallBoxes: 2, bigEquivalent: 6, ratePerBigBox: 1000, lineAmount: 6000, totalAmount: 6000 },
        { bigBoxes: 10, smallBoxes: 0, bigEquivalent: 10, ratePerBigBox: 900, lineAmount: 9000, totalAmount: 9000 }
      ],
      grossTotal: 15000,
      netTotal: 15000
    };

    const businessProfile = {
      businessName: 'Mahalakshmi Tomato Mandi',
      phone: '9443401838'
    };

    const html = renderSupplierBillHtml(purchaseData, businessProfile);
    assert.ok(html.includes('TEST_MULTI_ROW_SUPPLIER'));
    assert.ok(html.includes('15,000'));
    assert.ok(html.includes('1,000'));
    assert.ok(html.includes('900'));
  });

  await t.test('5. Buyer ledger grand total computation and dynamic filters', () => {
    const rawBuyerBalances = [
      { _id: 'b1', name: 'Vency', currentBalance: 6000 },
      { _id: 'b2', name: 'Venu Biriyani', currentBalance: 2500 },
      { _id: 'b3', name: 'VJ Amma', currentBalance: 0 },
      { _id: 'b4', name: 'VMC Sangili', currentBalance: 1400 },
      { _id: 'b5', name: 'Yaagampatti Arul', currentBalance: 4000 },
      { _id: 'b6', name: 'Advance Buyer', currentBalance: -500 }
    ];

    // All displayed:
    const allSum = rawBuyerBalances.reduce((acc, b) => acc + (Number(b.currentBalance) || 0), 0);
    const roundedAll = Math.round((allSum + Number.EPSILON) * 100) / 100;
    assert.equal(roundedAll, 13400); // 6000 + 2500 + 0 + 1400 + 4000 - 500 = 13400

    // Filtered by Only With Due:
    const dueOnly = rawBuyerBalances.filter((b) => Number(b.currentBalance) > 0);
    const dueSum = dueOnly.reduce((acc, b) => acc + (Number(b.currentBalance) || 0), 0);
    const roundedDue = Math.round((dueSum + Number.EPSILON) * 100) / 100;
    assert.equal(roundedDue, 13900); // 6000 + 2500 + 1400 + 4000 = 13900

    // Filtered by Search:
    const vmcSearch = rawBuyerBalances.filter((b) => b.name.toLowerCase().includes('vmc'));
    const vmcSum = vmcSearch.reduce((acc, b) => acc + (Number(b.currentBalance) || 0), 0);
    assert.equal(vmcSum, 1400);
  });

  // Cleanup
  await Purchase.deleteMany({ supplierId: testSupplier._id });
  await SupplierBill.deleteMany({ supplierId: testSupplier._id });
  await Supplier.deleteOne({ _id: testSupplier._id });
});
