import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import http from 'http';

import { connectDB } from '../src/config/db.js';
import User from '../src/models/User.js';
import Supplier from '../src/models/Supplier.js';
import Purchase from '../src/models/Purchase.js';
import Outlay from '../src/models/Outlay.js';
import { app } from '../src/server.js';
import { getConsolidatedSupplierBill } from '../src/services/supplierBillService.js';

test('Feature 1 & Feature 2: Outlay Management & Supplier Notes Suite', async (t) => {
  await connectDB();

  // Create test Admin and Accountant
  const timestamp = Date.now();
  const adminUsername = `test_outlay_admin_${timestamp}`;
  const accountantUsername = `test_outlay_accountant_${timestamp}`;

  const testAdmin = await User.create({
    username: adminUsername,
    password: 'Password123!',
    name: 'Outlay Test Admin',
    role: 'ADMIN',
    active: true
  });

  const testAccountant = await User.create({
    username: accountantUsername,
    password: 'Password123!',
    name: 'Outlay Test Accountant',
    role: 'ACCOUNTANT',
    active: true
  });

  // Create a test supplier
  const testSupplier = await Supplier.create({
    name: `Test Outlay Farmer ${timestamp}`,
    phone: '9876543210',
    address: 'Dindigul Market',
    notes: 'Primary tomato grower',
    active: true
  });

  // Start test server
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  let adminToken = '';
  let accountantToken = '';

  const apiRequest = async (path, options = {}) => {
    const url = `${baseUrl}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers || {})
    };

    const res = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    let data;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    return { status: res.status, data };
  };

  t.after(async () => {
    // Clean up created test entities
    await User.deleteMany({ username: { $in: [adminUsername, accountantUsername] } });
    await Supplier.deleteOne({ _id: testSupplier._id });
    await Purchase.deleteMany({ supplierId: testSupplier._id });
    await Outlay.deleteMany({
      $or: [{ supplierId: testSupplier._id }, { createdBy: testAdmin._id }]
    });
    await new Promise((resolve) => server.close(resolve));
  });

  await t.test('1. Authentication Setup: Login Admin & Accountant', async () => {
    const adminLogin = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: { username: adminUsername, password: 'Password123!' }
    });
    assert.equal(adminLogin.status, 200);
    adminToken = adminLogin.data.token;
    assert.ok(adminToken);

    const accountantLogin = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: { username: accountantUsername, password: 'Password123!' }
    });
    assert.equal(accountantLogin.status, 200);
    accountantToken = accountantLogin.data.token;
    assert.ok(accountantToken);
  });

  let simpleDate = '2026-11-07';
  let createdEntryId = '';

  await t.test('2. Simplified Outlay Entry (Description, Amount, Date only)', async () => {
    // 2.1 Vehicle rent — ₹2,500
    const entry1 = await apiRequest('/api/outlay', {
      method: 'POST',
      token: adminToken,
      body: {
        transactionDate: simpleDate,
        description: 'Vehicle rent',
        amount: 2500
      }
    });
    assert.equal(entry1.status, 201);
    assert.equal(entry1.data.success, true);
    assert.equal(entry1.data.outlay.description, 'Vehicle rent');
    assert.equal(entry1.data.outlay.amount, 2500);
    createdEntryId = entry1.data.outlay._id;

    // 2.2 Salary — ₹1,000
    const entry2 = await apiRequest('/api/outlay', {
      method: 'POST',
      token: adminToken,
      body: {
        transactionDate: simpleDate,
        description: 'Salary',
        amount: 1000
      }
    });
    assert.equal(entry2.status, 201);
    assert.equal(entry2.data.outlay.amount, 1000);

    // 2.3 Gave to supplier — ₹5,000
    const entry3 = await apiRequest('/api/outlay', {
      method: 'POST',
      token: adminToken,
      body: {
        transactionDate: simpleDate,
        description: 'Gave to supplier',
        amount: 5000
      }
    });
    assert.equal(entry3.status, 201);
    assert.equal(entry3.data.outlay.amount, 5000);

    // 2.4 Verify Daily Total: exactly ₹8,500
    const listRes = await apiRequest(`/api/outlay?date=${simpleDate}`, {
      method: 'GET',
      token: adminToken
    });
    assert.equal(listRes.status, 200);
    assert.equal(listRes.data.outlays.length, 3);
    assert.equal(listRes.data.totals.totalOutlay, 8500);
  });

  await t.test('3. Amount and Description Validations', async () => {
    // Invalid amount: zero
    const zeroRes = await apiRequest('/api/outlay', {
      method: 'POST',
      token: adminToken,
      body: {
        transactionDate: simpleDate,
        description: 'Loading charges',
        amount: 0
      }
    });
    assert.equal(zeroRes.status, 400);

    // Invalid amount: negative
    const negRes = await apiRequest('/api/outlay', {
      method: 'POST',
      token: adminToken,
      body: {
        transactionDate: simpleDate,
        description: 'Loading charges',
        amount: -100
      }
    });
    assert.equal(negRes.status, 400);

    // Missing description
    const noDescRes = await apiRequest('/api/outlay', {
      method: 'POST',
      token: adminToken,
      body: {
        transactionDate: simpleDate,
        description: '',
        amount: 500
      }
    });
    assert.equal(noDescRes.status, 400);
  });

  await t.test('4. Edit Outlay Entry', async () => {
    const editRes = await apiRequest(`/api/outlay/${createdEntryId}`, {
      method: 'PUT',
      token: adminToken,
      body: {
        description: 'Vehicle rent (revised)',
        amount: 2700
      }
    });
    assert.equal(editRes.status, 200);
    assert.equal(editRes.data.outlay.description, 'Vehicle rent (revised)');
    assert.equal(editRes.data.outlay.amount, 2700);

    // Total should now be 2700 + 1000 + 5000 = 8700
    const listRes = await apiRequest(`/api/outlay?date=${simpleDate}`, {
      method: 'GET',
      token: adminToken
    });
    assert.equal(listRes.data.totals.totalOutlay, 8700);
  });

  await t.test('5. Delete / Void Outlay Entry', async () => {
    const deleteRes = await apiRequest(`/api/outlay/${createdEntryId}`, {
      method: 'DELETE',
      token: adminToken
    });
    assert.equal(deleteRes.status, 200);

    // Total should now exclude the deleted entry: 1000 + 5000 = 6000
    const listRes = await apiRequest(`/api/outlay?date=${simpleDate}`, {
      method: 'GET',
      token: adminToken
    });
    assert.equal(listRes.data.outlays.length, 2);
    assert.equal(listRes.data.totals.totalOutlay, 6000);
  });

  await t.test('6. Date Isolation: entries do not leak into another date', async () => {
    const anotherDateRes = await apiRequest('/api/outlay?date=2026-11-01', {
      method: 'GET',
      token: adminToken
    });
    assert.equal(anotherDateRes.status, 200);
    assert.equal(anotherDateRes.data.outlays.length, 0);
    assert.equal(anotherDateRes.data.totals.totalOutlay, 0);
  });

  await t.test('7. RBAC Security: Accountant is Strictly Blocked (HTTP 403)', async () => {
    // GET /api/outlay
    const accGet = await apiRequest('/api/outlay', {
      method: 'GET',
      token: accountantToken
    });
    assert.equal(accGet.status, 403);

    // POST /api/outlay
    const accPost = await apiRequest('/api/outlay', {
      method: 'POST',
      token: accountantToken,
      body: {
        transactionDate: simpleDate,
        description: 'Salary',
        amount: 1000
      }
    });
    assert.equal(accPost.status, 403);

    // PUT /api/outlay/:id
    const accPut = await apiRequest(`/api/outlay/${createdEntryId}`, {
      method: 'PUT',
      token: accountantToken,
      body: { amount: 20000 }
    });
    assert.equal(accPut.status, 403);

    // DELETE /api/outlay/:id
    const accDelete = await apiRequest(`/api/outlay/${createdEntryId}`, {
      method: 'DELETE',
      token: accountantToken
    });
    assert.equal(accDelete.status, 403);
  });

  await t.test('8. Feature 2: Supplier Notes Persistence & Editing', async () => {
    // 8.1 Create Purchase with Notes
    const createPurRes = await apiRequest('/api/purchases', {
      method: 'POST',
      token: adminToken,
      body: {
        supplierId: testSupplier._id,
        transactionDate: '2026-11-06',
        bigBoxes: 10,
        smallBoxes: 0,
        ratePerBigBox: 750,
        notes: 'Morning lot — Grade A Dindigul Tomatoes'
      }
    });
    assert.equal(createPurRes.status, 201);
    assert.equal(createPurRes.data.purchase.notes, 'Morning lot — Grade A Dindigul Tomatoes');
    const purchaseId = createPurRes.data.purchase._id;

    // 8.2 Edit Purchase Notes via PUT /api/purchases/:id
    const updatePurRes = await apiRequest(`/api/purchases/${purchaseId}`, {
      method: 'PUT',
      token: adminToken,
      body: {
        notes: 'Morning lot — Grade A (Truck TN-57-9999)'
      }
    });
    assert.equal(updatePurRes.status, 200);
    assert.equal(updatePurRes.data.purchase.notes, 'Morning lot — Grade A (Truck TN-57-9999)');

    // 8.3 Verify Consolidated Supplier Bill retrieves the note
    const consolidatedBill = await getConsolidatedSupplierBill({
      supplierId: testSupplier._id,
      transactionDate: '2026-11-06'
    });
    assert.ok(consolidatedBill);
    assert.equal(consolidatedBill.items[0].notes, 'Morning lot — Grade A (Truck TN-57-9999)');
  });
});
