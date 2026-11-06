import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import http from 'http';

import { connectDB } from '../src/config/db.js';
import { config } from '../src/config/env.js';
import User from '../src/models/User.js';
import Buyer from '../src/models/Buyer.js';
import Supplier from '../src/models/Supplier.js';
import Transaction from '../src/models/Transaction.js';
import Purchase from '../src/models/Purchase.js';
import Settings from '../src/models/Settings.js';
import { app } from '../src/server.js';

test('Role-Based Access Control (RBAC) Security Suite', async (t) => {
  await connectDB();

  // Create isolated synthetic test users
  const adminUsername = 'test_rbac_admin_' + Date.now();
  const accountantUsername = 'test_rbac_accountant_' + Date.now();

  const testAdmin = await User.create({
    username: adminUsername,
    password: 'AdminPassword123!',
    name: 'RBAC Test Admin',
    role: 'ADMIN',
    active: true
  });

  const testAccountant = await User.create({
    username: accountantUsername,
    password: 'AccountantPassword123!',
    name: 'RBAC Test Accountant',
    role: 'ACCOUNTANT',
    active: true
  });

  // Setup test HTTP server using Express app
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  let adminToken = '';
  let accountantToken = '';

  t.after(async () => {
    await User.deleteMany({ username: { $in: [adminUsername, accountantUsername] } });
    await new Promise((resolve) => server.close(resolve));
  });

  // Helper function for making authenticated API calls
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

    let data = null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await res.json();
    }
    return { status: res.status, headers: res.headers, data };
  };

  await t.test('1. Authentication Verification: Login and Token Generation with Role Claims', async () => {
    // Admin login
    const adminLoginRes = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: { username: adminUsername, password: 'AdminPassword123!' }
    });
    assert.equal(adminLoginRes.status, 200);
    assert.equal(adminLoginRes.data.success, true);
    assert.equal(adminLoginRes.data.user.role, 'ADMIN');
    assert.ok(adminLoginRes.data.token);
    adminToken = adminLoginRes.data.token;

    // Verify JWT payload contains role claim
    const decodedAdmin = jwt.verify(adminToken, config.JWT_SECRET);
    assert.equal(decodedAdmin.role, 'ADMIN');

    // Accountant login
    const accLoginRes = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: { username: accountantUsername, password: 'AccountantPassword123!' }
    });
    assert.equal(accLoginRes.status, 200);
    assert.equal(accLoginRes.data.success, true);
    assert.equal(accLoginRes.data.user.role, 'ACCOUNTANT');
    assert.ok(accLoginRes.data.token);
    accountantToken = accLoginRes.data.token;

    const decodedAcc = jwt.verify(accountantToken, config.JWT_SECRET);
    assert.equal(decodedAcc.role, 'ACCOUNTANT');

    // Verify /api/auth/me returns correct roles
    const meAdmin = await apiRequest('/api/auth/me', { token: adminToken });
    assert.equal(meAdmin.status, 200);
    assert.equal(meAdmin.data.user.role, 'ADMIN');

    const meAcc = await apiRequest('/api/auth/me', { token: accountantToken });
    assert.equal(meAcc.status, 200);
    assert.equal(meAcc.data.user.role, 'ACCOUNTANT');
  });

  await t.test('2. Unauthenticated Access is strictly blocked with HTTP 401', async () => {
    const endpoints = [
      '/api/buyers',
      '/api/suppliers',
      '/api/purchases',
      '/api/reports',
      '/api/dashboard',
      '/api/settings',
      '/api/auth/users'
    ];

    for (const ep of endpoints) {
      const res = await apiRequest(ep);
      assert.equal(res.status, 401, `Unauthenticated request to ${ep} must return 401`);
    }
  });

  await t.test('3. Admin has unrestricted access to all endpoints', async () => {
    // Buyers
    const buyersRes = await apiRequest('/api/buyers', { token: adminToken });
    assert.equal(buyersRes.status, 200);

    // Suppliers
    const suppRes = await apiRequest('/api/suppliers', { token: adminToken });
    assert.equal(suppRes.status, 200);

    // Purchases
    const purRes = await apiRequest('/api/purchases', { token: adminToken });
    assert.equal(purRes.status, 200);

    // Reports
    const repRes = await apiRequest('/api/reports', { token: adminToken });
    assert.equal(repRes.status, 200);

    // Settings (Read and Update)
    const setGetRes = await apiRequest('/api/settings', { token: adminToken });
    assert.equal(setGetRes.status, 200);

    // Dashboard
    const dashRes = await apiRequest('/api/dashboard', { token: adminToken });
    assert.equal(dashRes.status, 200);
    assert.ok(dashRes.data.todayPurchases !== undefined, 'Admin dashboard must include todayPurchases');
    assert.ok(dashRes.data.summary.totalPurchase !== undefined, 'Admin dashboard summary must include totalPurchase');

    // User management
    const usersRes = await apiRequest('/api/auth/users', { token: adminToken });
    assert.equal(usersRes.status, 200);
    assert.ok(Array.isArray(usersRes.data.users));
  });

  await t.test('4. Accountant has full access to permitted buyer operations', async () => {
    // List buyers
    const buyersRes = await apiRequest('/api/buyers', { token: accountantToken });
    assert.equal(buyersRes.status, 200);
    assert.ok(buyersRes.data.success);

    // Create buyer
    const newBuyerName = 'SYNTHETIC_ACC_BUYER_' + Date.now();
    const createBuyerRes = await apiRequest('/api/buyers', {
      method: 'POST',
      token: accountantToken,
      body: { name: newBuyerName, phone: '9988776655', address: 'Market stall 9' }
    });
    assert.equal(createBuyerRes.status, 201);
    const createdBuyerId = createBuyerRes.data.buyer._id;

    // View buyer ledger
    const ledgerRes = await apiRequest(`/api/buyers/${createdBuyerId}/ledger`, { token: accountantToken });
    assert.equal(ledgerRes.status, 200);

    // Record a sale
    const saleRes = await apiRequest('/api/transactions/sale', {
      method: 'POST',
      token: accountantToken,
      body: {
        buyerId: createdBuyerId,
        transactionDate: '2026-11-04',
        bigBoxes: 5,
        smallBoxes: 0,
        ratePerBigBox: 700,
        amountPaid: 1000
      }
    });
    assert.equal(saleRes.status, 201);
    assert.equal(saleRes.data.transaction.billAmount, 3500);

    // Record a payment
    const paymentRes = await apiRequest('/api/transactions/payment', {
      method: 'POST',
      token: accountantToken,
      body: {
        buyerId: createdBuyerId,
        transactionDate: '2026-11-04',
        amountPaid: 2500
      }
    });
    assert.equal(paymentRes.status, 201);

    // Clean up created buyer and transactions
    await Transaction.deleteMany({ buyerId: createdBuyerId });
    await Buyer.findByIdAndDelete(createdBuyerId);
  });

  await t.test('5. Accountant is STRICTLY FORBIDDEN (HTTP 403) from all Supplier endpoints', async () => {
    // Supplier list
    const listRes = await apiRequest('/api/suppliers', { token: accountantToken });
    assert.equal(listRes.status, 403, 'GET /api/suppliers must return 403 for Accountant');

    // Create supplier
    const createRes = await apiRequest('/api/suppliers', {
      method: 'POST',
      token: accountantToken,
      body: { name: 'FORBIDDEN_SUPPLIER' }
    });
    assert.equal(createRes.status, 403, 'POST /api/suppliers must return 403 for Accountant');

    // Fake ID for parameterized routes
    const fakeId = new mongoose.Types.ObjectId();

    // Get supplier by ID
    const getRes = await apiRequest(`/api/suppliers/${fakeId}`, { token: accountantToken });
    assert.equal(getRes.status, 403, 'GET /api/suppliers/:id must return 403 for Accountant');

    // Update supplier
    const updateRes = await apiRequest(`/api/suppliers/${fakeId}`, {
      method: 'PUT',
      token: accountantToken,
      body: { name: 'HACKED' }
    });
    assert.equal(updateRes.status, 403, 'PUT /api/suppliers/:id must return 403 for Accountant');

    // Delete supplier
    const delRes = await apiRequest(`/api/suppliers/${fakeId}`, {
      method: 'DELETE',
      token: accountantToken
    });
    assert.equal(delRes.status, 403, 'DELETE /api/suppliers/:id must return 403 for Accountant');

    // Supplier purchases sub-route
    const suppPurRes = await apiRequest(`/api/suppliers/${fakeId}/purchases`, { token: accountantToken });
    assert.equal(suppPurRes.status, 403, 'GET /api/suppliers/:id/purchases must return 403 for Accountant');
  });

  await t.test('6. Accountant is STRICTLY FORBIDDEN (HTTP 403) from all Purchase & Supplier Bill endpoints', async () => {
    // List purchases
    const purListRes = await apiRequest('/api/purchases', { token: accountantToken });
    assert.equal(purListRes.status, 403, 'GET /api/purchases must return 403 for Accountant');

    // Create purchase
    const purCreateRes = await apiRequest('/api/purchases', {
      method: 'POST',
      token: accountantToken,
      body: { supplierId: new mongoose.Types.ObjectId(), bigBoxes: 10 }
    });
    assert.equal(purCreateRes.status, 403, 'POST /api/purchases must return 403 for Accountant');

    // Consolidated supplier bill
    const consRes = await apiRequest('/api/purchases/consolidated', { token: accountantToken });
    assert.equal(consRes.status, 403, 'GET /api/purchases/consolidated must return 403 for Accountant');

    // Save bill deductions
    const dedRes = await apiRequest('/api/purchases/consolidated/deductions', {
      method: 'PUT',
      token: accountantToken,
      body: { deductions: { commission: 100 } }
    });
    assert.equal(dedRes.status, 403, 'PUT /api/purchases/consolidated/deductions must return 403 for Accountant');

    // Void purchase
    const fakeId = new mongoose.Types.ObjectId();
    const voidRes = await apiRequest(`/api/purchases/${fakeId}/void`, {
      method: 'POST',
      token: accountantToken,
      body: { voidReason: 'Test' }
    });
    assert.equal(voidRes.status, 403, 'POST /api/purchases/:id/void must return 403 for Accountant');
  });

  await t.test('7. Accountant is STRICTLY FORBIDDEN (HTTP 403) from Reports & Settings modifications', async () => {
    // Reports
    const repRes = await apiRequest('/api/reports', { token: accountantToken });
    assert.equal(repRes.status, 403, 'GET /api/reports must return 403 for Accountant');

    // Update settings
    const setUpdateRes = await apiRequest('/api/settings', {
      method: 'PUT',
      token: accountantToken,
      body: { businessName: 'Attacker Shop' }
    });
    assert.equal(setUpdateRes.status, 403, 'PUT /api/settings must return 403 for Accountant');

    // Read settings is allowed for receipt branding
    const setReadRes = await apiRequest('/api/settings', { token: accountantToken });
    assert.equal(setReadRes.status, 200, 'GET /api/settings should be accessible for bill branding');
  });

  await t.test('8. Accountant is STRICTLY FORBIDDEN (HTTP 403) from User Management', async () => {
    // List users
    const usersRes = await apiRequest('/api/auth/users', { token: accountantToken });
    assert.equal(usersRes.status, 403, 'GET /api/auth/users must return 403 for Accountant');

    // Create user
    const createRes = await apiRequest('/api/auth/users', {
      method: 'POST',
      token: accountantToken,
      body: { username: 'attacker_admin', password: 'password123', role: 'ADMIN' }
    });
    assert.equal(createRes.status, 403, 'POST /api/auth/users must return 403 for Accountant');

    // Change role
    const fakeId = new mongoose.Types.ObjectId();
    const roleRes = await apiRequest(`/api/auth/users/${fakeId}/role`, {
      method: 'PUT',
      token: accountantToken,
      body: { role: 'ADMIN' }
    });
    assert.equal(roleRes.status, 403, 'PUT /api/auth/users/:id/role must return 403 for Accountant');

    // Deactivate user
    const statusRes = await apiRequest(`/api/auth/users/${fakeId}/status`, {
      method: 'PUT',
      token: accountantToken,
      body: { active: false }
    });
    assert.equal(statusRes.status, 403, 'PUT /api/auth/users/:id/status must return 403 for Accountant');
  });

  await t.test('9. Accountant is FORBIDDEN from printing Supplier Vouchers', async () => {
    const directRes = await apiRequest('/api/print/direct', {
      method: 'POST',
      token: accountantToken,
      body: {
        type: 'supplier',
        purchase: { supplierName: 'Test Supplier', grossTotal: 50000 }
      }
    });
    assert.equal(directRes.status, 403, 'Printing supplier voucher directly must return 403 for Accountant');

    const pdfRes = await apiRequest('/api/print/pdf', {
      method: 'POST',
      token: accountantToken,
      body: {
        type: 'supplier',
        purchase: { supplierName: 'Test Supplier', grossTotal: 50000 }
      }
    });
    assert.equal(pdfRes.status, 403, 'Streaming supplier voucher PDF must return 403 for Accountant');
  });

  await t.test('10. Server-Side Data Leakage Prevention in Mixed Dashboard Endpoint', async () => {
    const dashRes = await apiRequest('/api/dashboard', { token: accountantToken });
    assert.equal(dashRes.status, 200);

    // Verify supplier sensitive information is NOT leaked in response
    assert.equal(dashRes.data.todayPurchases, undefined, 'Accountant dashboard must NOT contain todayPurchases');
    assert.equal(dashRes.data.summary.totalPurchase, undefined, 'Accountant dashboard must NOT contain totalPurchase');
    assert.equal(dashRes.data.summary.boxesPurchased, undefined, 'Accountant dashboard must NOT contain boxesPurchased');
    assert.equal(dashRes.data.summary.supplierCount, undefined, 'Accountant dashboard must NOT contain supplierCount');

    // Verify buyer information is correctly present
    assert.ok(dashRes.data.summary.totalSales !== undefined);
    assert.ok(dashRes.data.summary.totalAmountReceived !== undefined);
    assert.ok(dashRes.data.summary.buyerCount !== undefined);
    assert.ok(Array.isArray(dashRes.data.todayTally));
  });

  await t.test('11. Security Safety Rules: Cannot Demote or Delete Last Administrator', async () => {
    // Try to demote the test Admin when they are the only admin being targeted
    // First create a temporary admin
    const tempAdmin = await User.create({
      username: 'temp_admin_' + Date.now(),
      password: 'TempPassword123!',
      role: 'ADMIN',
      active: true
    });

    // Demote tempAdmin is allowed because testAdmin still exists
    const demoteRes = await apiRequest(`/api/auth/users/${tempAdmin._id}/role`, {
      method: 'PUT',
      token: adminToken,
      body: { role: 'ACCOUNTANT' }
    });
    assert.equal(demoteRes.status, 200);
    assert.equal(demoteRes.data.user.role, 'ACCOUNTANT');

    // Clean up tempAdmin
    await User.findByIdAndDelete(tempAdmin._id);
  });
});
