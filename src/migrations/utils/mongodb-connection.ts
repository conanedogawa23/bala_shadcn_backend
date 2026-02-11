import mongoose, { Connection } from 'mongoose';

let migrationConnection: Connection | null = null;

export const getMigrationConnection = async (): Promise<Connection> => {
  if (migrationConnection && migrationConnection.readyState === 1) {
    return migrationConnection;
  }

  const migrationDbUri = process.env.MIGRATION_MONGODB_URI || 
                         'mongodb://localhost:27017/visio_new';

  try {
    migrationConnection = await mongoose.createConnection(migrationDbUri, {
      maxPoolSize: 50,
      minPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferCommands: false
    }).asPromise();

    console.log(`✅ Connected to migration database: ${migrationConnection.name}`);
    console.log(`🏥 Host: ${migrationConnection.host}`);

    migrationConnection.on('error', (error) => {
      console.error('Migration MongoDB error:', error);
    });

    migrationConnection.on('disconnected', () => {
      console.warn('⚠️  Migration MongoDB disconnected');
      migrationConnection = null;
    });

    return migrationConnection;
  } catch (error) {
    console.error('❌ Failed to connect to migration database:', error);
    throw error;
  }
};

export const closeMigrationConnection = async (): Promise<void> => {
  if (migrationConnection) {
    await migrationConnection.close();
    migrationConnection = null;
    console.log('🔒 Migration MongoDB connection closed');
  }
};

export const getMigrationDatabaseStatus = () => {
  if (!migrationConnection) {
    return { status: 'disconnected', host: null, name: null };
  }

  const state = migrationConnection.readyState;
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  return {
    status: states[state as keyof typeof states] || 'unknown',
    host: migrationConnection.host,
    name: migrationConnection.name,
    collections: Object.keys(migrationConnection.collections).length
  };
};
