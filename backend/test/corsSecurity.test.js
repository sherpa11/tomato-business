import test from 'node:test';
import assert from 'node:assert/strict';
import { createCorsDelegate } from '../src/middleware/corsConfig.js';
import { validateEnv } from '../src/config/env.js';

test('Production CORS Security & Origin Validation Suite', async (t) => {
  await t.test('1. Allowed origin: Explicitly configured origin in production is permitted', (t, done) => {
    const corsDelegate = createCorsDelegate({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://mandi-app.vercel.app, https://admin.mandi.com'
    });

    const mockReq = {
      headers: {
        origin: 'https://mandi-app.vercel.app'
      }
    };

    corsDelegate(mockReq, (err, options) => {
      assert.equal(err, null, 'Error should be null for allowed origin');
      assert.equal(options.origin, true, 'Origin should be allowed');
      assert.equal(options.credentials, true, 'Credentials should be allowed');
      done();
    });
  });

  await t.test('2. Rejected origin: Unauthorized cross-origin in production is strictly blocked', (t, done) => {
    const corsDelegate = createCorsDelegate({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://mandi-app.vercel.app'
    });

    const mockReq = {
      headers: {
        origin: 'https://malicious-tracker.com'
      }
    };

    corsDelegate(mockReq, (err, options) => {
      assert.ok(err, 'Expected CORS error for unauthorized origin');
      assert.match(err.message, /not permitted by CORS policy/, 'Error message must state CORS rejection');
      done();
    });
  });

  await t.test('3. Rejected origin: Missing CORS_ORIGIN in production strictly blocks cross-origin requests', (t, done) => {
    const corsDelegate = createCorsDelegate({
      NODE_ENV: 'production',
      CORS_ORIGIN: '' // Empty / missing
    });

    const mockReq = {
      headers: {
        origin: 'https://any-site.com'
      }
    };

    corsDelegate(mockReq, (err, options) => {
      assert.ok(err, 'Must reject cross-origin request when CORS_ORIGIN is empty in production');
      assert.match(err.message, /not permitted by CORS policy/);
      done();
    });
  });

  await t.test('4. Missing production configuration: Startup validation fails safely when CORS_ORIGIN is absent outside Vercel', () => {
    const origEnv = { ...process.env };

    try {
      process.env.NODE_ENV = 'production';
      process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/test_prod';
      process.env.JWT_SECRET = 'super_secure_production_jwt_key_that_is_32_characters_long_123';
      delete process.env.CORS_ORIGIN;
      delete process.env.VERCEL;

      assert.throws(
        () => validateEnv({ shouldExit: false }),
        (err) => {
          assert.match(err.message, /CORS_ORIGIN is required in production/);
          return true;
        },
        'Startup validation must fail if CORS_ORIGIN is missing in production outside Vercel'
      );
    } finally {
      process.env = origEnv;
    }
  });

  await t.test('5. Missing production configuration: Startup validation rejects wildcard "*" in production', () => {
    const origEnv = { ...process.env };

    try {
      process.env.NODE_ENV = 'production';
      process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/test_prod';
      process.env.JWT_SECRET = 'super_secure_production_jwt_key_that_is_32_characters_long_123';
      process.env.CORS_ORIGIN = '*';
      delete process.env.VERCEL;

      assert.throws(
        () => validateEnv({ shouldExit: false }),
        (err) => {
          assert.match(err.message, /CORS_ORIGIN cannot be "\*"/);
          return true;
        },
        'Startup validation must reject wildcard "*" origin in production'
      );
    } finally {
      process.env = origEnv;
    }
  });

  await t.test('6. Missing production configuration: Startup validation rejects invalid protocol/URL in CORS_ORIGIN', () => {
    const origEnv = { ...process.env };

    try {
      process.env.NODE_ENV = 'production';
      process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/test_prod';
      process.env.JWT_SECRET = 'super_secure_production_jwt_key_that_is_32_characters_long_123';
      process.env.CORS_ORIGIN = 'ftp://invalid-site.com';
      delete process.env.VERCEL;

      assert.throws(
        () => validateEnv({ shouldExit: false }),
        (err) => {
          assert.match(err.message, /Allowed origins must start with http:\/\/ or https:\/\//);
          return true;
        }
      );
    } finally {
      process.env = origEnv;
    }
  });

  await t.test('7. Same-origin requests: Requests without an Origin header (curl, server-to-server, GET/HEAD) are allowed', (t, done) => {
    const corsDelegate = createCorsDelegate({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://mandi-app.vercel.app'
    });

    const mockReq = {
      headers: {} // No origin header
    };

    corsDelegate(mockReq, (err, options) => {
      assert.equal(err, null);
      assert.equal(options.origin, true);
      done();
    });
  });

  await t.test('8. Same-origin requests: Origin matching Host header is permitted', (t, done) => {
    const corsDelegate = createCorsDelegate({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://other-configured-domain.com'
    });

    const mockReq = {
      headers: {
        host: 'mandi-billing.com',
        origin: 'https://mandi-billing.com'
      }
    };

    corsDelegate(mockReq, (err, options) => {
      assert.equal(err, null);
      assert.equal(options.origin, true);
      done();
    });
  });

  await t.test('9. Same-origin requests: Origin matching X-Forwarded-Host header is permitted', (t, done) => {
    const corsDelegate = createCorsDelegate({
      NODE_ENV: 'production',
      CORS_ORIGIN: ''
    });

    const mockReq = {
      headers: {
        'x-forwarded-host': 'proxy.mandi-app.com',
        origin: 'https://proxy.mandi-app.com'
      }
    };

    corsDelegate(mockReq, (err, options) => {
      assert.equal(err, null);
      assert.equal(options.origin, true);
      done();
    });
  });

  await t.test('10. Vercel environment: Exact VERCEL_URL deployment origin is permitted', (t, done) => {
    const corsDelegate = createCorsDelegate({
      NODE_ENV: 'production',
      VERCEL: '1',
      VERCEL_URL: 'tomato-business-sherpa11.vercel.app',
      CORS_ORIGIN: ''
    });

    const mockReq = {
      headers: {
        origin: 'https://tomato-business-sherpa11.vercel.app'
      }
    };

    corsDelegate(mockReq, (err, options) => {
      assert.equal(err, null);
      assert.equal(options.origin, true);
      done();
    });
  });

  await t.test('11. Vercel environment: Exact VERCEL_PROJECT_PRODUCTION_URL origin is permitted', (t, done) => {
    const corsDelegate = createCorsDelegate({
      NODE_ENV: 'production',
      VERCEL: '1',
      VERCEL_PROJECT_PRODUCTION_URL: 'tomato-business.vercel.app',
      CORS_ORIGIN: ''
    });

    const mockReq = {
      headers: {
        origin: 'https://tomato-business.vercel.app'
      }
    };

    corsDelegate(mockReq, (err, options) => {
      assert.equal(err, null);
      assert.equal(options.origin, true);
      done();
    });
  });

  await t.test('12. Vercel environment: Unrelated attacker-project.vercel.app origin is strictly rejected', (t, done) => {
    const corsDelegate = createCorsDelegate({
      NODE_ENV: 'production',
      VERCEL: '1',
      VERCEL_ENV: 'preview',
      VERCEL_URL: 'tomato-business-preview-1.vercel.app',
      CORS_ORIGIN: 'https://trusted-mandi.vercel.app'
    });

    const mockReq = {
      headers: {
        origin: 'https://attacker-project.vercel.app'
      }
    };

    corsDelegate(mockReq, (err, options) => {
      assert.ok(err, 'Must reject arbitrary/unrelated vercel.app projects');
      assert.match(err.message, /not permitted by CORS policy/);
      done();
    });
  });

  await t.test('13. Vercel environment: Explicitly trusted preview origin in CORS_ORIGIN is permitted', (t, done) => {
    const corsDelegate = createCorsDelegate({
      NODE_ENV: 'production',
      VERCEL: '1',
      CORS_ORIGIN: 'https://trusted-preview-sherpa11.vercel.app'
    });

    const mockReq = {
      headers: {
        origin: 'https://trusted-preview-sherpa11.vercel.app'
      }
    };

    corsDelegate(mockReq, (err, options) => {
      assert.equal(err, null);
      assert.equal(options.origin, true);
      done();
    });
  });

  await t.test('14. HTTP Integration: Express app rejects forbidden cross-origin with 403 Forbidden', async () => {
    const { app } = await import('../src/server.js');
    const server = await new Promise((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    const port = server.address().port;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`, {
        headers: { Origin: 'https://attacker-project.vercel.app' }
      });
      assert.equal(res.status, 403, 'Should respond with 403 status');
      const data = await res.json();
      assert.equal(data.success, false);
      assert.match(data.message, /not permitted by CORS policy/);
    } finally {
      server.close();
    }
  });
});
