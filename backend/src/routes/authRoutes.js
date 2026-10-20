import express from 'express';
import { login, getMe } from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/security.js';

const router = express.Router();

// Rate limit login attempts to 15 attempts per 15 minutes per IP
const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: 'Too many login attempts. Please try again in 15 minutes.'
});

router.post('/login', loginLimiter, login);
router.get('/me', protect, getMe);

export default router;
