import { Schema, model, Document } from 'mongoose';

export interface IMigrationProgress extends Document {
  tableName: string;
  totalRecords: number;
  migratedRecords: number;
  failedRecords: number;
  lastOffset: number;
  startTime: Date;
  endTime?: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  migrationErrors: Array<{ offset: number; error: string; record?: any }>;
  metadata?: {
    batchSize?: number;
    lastBatchTime?: Date;
    estimatedCompletion?: Date;
    averageRecordsPerSecond?: number;
  };

  // Instance methods
  updateEstimatedCompletion(): void;
  recordError(offset: number, error: string, record?: any): void;
  updateProgress(recordsProcessed: number, newOffset: number): void;
}

const MigrationProgressSchema = new Schema<IMigrationProgress>({
  tableName: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  totalRecords: {
    type: Number,
    required: true,
    min: 0
  },
  migratedRecords: {
    type: Number,
    default: 0,
    min: 0
  },
  failedRecords: {
    type: Number,
    default: 0,
    min: 0
  },
  lastOffset: {
    type: Number,
    default: 0,
    min: 0
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: Date,
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'failed'],
    default: 'pending',
    index: true
  },
  migrationErrors: [{
    offset: Number,
    error: String,
    record: Schema.Types.Mixed
  }],
  metadata: {
    batchSize: Number,
    lastBatchTime: Date,
    estimatedCompletion: Date,
    averageRecordsPerSecond: Number
  }
}, {
  timestamps: true
});

MigrationProgressSchema.virtual('progressPercentage').get(function() {
  if (this.totalRecords === 0) {return 0;}
  return (this.migratedRecords / this.totalRecords) * 100;
});

MigrationProgressSchema.methods.updateEstimatedCompletion = function() {
  if (this.status !== 'in_progress' || this.migratedRecords === 0) {return;}

  const elapsedMs = Date.now() - this.startTime.getTime();
  const recordsPerMs = this.migratedRecords / elapsedMs;
  const remainingRecords = this.totalRecords - this.migratedRecords;
  const estimatedRemainingMs = remainingRecords / recordsPerMs;

  this.metadata = this.metadata || {};
  this.metadata.estimatedCompletion = new Date(Date.now() + estimatedRemainingMs);
  this.metadata.averageRecordsPerSecond = recordsPerMs * 1000;
};

MigrationProgressSchema.methods.recordError = function(offset: number, error: string, record?: any) {
  this.migrationErrors.push({ offset, error, record });
  this.failedRecords++;
};

MigrationProgressSchema.methods.updateProgress = function(recordsProcessed: number, newOffset: number) {
  this.migratedRecords += recordsProcessed;
  this.lastOffset = newOffset;
  this.metadata = this.metadata || {};
  this.metadata.lastBatchTime = new Date();
  this.updateEstimatedCompletion();
};

export const MigrationProgressModel = model<IMigrationProgress>('MigrationProgress', MigrationProgressSchema);
