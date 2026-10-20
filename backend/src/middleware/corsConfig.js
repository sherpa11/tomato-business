/**
 * Factory that returns a CORS options delegate for Express.
 * Strictly enforces origin validation in production, prevents wildcard/silent allowance,
 * and handles same-origin and Vercel environments correctly.
 */
export const createCorsDelegate = (customConfig = {}) => {
  return (req, callback) => {
    const origin = req.headers?.origin;
    const nodeEnv = customConfig.NODE_ENV !== undefined ? customConfig.NODE_ENV : process.env.NODE_ENV;
    const isProduction = nodeEnv === 'production';
    const isVercel = customConfig.VERCEL !== undefined ? Boolean(customConfig.VERCEL) : Boolean(process.env.VERCEL);
    const vercelEnv = customConfig.VERCEL_ENV !== undefined ? customConfig.VERCEL_ENV : process.env.VERCEL_ENV;
    const vercelUrl = customConfig.VERCEL_URL !== undefined ? customConfig.VERCEL_URL : process.env.VERCEL_URL;
    const vercelProdUrl = customConfig.VERCEL_PROJECT_PRODUCTION_URL !== undefined
      ? customConfig.VERCEL_PROJECT_PRODUCTION_URL
      : process.env.VERCEL_PROJECT_PRODUCTION_URL;
    const rawCorsOrigin = customConfig.CORS_ORIGIN !== undefined ? customConfig.CORS_ORIGIN : process.env.CORS_ORIGIN;

    const allowedOrigins = (rawCorsOrigin || '')
      .split(',')
      .map((o) => o.trim().replace(/\/+$/, ''))
      .filter(Boolean);

    const corsOptions = {
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    };

    // 1. Requests without an Origin header:
    // Same-origin browser GET/HEAD navigation, curl, server-to-server, and internal tasks
    if (!origin) {
      return callback(null, { ...corsOptions, origin: true });
    }

    const cleanOrigin = origin.trim().replace(/\/+$/, '');

    // 2. Exact same-origin check against request host / x-forwarded-host
    const host = req.headers?.['x-forwarded-host'] || req.headers?.host;
    if (host) {
      const cleanHost = host.split(',')[0].trim();
      if (cleanOrigin === `http://${cleanHost}` || cleanOrigin === `https://${cleanHost}`) {
        return callback(null, { ...corsOptions, origin: true });
      }
    }

    // 3. Vercel environment exact deployment URL resolution
    if (isVercel) {
      if (vercelUrl && cleanOrigin === `https://${vercelUrl.replace(/\/+$/, '')}`) {
        return callback(null, { ...corsOptions, origin: true });
      }
      if (vercelProdUrl && cleanOrigin === `https://${vercelProdUrl.replace(/\/+$/, '')}`) {
        return callback(null, { ...corsOptions, origin: true });
      }
    }

    // 4. Explicitly configured CORS_ORIGIN list
    if (allowedOrigins.includes(cleanOrigin)) {
      return callback(null, { ...corsOptions, origin: true });
    }

    // 5. Development non-production allowance (localhost and 127.0.0.1)
    if (!isProduction) {
      if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(cleanOrigin)) {
        return callback(null, { ...corsOptions, origin: true });
      }
    }

    // 6. In production or any unapproved cross-origin, strictly reject
    return callback(new Error(`Origin '${cleanOrigin}' is not permitted by CORS policy.`));
  };
};
