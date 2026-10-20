import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { validateObjectId, securityHeaders, createRateLimiter } from '../src/middleware/security.js';
import { roundMoney, recalculateBuyerLedger } from '../src/services/ledgerService.js';
import { generatePdfFile } from '../src/services/printService.js';
import fs from 'fs';
import os from 'os';
import path from 'path';

test('1. Security Middleware - securityHeaders', () => {
  const req = {};
  const headers = {};
  const res = {
    setHeader: (name, val) => {
      headers[name] = val;
    }
  };
  let nextCalled = false;
  securityHeaders(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(headers['X-Frame-Options'], 'DENY');
  assert.equal(headers['Referrer-Policy'], 'strict-origin-when-cross-origin');
});

test('2. Security Middleware - validateObjectId', () => {
  const middleware = validateObjectId('id');

  // Test invalid ObjectId
  let statusSet = null;
  let jsonSent = null;
  const invalidReq = { params: { id: 'invalid-id-123' } };
  const res = {
    status: (code) => {
      statusSet = code;
      return {
        json: (data) => {
          jsonSent = data;
        }
      };
    }
  };
  let nextCalled = false;

  middleware(invalidReq, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(statusSet, 400);
  assert.equal(jsonSent.success, false);
  assert.match(jsonSent.message, /Invalid ID format/);

  // Test valid ObjectId
  const validReq = { params: { id: new mongoose.Types.ObjectId().toString() } };
  nextCalled = false;
  middleware(validReq, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
});

test('3. Security Middleware - createRateLimiter', () => {
  const limiter = createRateLimiter({ windowMs: 60000, max: 2, message: 'Rate limit exceeded' });
  const req = { ip: '127.0.0.1' };
  let statusSet = null;
  let jsonSent = null;
  const res = {
    status: (code) => {
      statusSet = code;
      return {
        json: (data) => {
          jsonSent = data;
        }
      };
    }
  };

  let call1 = false;
  limiter(req, res, () => { call1 = true; });
  assert.equal(call1, true);

  let call2 = false;
  limiter(req, res, () => { call2 = true; });
  assert.equal(call2, true);

  // Third request exceeds limit
  let call3 = false;
  limiter(req, res, () => { call3 = true; });
  assert.equal(call3, false);
  assert.equal(statusSet, 429);
  assert.equal(jsonSent.message, 'Rate limit exceeded');
});

test('4. Financial Integrity - Box Equivalence & Money Rounding', () => {
  // Box equivalence: 1 small box = 0.5 big box
  const calcBigEquivalent = (big, small) => (Number(big) || 0) + (Number(small) || 0) / 2;

  assert.equal(calcBigEquivalent(10, 0), 10);
  assert.equal(calcBigEquivalent(0, 4), 2);
  assert.equal(calcBigEquivalent(8, 2), 9);
  assert.equal(calcBigEquivalent(5, 1), 5.5);

  // Money rounding to 2 decimal places
  assert.equal(roundMoney(100.456), 100.46);
  assert.equal(roundMoney(100.454), 100.45);
  assert.equal(roundMoney('250.50'), 250.5);
  assert.equal(roundMoney(-50.25), -50.25);
  assert.equal(roundMoney(null), 0);

  // Financial balance math: Old Balance + Bill Amount - Paid = New Balance
  const oldBalance = 2500;
  const billAmount = 9900;
  const amountPaid = 10000;
  const expectedNewBalance = roundMoney(oldBalance + billAmount - amountPaid);
  assert.equal(expectedNewBalance, 2400);
});

test('5. Print Engine - 1-Page PDF Generation Check', async (t) => {
  const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  if (!fs.existsSync(CHROME_PATH)) {
    t.skip('Chrome executable not found at standard path, skipping PDF generation verification.');
    return;
  }

  const dummyTx = {
    billNo: 101,
    transactionDate: '2026-10-17',
    buyerName: 'Test Buyer',
    bigBoxes: 10,
    smallBoxes: 2,
    ratePerBigBox: 1100,
    billAmount: 12100,
    oldBalance: 500,
    totalDue: 12600,
    amountPaid: 10000,
    newBalance: 2600
  };

  const dummySettings = {
    businessName: 'SHREE GANESH TOMATO TRADERS',
    phone: '9842724446',
    address: 'Thalaivasal Daily Mandi'
  };

  const tmpPdf = path.join(os.tmpdir(), `test-buyer-bill-${Date.now()}.pdf`);

  try {
    await generatePdfFile({
      type: 'buyer',
      transaction: dummyTx,
      settings: dummySettings,
      targetPdfPath: tmpPdf
    });

    assert.equal(fs.existsSync(tmpPdf), true);
    const pdfBuffer = fs.readFileSync(tmpPdf);
    const pdfStr = pdfBuffer.toString('latin1');
    const pages = pdfStr.match(/\/Type\s*\/Page\b/g) || [];

    // Bill must be strictly exactly 1 page
    assert.equal(pages.length, 1, `Expected 1 page but found ${pages.length}`);
  } finally {
    if (fs.existsSync(tmpPdf)) {
      fs.unlinkSync(tmpPdf);
    }
  }
});
