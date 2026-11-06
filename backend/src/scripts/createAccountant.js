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

export const provisionAccountant = async (cliArgs = {}) => {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.MONGODB_URI);
    }
    console.log('[Accountant Provisioning] Connected to database.');

    let username = cliArgs.username;
    let password = cliArgs.password;
    let name = cliArgs.name || 'Store Accountant';

    if (!username) {
      username = await askQuestion('Enter Accountant Username (min 3 chars): ');
    }
    if (!username || username.length < 3) {
      console.error('❌ Error: Username must be at least 3 characters long.');
      process.exit(1);
    }

    if (!password) {
      password = await askQuestion('Enter Accountant Password (min 6 chars): ');
    }
    if (!password || password.length < 6) {
      console.error('❌ Error: Password must be at least 6 characters long.');
      process.exit(1);
    }

    const cleanUsername = username.toLowerCase().trim();
    let existing = await User.findOne({ username: cleanUsername });

    if (existing) {
      console.log(`[Accountant Provisioning] User '${cleanUsername}' already exists. Updating role to ACCOUNTANT...`);
      existing.password = password;
      existing.name = name;
      existing.role = 'ACCOUNTANT';
      existing.active = true;
      await existing.save();
      console.log(`✅ Accountant account '${cleanUsername}' updated successfully.`);
    } else {
      await User.create({
        username: cleanUsername,
        password,
        name,
        role: 'ACCOUNTANT',
        active: true
      });
      console.log(`✅ Accountant account '${cleanUsername}' created successfully.`);
    }

    if (process.env.NODE_ENV !== 'test') {
      await mongoose.disconnect();
    }
  } catch (err) {
    console.error('❌ [Accountant Provisioning Failed]:', err.message);
    process.exit(1);
  }
};

// Execute if run directly from CLI
if (process.argv[1] && process.argv[1].endsWith('createAccountant.js')) {
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
  provisionAccountant(args);
}
