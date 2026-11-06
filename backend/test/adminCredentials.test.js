import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';

import { connectDB } from '../src/config/db.js';
import User from '../src/models/User.js';
import { app } from '../src/server.js';

test('Admin Credential Management Security Suite', async (t) => {
  await connectDB();

  const timestamp = Date.now();
  const originalAdminUser = `test_admin_cred_${timestamp}`;
  const initialPassword = 'OldAdminPassword123!';
  const updatedAdminUser = `test_admin_new_${timestamp}`;
  const newPassword = 'BrandNewPassword456!';

  const accountantUser = `test_acc_cred_${timestamp}`;
  const accountantPassword = 'AccountantPass123!';

  // Create test Admin and Accountant
  const testAdmin = await User.create({
    username: originalAdminUser,
    password: initialPassword,
    name: 'Credential Test Admin',
    role: 'ADMIN',
    active: true
  });

  const testAccountant = await User.create({
    username: accountantUser,
    password: accountantPassword,
    name: 'Credential Test Accountant',
    role: 'ACCOUNTANT',
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
    await User.deleteMany({
      username: { $in: [originalAdminUser, updatedAdminUser, accountantUser] }
    });
    await new Promise((resolve) => server.close(resolve));
  });

  await t.test('1. Setup: Login Admin and Accountant', async () => {
    const adminLogin = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: { username: originalAdminUser, password: initialPassword }
    });
    assert.equal(adminLogin.status, 200);
    adminToken = adminLogin.data.token;
    assert.ok(adminToken);

    const accLogin = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: { username: accountantUser, password: accountantPassword }
    });
    assert.equal(accLogin.status, 200);
    accountantToken = accLogin.data.token;
    assert.ok(accountantToken);
  });

  await t.test('2. Validation: Rejects wrong current password', async () => {
    const res = await apiRequest('/api/auth/change-credentials', {
      method: 'PUT',
      token: adminToken,
      body: {
        currentPassword: 'WrongPassword!',
        newPassword: 'SomeNewPassword123!',
        confirmPassword: 'SomeNewPassword123!'
      }
    });
    assert.equal(res.status, 400);
    assert.equal(res.data.success, false);
    assert.match(res.data.message, /incorrect current password/i);
  });

  await t.test('3. Validation: Rejects password confirmation mismatch', async () => {
    const res = await apiRequest('/api/auth/change-credentials', {
      method: 'PUT',
      token: adminToken,
      body: {
        currentPassword: initialPassword,
        newPassword: 'NewPassword123!',
        confirmPassword: 'MismatchPassword999!'
      }
    });
    assert.equal(res.status, 400);
    assert.equal(res.data.success, false);
    assert.match(res.data.message, /not match/i);
  });

  await t.test('4. Validation: Rejects duplicate username', async () => {
    // Attempt to take existing accountant's username
    const res = await apiRequest('/api/auth/change-credentials', {
      method: 'PUT',
      token: adminToken,
      body: {
        username: accountantUser,
        currentPassword: initialPassword
      }
    });
    assert.equal(res.status, 400);
    assert.equal(res.data.success, false);
    assert.match(res.data.message, /already in use/i);
  });

  await t.test('5. RBAC Protection: Accountant is Strictly Forbidden (HTTP 403)', async () => {
    const res = await apiRequest('/api/auth/change-credentials', {
      method: 'PUT',
      token: accountantToken,
      body: {
        currentPassword: accountantPassword,
        newPassword: 'AccountantNewPassword123!',
        confirmPassword: 'AccountantNewPassword123!'
      }
    });
    assert.equal(res.status, 403);
    assert.equal(res.data.success, false);
  });

  await t.test('6. Unauthenticated requests are rejected with HTTP 401', async () => {
    const res = await apiRequest('/api/auth/change-credentials', {
      method: 'PUT',
      body: {
        currentPassword: initialPassword,
        newPassword: newPassword,
        confirmPassword: newPassword
      }
    });
    assert.equal(res.status, 401);
  });

  await t.test('7. Successful Admin Credential Update (Username + Password)', async () => {
    const res = await apiRequest('/api/auth/change-credentials', {
      method: 'PUT',
      token: adminToken,
      body: {
        username: updatedAdminUser,
        currentPassword: initialPassword,
        newPassword: newPassword,
        confirmPassword: newPassword
      }
    });
    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.user.username, updatedAdminUser);
    assert.ok(res.data.token);
    // Ensure password or hash is never returned
    assert.equal(res.data.user.password, undefined);

    // Verify token carries new username
    const meRes = await apiRequest('/api/auth/me', {
      token: res.data.token
    });
    assert.equal(meRes.status, 200);
    assert.equal(meRes.data.user.username, updatedAdminUser);
    assert.equal(meRes.data.user.role, 'ADMIN');
  });

  await t.test('8. Verification: Old credentials fail, New credentials succeed', async () => {
    // Old password fails
    const oldLogin = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: { username: updatedAdminUser, password: initialPassword }
    });
    assert.equal(oldLogin.status, 401);

    // Old username fails
    const oldUserLogin = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: { username: originalAdminUser, password: newPassword }
    });
    assert.equal(oldUserLogin.status, 401);

    // New username + new password succeeds
    const newLogin = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: { username: updatedAdminUser, password: newPassword }
    });
    assert.equal(newLogin.status, 200);
    assert.equal(newLogin.data.success, true);
    assert.equal(newLogin.data.user.username, updatedAdminUser);
    assert.equal(newLogin.data.user.role, 'ADMIN');
  });
});
