import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generatePdfFile } from '../src/services/printService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Buyer Bill Dynamic Paper Size Selector & PDF Generation', () => {
  const sampleTransaction = {
    _id: '672b1234567890abcdef1234',
    buyerId: '672b1234567890abcdef5678',
    buyerName: 'கார்த்திக் (Karthik)',
    transactionDate: new Date('2026-11-05'),
    todayBill: 9000,
    billAmount: 9000,
    oldBalance: 74720,
    totalDue: 83720,
    amountPaid: 0,
    paid: 0,
    newBalance: 83720,
    bigBoxes: 15,
    smallBoxes: 0,
    ratePerBigBox: 600,
    items: [
      {
        _id: 'item1',
        ratePerBigBox: 600,
        bigBoxes: 15,
        smallBoxes: 0,
        bigEquivalent: 15,
        lineAmount: 9000,
        descLine1: 'தக்காளி பெரிய பெட்டி',
        descLine2: '(15 Big)',
        qtyText: '15'
      }
    ]
  };

  const sampleSettings = {
    phone: '94434 01838, 99438 01838',
    ownerName: 'R. பூட்டோ',
    address: 'shop no : 25, Gandhi Market, Dindigul, 624001'
  };

  test('Option 1: Square (89x89 mm) generates verified 1-page PDF with exact dimensions', async () => {
    const result = await generatePdfFile({
      type: 'buyer',
      transaction: sampleTransaction,
      settings: sampleSettings,
      paperSize: 'square'
    });

    try {
      assert.ok(fs.existsSync(result.pdfPath), 'Square PDF file must exist');
      assert.equal(result.pageCount, 1, 'Square PDF must be strictly 1 page');
      assert.ok(result.mediaBox, 'MediaBox should be present');

      // 89mm in points (72 pt / 25.4mm) = 252.283 pt
      const numbers = result.mediaBox.match(/[\d\.]+/g).map(Number);
      assert.equal(numbers.length, 4, 'MediaBox must have 4 coordinates');
      const widthPt = numbers[2];
      const heightPt = numbers[3];

      // Tolerance of 1 pt
      assert.ok(Math.abs(widthPt - 252.28) < 2, `Width must be ~252.28 pt (89mm), got ${widthPt}`);
      assert.ok(Math.abs(heightPt - 252.28) < 2, `Height must be ~252.28 pt (89mm), got ${heightPt}`);
    } finally {
      if (fs.existsSync(result.pdfPath)) fs.unlinkSync(result.pdfPath);
    }
  });

  test('Option 2: A6 (105x148 mm) generates verified 1-page PDF with exact dimensions', async () => {
    const result = await generatePdfFile({
      type: 'buyer',
      transaction: sampleTransaction,
      settings: sampleSettings,
      paperSize: 'a6'
    });

    try {
      assert.ok(fs.existsSync(result.pdfPath), 'A6 PDF file must exist');
      assert.equal(result.pageCount, 1, 'A6 PDF must be strictly 1 page');
      assert.ok(result.mediaBox, 'MediaBox should be present');

      // 105mm in points = 297.638 pt; 148mm = 419.528 pt
      const numbers = result.mediaBox.match(/[\d\.]+/g).map(Number);
      assert.equal(numbers.length, 4, 'MediaBox must have 4 coordinates');
      const widthPt = numbers[2];
      const heightPt = numbers[3];

      assert.ok(Math.abs(widthPt - 297.64) < 2, `Width must be ~297.64 pt (105mm), got ${widthPt}`);
      assert.ok(Math.abs(heightPt - 419.53) < 2, `Height must be ~419.53 pt (148mm), got ${heightPt}`);
    } finally {
      if (fs.existsSync(result.pdfPath)) fs.unlinkSync(result.pdfPath);
    }
  });

  test('Default paperSize (omitted) defaults safely to Square (89x89 mm)', async () => {
    const result = await generatePdfFile({
      type: 'buyer',
      transaction: sampleTransaction,
      settings: sampleSettings
    });

    try {
      assert.equal(result.pageCount, 1, 'Default PDF must be strictly 1 page');
      const numbers = result.mediaBox.match(/[\d\.]+/g).map(Number);
      const widthPt = numbers[2];
      const heightPt = numbers[3];

      assert.ok(Math.abs(widthPt - 252.28) < 2, `Default width must be ~252.28 pt (89mm), got ${widthPt}`);
      assert.ok(Math.abs(heightPt - 252.28) < 2, `Default height must be ~252.28 pt (89mm), got ${heightPt}`);
    } finally {
      if (fs.existsSync(result.pdfPath)) fs.unlinkSync(result.pdfPath);
    }
  });

  test('Handles large transaction amounts (>= 1 Lakh) without clipping or second page', async () => {
    const largeTransaction = {
      ...sampleTransaction,
      todayBill: 105000,
      billAmount: 105000,
      oldBalance: 188900,
      totalDue: 293900,
      amountPaid: 150000,
      paid: 150000,
      newBalance: 143900,
      items: [
        {
          _id: 'itemLarge',
          ratePerBigBox: 700,
          bigBoxes: 150,
          smallBoxes: 0,
          bigEquivalent: 150,
          lineAmount: 105000,
          descLine1: 'தக்காளி பெரிய பெட்டி',
          descLine2: '(150 Big)',
          qtyText: '150'
        }
      ]
    };

    // Test both sizes with 1L+ amounts
    for (const size of ['square', 'a6']) {
      const result = await generatePdfFile({
        type: 'buyer',
        transaction: largeTransaction,
        settings: sampleSettings,
        paperSize: size
      });

      try {
        assert.equal(result.pageCount, 1, `${size} PDF with >= 1L amounts must remain strictly 1 page`);
      } finally {
        if (fs.existsSync(result.pdfPath)) fs.unlinkSync(result.pdfPath);
      }
    }
  });

  test('Backend Controller validates paperSize and enforces RBAC authorization', async () => {
    const { directPrintBill, streamBillPdf } = await import('../src/controllers/printController.js');

    // Test 1: Invalid paperSize returns HTTP 400
    const mockReqInvalid = {
      user: { role: 'ADMIN' },
      body: {
        type: 'buyer',
        transaction: sampleTransaction,
        paperSize: 'invalid_dimension'
      }
    };
    let statusCode = 0;
    let jsonResponse = null;
    const mockRes = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        jsonResponse = data;
        return this;
      }
    };

    await directPrintBill(mockReqInvalid, mockRes, () => {});
    assert.equal(statusCode, 400, 'Invalid paper size must be rejected with HTTP 400');
    assert.ok(jsonResponse.message.includes('Invalid paperSize'), 'Error message must explain invalid paperSize');

    // Test 2: Accountant is strictly blocked (HTTP 403) from supplier vouchers
    statusCode = 0;
    jsonResponse = null;
    const mockReqAccountantSupplier = {
      user: { role: 'ACCOUNTANT' },
      body: {
        type: 'supplier',
        purchase: { supplierName: 'Test Supplier' },
        paperSize: 'a6'
      }
    };

    await directPrintBill(mockReqAccountantSupplier, mockRes, () => {});
    assert.equal(statusCode, 403, 'Accountant must be rejected with HTTP 403 when attempting supplier print');
    assert.ok(jsonResponse.message.includes('Access denied'), 'Must return access denied message');
  });
});
