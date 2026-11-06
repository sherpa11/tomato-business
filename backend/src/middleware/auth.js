import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { config } from '../config/env.js';

export const protect = async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, config.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'User not found' });
      }
      if (req.user.active === false) {
        return res.status(401).json({ success: false, message: 'User account is deactivated. Contact an administrator.' });
      }
      // Normalize role to uppercase for strict role checks
      req.user.role = (req.user.role || 'ADMIN').toUpperCase();
      return next();
    } catch (error) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
};

/**
 * Role-based authorization middleware.
 * Verifies that the authenticated user possesses one of the allowed roles.
 * Returns HTTP 403 Forbidden if unauthorized.
 */
export const authorizeRoles = (...roles) => {
  const allowed = roles.map((r) => r.toUpperCase());
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const userRole = (req.user.role || '').toUpperCase();
    if (!allowed.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have permission to access this resource.'
      });
    }
    next();
  };
};

export const requireAdmin = authorizeRoles('ADMIN');
export const requireBuyerAccess = authorizeRoles('ADMIN', 'ACCOUNTANT');
