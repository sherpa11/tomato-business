import dotenv from 'dotenv';
dotenv.config();

/**
 * Validates environment variables at application startup.
 * Fails safely if required secrets or configurations are missing or insecure.
 * Never prints secret values in error messages.
 */
export const validateEnv = (options = { shouldExit: true }) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const errors = [];

  // 1. MongoDB URI (strictly required in production; defaults to local in dev/test)
  const rawMongoUri = (process.env.MONGODB_URI?.trim() || '').replace(/^["']|["']$/g, '');
  const mongoUri = rawMongoUri || (isProduction ? '' : 'mongodb://127.0.0.1:27017/tomato_billing');
  if (!mongoUri) {
    errors.push('MONGODB_URI is required.');
  } else if (isProduction && !/^(mongodb|mongodb\+srv):\/\//i.test(mongoUri)) {
    errors.push('MONGODB_URI must start with "mongodb://" or "mongodb+srv://".');
  }

  // 1b. Admin Username (sanitized safely: if accidentally set to a URI or invalid format, safely default to 'bootto' without crashing production)
  let safeAdminUsername = 'bootto';
  const rawAdminUsername = (process.env.ADMIN_USERNAME?.trim() || '').replace(/^["']|["']$/g, '');
  if (rawAdminUsername) {
    const isUriLike = /^(mongodb|mongodb\+srv):\/\//i.test(rawAdminUsername) || rawAdminUsername.includes('://') || rawAdminUsername.includes('@');
    const isValid = /^[a-zA-Z0-9._-]{3,50}$/.test(rawAdminUsername);
    if (!isUriLike && isValid) {
      safeAdminUsername = rawAdminUsername.toLowerCase();
    } else {
      console.warn('[Config Warning] ADMIN_USERNAME contains invalid characters or a URI format. Safely falling back to default "bootto".');
      safeAdminUsername = 'bootto';
    }
  }

  // 2. JWT Secret (strictly required & >=32 chars in production)
  const rawJwtSecret = (process.env.JWT_SECRET?.trim() || '').replace(/^["']|["']$/g, '');
  const jwtSecret = rawJwtSecret || (isProduction ? '' : 'dev_jwt_secret_32_characters_long_local_only');
  const KNOWN_INSECURE_SECRETS = [
    'super_secret_tomato_wholesale_jwt_key_2026',
    'your_production_jwt_secret_min_32_characters_long',
    'secret',
    'jwt_secret',
    '123456'
  ];

  if (!jwtSecret) {
    errors.push('JWT_SECRET is required.');
  } else if (isProduction) {
    if (jwtSecret.length < 32) {
      errors.push('JWT_SECRET must be at least 32 characters long in production.');
    }
    if (KNOWN_INSECURE_SECRETS.includes(jwtSecret)) {
      errors.push('JWT_SECRET cannot use a default or example placeholder in production.');
    }
  }

  // 3. CORS Configuration Validation in Production
  const rawCorsOrigin = (process.env.CORS_ORIGIN?.trim() || '').replace(/^["']|["']$/g, '');
  const corsOrigin = rawCorsOrigin;
  const isVercel = Boolean(process.env.VERCEL);

  if (isProduction) {
    if (!isVercel && (!corsOrigin || corsOrigin === '')) {
      errors.push('CORS_ORIGIN is required in production when running outside a unified Vercel deployment.');
    } else if (corsOrigin) {
      if (corsOrigin === '*') {
        errors.push('CORS_ORIGIN cannot be "*" in production.');
      } else {
        const origins = corsOrigin.split(',').map((o) => o.trim()).filter(Boolean);
        if (origins.length === 0) {
          errors.push('CORS_ORIGIN must contain at least one valid origin URL in production.');
        } else {
          origins.forEach((orig) => {
            if (!/^https?:\/\/.+/.test(orig)) {
              errors.push(`Invalid CORS origin '${orig}'. Allowed origins must start with http:// or https://.`);
            }
          });
        }
      }
    }
  }

  // Report errors and exit safely (or throw if shouldExit is false or in serverless)
  if (errors.length > 0) {
    if (options.shouldExit !== false && !isVercel) {
      console.error('\n=============================================================');
      console.error('❌ [FATAL] Environment Configuration Validation Failed:');
      errors.forEach((err, idx) => console.error(`   ${idx + 1}. ${err}`));
      console.error('Please configure the required environment variables before starting the server.');
      console.error('=============================================================\n');
      process.exit(1);
    } else {
      const err = new Error('Environment Configuration Validation Failed: ' + errors.join('; '));
      err.validationErrors = errors;
      throw err;
    }
  }

  return {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: parseInt(process.env.PORT, 10) || 5000,
    MONGODB_URI: mongoUri,
    MONGODB_DB_NAME: process.env.MONGODB_DB_NAME || 'tomato_billing',
    ADMIN_USERNAME: safeAdminUsername,
    JWT_SECRET: jwtSecret,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
    CORS_ORIGIN: corsOrigin || '',
    SEED_DEMO_DATA: process.env.SEED_DEMO_DATA === 'true' && !isProduction
  };
};

export const config = validateEnv();
