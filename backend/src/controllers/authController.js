import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { config } from '../config/env.js';

const generateToken = (id, role = 'ADMIN') => {
  return jwt.sign(
    { id, role: (role || 'ADMIN').toUpperCase() },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRES_IN || '7d' }
  );
};

export const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Please provide username and password' });
    }

    const user = await User.findOne({ username: username.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (user.active === false) {
      return res.status(401).json({ success: false, message: 'User account is deactivated. Contact an administrator.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const normalizedRole = (user.role || 'ADMIN').toUpperCase();

    res.json({
      success: true,
      token: generateToken(user._id, normalizedRole),
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        role: normalizedRole,
        active: user.active !== false
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user._id,
      username: req.user.username,
      name: req.user.name,
      role: (req.user.role || 'ADMIN').toUpperCase(),
      active: req.user.active !== false
    }
  });
};

/**
 * List all users (Admin only)
 */
export const getUsers = async (req, res, next) => {
  try {
    const users = await User.find({})
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();

    const formattedUsers = users.map((u) => ({
      id: u._id,
      _id: u._id,
      username: u.username,
      name: u.name,
      role: (u.role || 'ADMIN').toUpperCase(),
      active: u.active !== false,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt
    }));

    res.json({
      success: true,
      users: formattedUsers
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new user account (Admin only)
 */
export const createUser = async (req, res, next) => {
  try {
    const { username, password, name, role = 'ACCOUNTANT' } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    const cleanUsername = username.toLowerCase().trim();
    if (!/^[a-zA-Z0-9._-]{3,50}$/.test(cleanUsername)) {
      return res.status(400).json({
        success: false,
        message: 'Username must be 3-50 alphanumeric characters (dots, underscores, dashes allowed)'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    const normalizedRole = role.toUpperCase();
    if (!['ADMIN', 'ACCOUNTANT'].includes(normalizedRole)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Permitted roles: ADMIN, ACCOUNTANT'
      });
    }

    const existing = await User.findOne({ username: cleanUsername });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Username '${cleanUsername}' already exists`
      });
    }

    const newUser = await User.create({
      username: cleanUsername,
      password,
      name: name?.trim() || cleanUsername,
      role: normalizedRole,
      active: true
    });

    res.status(201).json({
      success: true,
      message: `User '${cleanUsername}' created with role '${normalizedRole}'`,
      user: {
        id: newUser._id,
        _id: newUser._id,
        username: newUser.username,
        name: newUser.name,
        role: newUser.role,
        active: newUser.active
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user role (Admin only)
 */
export const updateUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    const { id } = req.params;

    if (!role) {
      return res.status(400).json({ success: false, message: 'Role is required' });
    }

    const normalizedRole = role.toUpperCase();
    if (!['ADMIN', 'ACCOUNTANT'].includes(normalizedRole)) {
      return res.status(400).json({ success: false, message: 'Invalid role. Must be ADMIN or ACCOUNTANT' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Safety: Prevent removing last active Admin
    const currentRole = (user.role || 'ADMIN').toUpperCase();
    if (currentRole === 'ADMIN' && normalizedRole !== 'ADMIN') {
      const activeAdminCount = await User.countDocuments({
        role: { $in: ['admin', 'ADMIN'] },
        active: true
      });
      if (activeAdminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Operation rejected: Cannot remove or demote the system\'s last remaining Administrator.'
        });
      }
    }

    user.role = normalizedRole;
    await user.save();

    res.json({
      success: true,
      message: `User role updated to ${normalizedRole}`,
      user: {
        id: user._id,
        _id: user._id,
        username: user.username,
        name: user.name,
        role: user.role,
        active: user.active !== false
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle user active status (Admin only)
 */
export const updateUserStatus = async (req, res, next) => {
  try {
    const { active } = req.body;
    const { id } = req.params;

    if (typeof active !== 'boolean') {
      return res.status(400).json({ success: false, message: 'Active field must be a boolean' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Safety: Prevent deactivating last active Admin
    const currentRole = (user.role || 'ADMIN').toUpperCase();
    if (currentRole === 'ADMIN' && !active) {
      const activeAdminCount = await User.countDocuments({
        role: { $in: ['admin', 'ADMIN'] },
        active: true
      });
      if (activeAdminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Operation rejected: Cannot deactivate the system\'s last remaining Administrator.'
        });
      }
    }

    user.active = active;
    await user.save();

    res.json({
      success: true,
      message: `User '${user.username}' is now ${active ? 'active' : 'deactivated'}`,
      user: {
        id: user._id,
        _id: user._id,
        username: user.username,
        name: user.name,
        role: (user.role || 'ADMIN').toUpperCase(),
        active: user.active
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a user account (Admin only)
 */
export const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Safety: Cannot delete oneself
    if (req.user && req.user._id.toString() === id) {
      return res.status(400).json({
        success: false,
        message: 'Operation rejected: You cannot delete your own logged-in account.'
      });
    }

    // Safety: Cannot delete last Admin
    const currentRole = (user.role || 'ADMIN').toUpperCase();
    if (currentRole === 'ADMIN') {
      const adminCount = await User.countDocuments({
        role: { $in: ['admin', 'ADMIN'] }
      });
      if (adminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Operation rejected: Cannot delete the only Administrator.'
        });
      }
    }

    await User.findByIdAndDelete(id);

    res.json({
      success: true,
      message: `User '${user.username}' deleted successfully`
    });
  } catch (error) {
    next(error);
  }
};
