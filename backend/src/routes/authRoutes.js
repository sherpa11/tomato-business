import express from 'express';
import {
  login,
  getMe,
  getUsers,
  createUser,
  updateUserRole,
  updateUserStatus,
  deleteUser,
  changeAdminCredentials
} from '../controllers/authController.js';
import { protect, requireAdmin } from '../middleware/auth.js';
import { createRateLimiter, validateObjectId } from '../middleware/security.js';

const router = express.Router();

// Rate limit login attempts to 15 attempts per 15 minutes per IP
const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: 'Too many login attempts. Please try again in 15 minutes.'
});

router.post('/login', loginLimiter, login);
router.get('/me', protect, getMe);

// Admin credential management (Change own username/password)
router.put('/change-credentials', protect, requireAdmin, changeAdminCredentials);

// Admin-only user management endpoints
router.get('/users', protect, requireAdmin, getUsers);
router.post('/users', protect, requireAdmin, createUser);
router.put('/users/:id/role', protect, requireAdmin, validateObjectId('id'), updateUserRole);
router.put('/users/:id/status', protect, requireAdmin, validateObjectId('id'), updateUserStatus);
router.delete('/users/:id', protect, requireAdmin, validateObjectId('id'), deleteUser);

export default router;
