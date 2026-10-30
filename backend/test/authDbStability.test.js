import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { validateEnv } from '../src/config/env.js';
import { connectDB, _resetConnectionCacheForTesting } from '../src/config/db.js';
import User from '../src/models/User.js';
import Settings from '../src/models/Settings.js';
import { initializeDatabase } from '../src/server.js';

test('Database Connection & Binding Suite', async (t) => {
  t.beforeEach(() => {
    _resetConnectionCacheForTesting();
  });

  t.afterEach(() => {
    _resetConnectionCacheForTesting();
  });

  await t.test('1. connectDB explicitly targets tomato_billing via dbName option', async () => {
    const originalConnect = mongoose.connect;
    let capturedOptions = null;

    try {
      mongoose.connect = async (uri, options) => {
        capturedOptions = options;
        return mongoose.connection;
      };

      const origReadyState = mongoose.connection.readyState;
      mongoose.connection.readyState = 0;

      await connectDB();

      assert.equal(capturedOptions?.dbName, 'tomato_billing');

      mongoose.connection.readyState = origReadyState;
    } finally {
      mongoose.connect = originalConnect;
    }
  });

  await t.test('2. connectDB caches in-flight promise for concurrent callers', async () => {
    const originalConnect = mongoose.connect;
    let connectCallCount = 0;

    try {
      mongoose.connect = async () => {
        connectCallCount++;
        await new Promise((resolve) => setTimeout(resolve, 30));
        return mongoose.connection;
      };

      const origReadyState = mongoose.connection.readyState;
      mongoose.connection.readyState = 0;

      // Run multiple concurrent calls
      const [p1, p2, p3] = await Promise.all([connectDB(), connectDB(), connectDB()]);

      assert.equal(connectCallCount, 1, 'mongoose.connect should only be called once for concurrent in-flight requests');
      assert.equal(p1, p2);
      assert.equal(p2, p3);

      mongoose.connection.readyState = origReadyState;
    } finally {
      mongoose.connect = originalConnect;
    }
  });

  await t.test('3. connectDB resets cached promise on connection error allowing retries', async () => {
    const originalConnect = mongoose.connect;
    let attempt = 0;

    try {
      mongoose.connect = async () => {
        attempt++;
        if (attempt === 1) {
          throw new Error('Simulated transient network timeout');
        }
        return mongoose.connection;
      };

      const origReadyState = mongoose.connection.readyState;
      const origVercel = process.env.VERCEL;
      process.env.VERCEL = '1'; // prevent process.exit in catch
      mongoose.connection.readyState = 0;

      // Attempt 1 should fail
      await assert.rejects(async () => {
        await connectDB();
      }, /Simulated transient network timeout/);

      // Attempt 2 should retry and succeed, NOT return permanently rejected promise
      const conn = await connectDB();
      assert.equal(attempt, 2, 'Should retry connection on subsequent attempt');
      assert.equal(conn, mongoose.connection);

      if (origVercel !== undefined) {
        process.env.VERCEL = origVercel;
      } else {
        delete process.env.VERCEL;
      }
      mongoose.connection.readyState = origReadyState;
    } finally {
      mongoose.connect = originalConnect;
    }
  });
});

test('Environment Variable Validation & Safety Suite', async (t) => {
  const origEnv = { ...process.env };

  t.afterEach(() => {
    process.env = { ...origEnv };
  });

  await t.test('4. validateEnv safely sanitizes ADMIN_USERNAME when set to MongoDB URI', () => {
    process.env.NODE_ENV = 'production';
    process.env.MONGODB_URI = 'mongodb+srv://admin:pass@tomato.mongodb.net/tomato_billing';
    process.env.JWT_SECRET = 'super_secure_production_jwt_key_that_is_32_characters_long_123';
    process.env.CORS_ORIGIN = 'https://dindigultomato.vercel.app';
    process.env.ADMIN_USERNAME = 'mongodb+srv://dbuser:pass123@cluster0.mongodb.net/tomato_billing';

    const env = validateEnv({ shouldExit: false });
    assert.equal(env.ADMIN_USERNAME, 'bootto', 'Should safely fall back to default "bootto" instead of accepting URI');
  });

  await t.test('5. validateEnv accepts legitimate default username "bootto"', () => {
    process.env.NODE_ENV = 'production';
    process.env.MONGODB_URI = 'mongodb+srv://admin:pass@tomato.mongodb.net/tomato_billing';
    process.env.JWT_SECRET = 'super_secure_production_jwt_key_that_is_32_characters_long_123';
    process.env.CORS_ORIGIN = 'https://dindigultomato.vercel.app';
    process.env.ADMIN_USERNAME = 'bootto';

    const env = validateEnv({ shouldExit: false });
    assert.equal(env.ADMIN_USERNAME, 'bootto');
  });

  await t.test('6. validateEnv rejects invalid protocol in MONGODB_URI in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.MONGODB_URI = 'postgres://admin:pass@localhost:5432/tomato_billing';
    process.env.JWT_SECRET = 'super_secure_production_jwt_key_that_is_32_characters_long_123';
    process.env.CORS_ORIGIN = 'https://dindigultomato.vercel.app';

    assert.throws(
      () => validateEnv({ shouldExit: false }),
      (err) => {
        assert.match(err.message, /MONGODB_URI must start with "mongodb:\/\/" or "mongodb\+srv:\/\/"/);
        return true;
      }
    );
  });
});

test('Admin Provisioning & Account Preservation Suite', async (t) => {
  const origEnv = { ...process.env };

  t.afterEach(() => {
    process.env = { ...origEnv };
  });

  await t.test('7. initializeDatabase skips admin creation when user already exists', async () => {
    const origUserCount = User.countDocuments;
    const origUserCreate = User.create;
    const origSettingsCount = Settings.countDocuments;
    let createCalled = false;

    try {
      Settings.countDocuments = async () => 1;
      User.countDocuments = async () => 1; // existing admin exists
      User.create = async () => {
        createCalled = true;
      };

      await initializeDatabase();
      assert.equal(createCalled, false, 'User.create must never be called if an admin already exists');
    } finally {
      User.countDocuments = origUserCount;
      User.create = origUserCreate;
      Settings.countDocuments = origSettingsCount;
    }
  });

  await t.test('8. initializeDatabase safely handles duplicate key E11000 concurrency error', async () => {
    const origUserCount = User.countDocuments;
    const origUserCreate = User.create;
    const origSettingsCount = Settings.countDocuments;

    try {
      Settings.countDocuments = async () => 1;
      User.countDocuments = async () => 0;
      process.env.ADMIN_PASSWORD = 'password123';
      process.env.ADMIN_USERNAME = 'bootto';

      User.create = async () => {
        const err = new Error('E11000 duplicate key error collection: tomato_billing.users');
        err.code = 11000;
        throw err;
      };

      // Must NOT throw on E11000 duplicate key
      await assert.doesNotReject(async () => {
        await initializeDatabase();
      });
    } finally {
      User.countDocuments = origUserCount;
      User.create = origUserCreate;
      Settings.countDocuments = origSettingsCount;
    }
  });

  await t.test('9. initializeDatabase rejects URI string in ADMIN_USERNAME without creating user', async () => {
    const origUserCount = User.countDocuments;
    const origUserCreate = User.create;
    const origSettingsCount = Settings.countDocuments;
    let createCalled = false;

    try {
      Settings.countDocuments = async () => 1;
      User.countDocuments = async () => 0;
      process.env.ADMIN_PASSWORD = 'password123';
      process.env.ADMIN_USERNAME = 'mongodb+srv://user:pass@cluster.mongodb.net/tomato_billing';

      User.create = async () => {
        createCalled = true;
      };

      await initializeDatabase();
      assert.equal(createCalled, false, 'Must not create user with URI as username');
    } finally {
      User.countDocuments = origUserCount;
      User.create = origUserCreate;
      Settings.countDocuments = origSettingsCount;
    }
  });
});
