import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import readline from 'readline';
import User from '../models/User.js';
import { config } from '../config/env.js';

const askQuestion = (query) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    })
  );
};

export const provisionAdmin = async (cliArgs = {}) => {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.MONGODB_URI);
    }
    console.log('[Admin Provisioning] Connected to database.');

    let username = cliArgs.username || process.env.ADMIN_USERNAME;
    let password = cliArgs.password || process.env.ADMIN_PASSWORD;
    let name = cliArgs.name || process.env.ADMIN_NAME || 'Market Administrator';

    // Interactive fallback if not passed via flags or environment
    if (!username) {
      username = await askQuestion('Enter Admin Username (min 3 chars): ');
    }
    if (!username || username.length < 3) {
      console.error('❌ Error: Username must be at least 3 characters long.');
      process.exit(1);
    }
    if (/^(mongodb|mongodb\+srv):\/\//i.test(username) || username.includes('://') || username.includes('@')) {
      console.error('❌ Error: Username must not be a MongoDB connection string or URI.');
      process.exit(1);
    }

    if (!password) {
      password = await askQuestion('Enter Admin Password (min 6 chars): ');
    }
    if (!password || password.length < 6) {
      console.error('❌ Error: Password must be at least 6 characters long.');
      process.exit(1);
    }

    const cleanUsername = username.toLowerCase().trim();
    let existing = await User.findOne({ username: cleanUsername });

    if (existing) {
      console.log(`[Admin Provisioning] User '${cleanUsername}' already exists. Updating credentials...`);
      existing.password = password; // Pre-save hook hashes with bcrypt
      existing.name = name;
      existing.role = 'admin';
      await existing.save();
      console.log(`✅ Administrator account '${cleanUsername}' updated successfully.`);
    } else {
      await User.create({
        username: cleanUsername,
        password, // Pre-save hook hashes with bcrypt
        name,
        role: 'admin'
      });
      console.log(`✅ Administrator account '${cleanUsername}' created successfully.`);
    }

    if (process.env.NODE_ENV !== 'test') {
      await mongoose.disconnect();
    }
  } catch (err) {
    console.error('❌ [Admin Provisioning Failed]:', err.message);
    process.exit(1);
  }
};

// Execute if run directly from CLI
if (process.argv[1] && process.argv[1].endsWith('createAdmin.js')) {
  const args = {};
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--username' && process.argv[i + 1]) {
      args.username = process.argv[++i];
    } else if (process.argv[i] === '--password' && process.argv[i + 1]) {
      args.password = process.argv[++i];
    } else if (process.argv[i] === '--name' && process.argv[i + 1]) {
      args.name = process.argv[++i];
    }
  }
  provisionAdmin(args);
}
