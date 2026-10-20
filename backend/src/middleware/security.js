import mongoose from 'mongoose';

/**
 * In-memory sliding window rate limiter for sensitive routes (e.g. /api/auth/login).
 * Protects against brute-force attacks without requiring external Redis in single-instance setups.
 */
export const createRateLimiter = ({ windowMs = 15 * 60 * 1000, max = 15, message = 'Too many requests, please try again later.' } = {}) => {
  const requests = new Map();

  // Periodically clean up old buckets
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of requests.entries()) {
      if (now - record.startTime > windowMs) {
        requests.delete(ip);
      }
    }
  }, windowMs);
  cleanupInterval.unref();

  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const record = requests.get(ip);

    if (!record || now - record.startTime > windowMs) {
      requests.set(ip, { count: 1, startTime: now });
      return next();
    }

    record.count++;
    if (record.count > max) {
      return res.status(429).json({
        success: false,
        message,
        retryAfter: Math.ceil((record.startTime + windowMs - now) / 1000)
      });
    }

    next();
  };
};

/**
 * Middleware to validate MongoDB ObjectId parameters in URL (e.g. /:id).
 * Prevents Mongoose CastError exceptions and returns clean 400 Bad Request.
 */
export const validateObjectId = (paramName = 'id') => {
  return (req, res, next) => {
    const val = req.params[paramName];
    if (val && !mongoose.Types.ObjectId.isValid(val)) {
      return res.status(400).json({
        success: false,
        message: `Invalid ID format for parameter '${paramName}'.`
      });
    }
    next();
  };
};

/**
 * Basic security headers middleware.
 */
export const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '0');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
};
