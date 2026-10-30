import mongoose from 'mongoose';

let cachedConnectionPromise = null;

export const connectDB = async () => {
  // 1. If connection is already open, reuse it immediately (serverless optimization)
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // 2. If a connection is actively in flight, reuse the same promise to prevent race conditions
  if (cachedConnectionPromise) {
    return cachedConnectionPromise;
  }

  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tomato_billing';
  const targetDbName = process.env.MONGODB_DB_NAME || 'tomato_billing';

  cachedConnectionPromise = (async () => {
    try {
      await mongoose.connect(uri, {
        dbName: targetDbName,
        serverSelectionTimeoutMS: 8000,
        socketTimeoutMS: 45000
      });
      console.log(`[Database] Connected successfully to MongoDB (database: ${targetDbName})`);
      return mongoose.connection;
    } catch (error) {
      // Reset cached promise so subsequent attempts can retry instead of caching failure
      cachedConnectionPromise = null;
      console.error(`[Database Error] Connection failed: ${error.message}`);
      if (!process.env.VERCEL) {
        process.exit(1);
      }
      throw error;
    }
  })();

  return cachedConnectionPromise;
};

export const _resetConnectionCacheForTesting = () => {
  cachedConnectionPromise = null;
};
