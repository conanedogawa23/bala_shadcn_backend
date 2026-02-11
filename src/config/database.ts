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

    // MongoDB connection options - tuned for Atlas replica set resilience
    const options: mongoose.ConnectOptions = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 30000, // 30s to survive primary elections (was 5s)
      socketTimeoutMS: 45000,
      heartbeatFrequencyMS: 10000,
      retryWrites: true,
      retryReads: true,
      w: 'majority',
      bufferCommands: false
    };

    // Connect with retry logic for transient Atlas failures
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await mongoose.connect(mongoURI, options);
        break;
      } catch (err) {
        if (attempt === maxRetries) throw err;
        const delay = attempt * 5000;
        logger.warn(`MongoDB connection attempt ${attempt}/${maxRetries} failed, retrying in ${delay / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

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

// Migration database connection for MSSQL to MongoDB migration
export const getMigrationDatabaseConnection = async (): Promise<mongoose.Connection> => {
  try {
    const migrationURI = process.env.MIGRATION_MONGODB_URI;

    if (!migrationURI) {
      throw new Error('MIGRATION_MONGODB_URI is not defined in environment variables');
    }

    const options: mongoose.ConnectOptions = {
      maxPoolSize: 50,
      minPoolSize: 10,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      heartbeatFrequencyMS: 10000,
      retryWrites: true,
      retryReads: true,
      w: 'majority',
      bufferCommands: false
    };

    const connection = await mongoose.createConnection(migrationURI, options).asPromise();

    logger.info(`✅ Migration MongoDB Connected: ${connection.host}`);
    logger.info(`📊 Migration Database: ${connection.name}`);

    connection.on('error', (error) => {
      logger.error('Migration MongoDB connection error:', error);
    });

    connection.on('disconnected', () => {
      logger.warn('⚠️  Migration MongoDB disconnected');
    });

    return connection;
  } catch (error) {
    logger.error('❌ Migration database connection failed:', error);
    throw error;
  }
};
