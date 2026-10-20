import dotenv from 'dotenv';
dotenv.config();

/**
 * Validates environment variables at application startup.
 * Fails safely if required secrets or configurations are missing or insecure.
 * Never prints secret values in error messages.
 */
export const validateEnv = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const errors = [];

  // 1. MongoDB URI
  if (!process.env.MONGODB_URI || !process.env.MONGODB_URI.trim()) {
    errors.push('MONGODB_URI is required.');
  }

  // 2. JWT Secret
  const jwtSecret = process.env.JWT_SECRET?.trim();
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

  // Report errors and exit safely
  if (errors.length > 0) {
    console.error('\n=============================================================');
    console.error('❌ [FATAL] Environment Configuration Validation Failed:');
    errors.forEach((err, idx) => console.error(`   ${idx + 1}. ${err}`));
    console.error('Please configure the required environment variables before starting the server.');
    console.error('=============================================================\n');
    process.exit(1);
  }

  return {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: parseInt(process.env.PORT, 10) || 5000,
    MONGODB_URI: process.env.MONGODB_URI,
    JWT_SECRET: jwtSecret,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
    CORS_ORIGIN: process.env.CORS_ORIGIN || '',
    SEED_DEMO_DATA: process.env.SEED_DEMO_DATA === 'true' && !isProduction
  };
};

export const config = validateEnv();
