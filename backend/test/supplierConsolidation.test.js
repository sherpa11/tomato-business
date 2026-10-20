import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { connectDB } from '../src/config/db.js';
import Supplier from '../src/models/Supplier.js';
import Purchase from '../src/models/Purchase.js';
import SupplierBill from '../src/models/SupplierBill.js';
import {
  getConsolidatedSupplierBill,
  saveSupplierBillDeductions
} from '../src/services/supplierBillService.js';
import { renderSupplierBillHtml, generatePdfFile } from '../src/services/printService.js';

test('Supplier Consolidation, Deductions and Green Bill Suite', async (t) => {
  await connectDB();

  // Test identifiers
  const testDate = '2026-10-20';
  const otherDate = '2026-10-21';

  // Create isolated test suppliers
  const supplierAK = await Supplier.findOneAndUpdate(
    { name: 'TEST_SUPPLIER_AK' },
    { name: 'TEST_SUPPLIER_AK', phone: '9988776655', address: 'Yard A' },
    { upsert: true, new: true }
  );

  const supplierOther = await Supplier.findOneAndUpdate(
    { name: 'TEST_SUPPLIER_OTHER' },
    { name: 'TEST_SUPPLIER_OTHER', phone: '9988776644', address: 'Yard B' },
    { upsert: true, new: true }
  );

  // Clean any existing test records
  await Purchase.deleteMany({ supplierId: { $in: [supplierAK._id, supplierOther._id] } });
  await SupplierBill.deleteMany({ supplierId: { $in: [supplierAK._id, supplierOther._id] } });

  // 1. Create Purchase Entry 1: AK - 68 Big Boxes @ ₹300 = ₹20,400 on 2026-10-20
  const p1 = await Purchase.create({
    supplierId: supplierAK._id,
    supplierName: supplierAK.name,
    transactionDate: testDate,
    bigBoxes: 68,
    smallBoxes: 0,
    bigEquivalent: 68,
    ratePerBigBox: 300,
    totalAmount: 20400,
    notes: 'Lot 1 morning'
  });

  // 2. Create Purchase Entry 2: AK - 82 Big Boxes @ ₹550 = ₹45,100 on 2026-10-20
  const p2 = await Purchase.create({
    supplierId: supplierAK._id,
    supplierName: supplierAK.name,
    transactionDate: testDate,
    bigBoxes: 82,
    smallBoxes: 0,
    bigEquivalent: 82,
    ratePerBigBox: 550,
    totalAmount: 45100,
    notes: 'Lot 2 noon'
  });

  // 3. Create Purchase for Another Date: AK on 2026-10-21 (Must not be included)
  const pOtherDate = await Purchase.create({
    supplierId: supplierAK._id,
    supplierName: supplierAK.name,
    transactionDate: otherDate,
    bigBoxes: 50,
    smallBoxes: 0,
    bigEquivalent: 50,
    ratePerBigBox: 400,
    totalAmount: 20000,
    notes: 'Next day lot'
  });

  // 4. Create Purchase for Another Supplier: TEST_SUPPLIER_OTHER on 2026-10-20 (Must not be included)
  const pOtherSupplier = await Purchase.create({
    supplierId: supplierOther._id,
    supplierName: supplierOther.name,
    transactionDate: testDate,
    bigBoxes: 30,
    smallBoxes: 0,
    bigEquivalent: 30,
    ratePerBigBox: 350,
    totalAmount: 10500,
    notes: 'Different supplier lot'
  });

  await t.test('1. Two purchases for the same supplier on one date produce one consolidated bill with ₹65,500 gross total', async () => {
    const bill = await getConsolidatedSupplierBill({
      supplierId: supplierAK._id,
      transactionDate: testDate
    });

    assert.equal(bill.itemCount, 2);
    assert.equal(bill.grossTotal, 65500);
    assert.equal(bill.totalBigBoxes, 150);
    assert.equal(bill.supplierName, 'TEST_SUPPLIER_AK');
    assert.equal(bill.transactionDate, testDate);
  });

  await t.test('2. Three or more purchases for the same supplier on that date are all included', async () => {
    // Add third purchase entry: 20 Big Boxes @ ₹400 = ₹8,000
    const p3 = await Purchase.create({
      supplierId: supplierAK._id,
      supplierName: supplierAK.name,
      transactionDate: testDate,
      bigBoxes: 20,
      smallBoxes: 0,
      bigEquivalent: 20,
      ratePerBigBox: 400,
      totalAmount: 8000,
      notes: 'Lot 3 evening'
    });

    const bill = await getConsolidatedSupplierBill({
      supplierId: supplierAK._id,
      transactionDate: testDate
    });

    assert.equal(bill.itemCount, 3);
    assert.equal(bill.grossTotal, 73500); // 65500 + 8000
    assert.equal(bill.totalBigBoxes, 170);

    // Clean up p3 to keep standard example state (65,500)
    await Purchase.findByIdAndDelete(p3._id);
  });

  await t.test('3. Different purchase rates display on their correct individual rows', async () => {
    const bill = await getConsolidatedSupplierBill({
      supplierId: supplierAK._id,
      transactionDate: testDate
    });

    assert.equal(bill.items.length, 2);
    assert.equal(bill.items[0].ratePerBigBox, 300);
    assert.equal(bill.items[0].bigBoxes, 68);
    assert.equal(bill.items[0].lineAmount, 20400);

    assert.equal(bill.items[1].ratePerBigBox, 550);
    assert.equal(bill.items[1].bigBoxes, 82);
    assert.equal(bill.items[1].lineAmount, 45100);
  });

  await t.test('4. Purchases for another supplier or another date are strictly excluded', async () => {
    const bill = await getConsolidatedSupplierBill({
      supplierId: supplierAK._id,
      transactionDate: testDate
    });

    // Check purchase IDs
    const includedIds = bill.items.map((i) => String(i._id));
    assert.equal(includedIds.includes(String(pOtherDate._id)), false);
    assert.equal(includedIds.includes(String(pOtherSupplier._id)), false);

    // Check other supplier's consolidated bill is independent
    const otherBill = await getConsolidatedSupplierBill({
      supplierId: supplierOther._id,
      transactionDate: testDate
    });
    assert.equal(otherBill.itemCount, 1);
    assert.equal(otherBill.grossTotal, 10500);
    assert.equal(otherBill.supplierName, 'TEST_SUPPLIER_OTHER');
  });

  await t.test('5. Deductions are saved, persisted, and net total is correctly calculated', async () => {
    // Example from prompt:
    // Gross: ₹65,500
    // கமிஷன்: 500, கேட்: 200, கூலி: 300, வாடகை: 100, பற்று: 400
    // Total Deductions: 1,500
    // Net Total (மொத்தம்): 64,000
    const savedBill = await saveSupplierBillDeductions({
      supplierId: supplierAK._id,
      transactionDate: testDate,
      commission: 500,
      gate: 200,
      coolie: 300,
      rent: 100,
      debit: 400
    });

    assert.equal(savedBill.grossTotal, 65500);
    assert.equal(savedBill.deductions.commission, 500);
    assert.equal(savedBill.deductions.gate, 200);
    assert.equal(savedBill.deductions.coolie, 300);
    assert.equal(savedBill.deductions.rent, 100);
    assert.equal(savedBill.deductions.debit, 400);
    assert.equal(savedBill.deductions.totalDeductions, 1500);
    assert.equal(savedBill.netTotal, 64000);
  });

  await t.test('6. Reopening or reprinting does not duplicate or multiply deductions', async () => {
    // Retrieve bill again
    const billAgain = await getConsolidatedSupplierBill({
      supplierId: supplierAK._id,
      transactionDate: testDate
    });

    assert.equal(billAgain.deductions.totalDeductions, 1500);
    assert.equal(billAgain.netTotal, 64000);

    // Retrieve by purchaseId of p1
    const billByP1 = await getConsolidatedSupplierBill({
      purchaseId: p1._id
    });
    assert.equal(billByP1.itemCount, 2);
    assert.equal(billByP1.grossTotal, 65500);
    assert.equal(billByP1.netTotal, 64000);

    // Retrieve by purchaseId of p2
    const billByP2 = await getConsolidatedSupplierBill({
      purchaseId: p2._id
    });
    assert.equal(billByP2.itemCount, 2);
    assert.equal(billByP2.grossTotal, 65500);
    assert.equal(billByP2.netTotal, 64000);
  });

  await t.test('7. Green styling and HTML elements verification', () => {
    const dummyBill = {
      supplierName: 'TEST_SUPPLIER_AK',
      transactionDate: testDate,
      lotNumber: '0123',
      items: [
        { ratePerBigBox: 300, bigBoxes: 68, smallBoxes: 0, bigEquivalent: 68, lineAmount: 20400, descLine1: 'தக்காளி பெரிய பெட்டி', descLine2: '(Big Box)', qtyText: '68' },
        { ratePerBigBox: 550, bigBoxes: 82, smallBoxes: 0, bigEquivalent: 82, lineAmount: 45100, descLine1: 'தக்காளி பெரிய பெட்டி', descLine2: '(Big Box)', qtyText: '82' }
      ],
      grossTotal: 65500,
      deductions: {
        commission: 500,
        gate: 200,
        coolie: 300,
        rent: 100,
        debit: 400,
        totalDeductions: 1500
      },
      netTotal: 64000
    };

    const html = renderSupplierBillHtml(dummyBill, { phone: '94434 01838' });

    // Assert green theme color #034d28 is consistently used
    assert.match(html, /#034d28/);
    assert.equal(html.includes('border: 1.5px solid #034d28'), true);
    assert.equal(html.includes('border: 1px solid #034d28'), true);

    // Verify no black borders are present
    assert.equal(html.includes('border: 1.5px solid #000000'), false);
    assert.equal(html.includes('border: 1px solid #000000'), false);

    // Check line amounts and rates are rendered in table
    assert.match(html, /20,400/);
    assert.match(html, /45,100/);

    // Check Gross Total row
    assert.match(html, /65,500/);

    // Check Tamil deduction rows are rendered
    assert.match(html, /கமிஷன்/);
    assert.match(html, /கேட்/);
    assert.match(html, /கூலி/);
    assert.match(html, /வாடகை/);
    assert.match(html, /பற்று/);

    // Check deduction values are rendered
    assert.match(html, /500/);
    assert.match(html, /200/);
    assert.match(html, /300/);
    assert.match(html, /100/);
    assert.match(html, /400/);

    // Check Net Total row
    assert.match(html, /மொத்தம்/);
    assert.match(html, /64,000/);
  });

  await t.test('8. Chrome Headless 1-Page PDF Generation for Consolidated Bill', async (subT) => {
    const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    if (!fs.existsSync(CHROME_PATH)) {
      subT.skip('Chrome executable not found, skipping PDF generation.');
      return;
    }

    const bill = await getConsolidatedSupplierBill({
      supplierId: supplierAK._id,
      transactionDate: testDate
    });

    const tmpPdf = path.join(os.tmpdir(), `test-consolidated-supplier-${Date.now()}.pdf`);
    try {
      await generatePdfFile({
        type: 'supplier',
        purchase: bill,
        targetPdfPath: tmpPdf
      });

      assert.equal(fs.existsSync(tmpPdf), true);
      const pdfBuffer = fs.readFileSync(tmpPdf);
      const pdfStr = pdfBuffer.toString('latin1');
      const pages = pdfStr.match(/\/Type\s*\/Page\b/g) || [];

      // Consolidated supplier bill must strictly fit on 1 page (A6)
      assert.equal(pages.length, 1, `Expected 1 page but found ${pages.length}`);
    } finally {
      if (fs.existsSync(tmpPdf)) fs.unlinkSync(tmpPdf);
    }
  });

  // Clean up test database records
  await Purchase.deleteMany({ supplierId: { $in: [supplierAK._id, supplierOther._id] } });
  await SupplierBill.deleteMany({ supplierId: { $in: [supplierAK._id, supplierOther._id] } });
  await Supplier.deleteMany({ _id: { $in: [supplierAK._id, supplierOther._id] } });

  await mongoose.disconnect();
});
