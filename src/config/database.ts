import mongoose from 'mongoose';
import { logger } from '@/utils/logger';

export const connectDatabase = async (): Promise<void> => {
  try {
    const mongoURI = process.env.NODE_ENV === 'test' 
      ? process.env.MONGODB_TEST_URI! 
      : process.env.MONGODB_URI!;

    if (!mongoURI) {
      throw new Error('MongoDB URI is not defined in environment variables');
    }

    // MongoDB connection options
    const options: mongoose.ConnectOptions = {
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      bufferCommands: false // Disable mongoose buffering
    };

    // Connect to MongoDB
    await mongoose.connect(mongoURI, options);

    logger.info(`✅ MongoDB Connected: ${mongoose.connection.host}`);
    logger.info(`📊 Database: ${mongoose.connection.name}`);

    // Connection event handlers
    mongoose.connection.on('error', (error) => {
      logger.error('MongoDB connection error:', error);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('⚠️  MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('🔄 MongoDB reconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      try {
        await mongoose.connection.close();
        logger.info('🔒 MongoDB connection closed due to application termination');
      } catch (error) {
        logger.error('Error closing MongoDB connection:', error);
      }
    });

  } catch (error) {
    logger.error('❌ Database connection failed:', error);
    throw error;
  }
};

// Get database connection status
export const getDatabaseStatus = () => {
  const state = mongoose.connection.readyState;
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  
  return {
    status: states[state as keyof typeof states] || 'unknown',
    host: mongoose.connection.host,
    name: mongoose.connection.name,
    collections: Object.keys(mongoose.connection.collections).length
  };
};
