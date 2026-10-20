import mongoose from 'mongoose';

export const connectDB = async () => {
  // Reuse existing connection if already open or connecting (crucial for serverless environments)
  if (mongoose.connection.readyState >= 1) {
    return mongoose.connection;
  }

  try {
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tomato_billing';
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 45000
    });
    console.log(`[Database] Connected successfully to MongoDB: ${mongoose.connection.host}`);
    return mongoose.connection;
  } catch (error) {
    console.error(`[Database Error] Connection failed: ${error.message}`);
    if (!process.env.VERCEL) {
      process.exit(1);
    }
    throw error;
  }
};
