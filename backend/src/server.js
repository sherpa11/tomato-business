import dotenv from 'dotenv';
dotenv.config();

import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { config } from './config/env.js';
import { connectDB } from './config/db.js';
import { errorHandler } from './middleware/errorHandler.js';
import { securityHeaders } from './middleware/security.js';
import { createCorsDelegate } from './middleware/corsConfig.js';

import Settings from './models/Settings.js';
import User from './models/User.js';

import authRoutes from './routes/authRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import buyerRoutes from './routes/buyerRoutes.js';
import supplierRoutes from './routes/supplierRoutes.js';
import purchaseRoutes from './routes/purchaseRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import printRoutes from './routes/printRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = config.PORT || 5000;

// Security & Header configurations
app.disable('x-powered-by');
app.use(securityHeaders);

// Strict CORS configuration
const corsDelegate = createCorsDelegate(config);
app.use(cors(corsDelegate));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// In serverless environments (e.g. Vercel), ensure DB is connected and initialized before handling requests
let isInitialized = false;

app.use(async (req, res, next) => {
  if (process.env.VERCEL) {
    try {
      await connectDB();
      if (!isInitialized) {
        await initializeDatabase();
        isInitialized = true;
      }
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Database connection failure: ' + err.message });
    }
  }
  next();
});

// Health check endpoint (safe for monitoring, probes, load balancers)
app.get('/api/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatusMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  const isHealthy = dbState === 1;
  const status = isHealthy ? 200 : 503;

  res.status(status).json({
    status: isHealthy ? 'ok' : 'degraded',
    service: 'Tomato Wholesale Billing API',
    database: dbStatusMap[dbState] || 'unknown',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/buyers', buyerRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/print', printRoutes);

// Optional: Serve frontend static build if configured or deployed as single unit
const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');
app.use(express.static(frontendDistPath));

// API 404 Handler (for unmatched /api/* requests)
app.all('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint '${req.originalUrl}' not found.`
  });
});

// SPA fallback for frontend client-side routing
app.get('*', (req, res, next) => {
  res.sendFile(path.join(frontendDistPath, 'index.html'), (err) => {
    if (err) {
      // If frontend build is not served locally, return a standard message
      res.status(404).json({
        success: false,
        message: 'Endpoint not found.'
      });
    }
  });
});

// Centralized error handler
app.use(errorHandler);

// Database initialization check
const initializeDatabase = async () => {
  try {
    // 1. Ensure default settings record exists if collection is empty
    const settingsCount = await Settings.countDocuments();
    if (settingsCount === 0) {
      await Settings.create({
        businessName: 'Tomato Wholesale Market',
        ownerName: 'Proprietor',
        phone: '',
        address: 'Wholesale Vegetable Market',
        defaultSellingRate: 1100,
        defaultPurchaseRate: 1000,
        currencySymbol: '₹',
        thermalPrintWidth: '80mm'
      });
      console.log('[Init] Default business settings initialized.');
    }

    // 2. Check if an admin user exists
    const adminCount = await User.countDocuments();
    if (adminCount === 0) {
      const adminUsername = (process.env.ADMIN_USERNAME || 'bootto').toLowerCase().trim();
      const adminPassword = process.env.ADMIN_PASSWORD;

      if (adminPassword) {
        await User.create({
          username: adminUsername,
          password: adminPassword,
          name: process.env.ADMIN_NAME || 'Market Admin',
          role: 'admin'
        });
        console.log(`[Init] Initial admin account '${adminUsername}' provisioned automatically.`);
      } else {
        console.warn('\n⚠️ [SECURITY NOTICE] No user accounts found in the database.');
        console.warn('   To auto-create an admin, configure ADMIN_PASSWORD in environment variables');
        console.warn('   or run: npm run admin:create\n');
      }
    }
  } catch (err) {
    console.error('[Init Error] Error during initial database verification:', err.message);
  }
};

// Bootstrap Server
let server;

const startServer = async () => {
  await connectDB();
  await initializeDatabase();

  server = app.listen(PORT, () => {
    console.log(`[Server] Tomato Billing API running in ${config.NODE_ENV} mode on port ${PORT}`);
  });
};

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
  console.log(`\n[Server] Received ${signal}. Initiating graceful shutdown...`);

  if (server) {
    server.close(async () => {
      console.log('[Server] HTTP server closed.');
      try {
        await mongoose.connection.close(false);
        console.log('[Database] MongoDB connection closed.');
        process.exit(0);
      } catch (err) {
        console.error('[Database] Error closing MongoDB connection:', err);
        process.exit(1);
      }
    });
  } else {
    process.exit(0);
  }

  // Force exit after 10 seconds if shutdown hangs
  setTimeout(() => {
    console.error('[Server] Graceful shutdown timed out. Forcing exit.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

if (!process.env.VERCEL) {
  startServer();
}

export default app;
export { app };
