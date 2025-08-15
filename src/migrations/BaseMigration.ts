import { logger } from '@/utils/logger';

export interface MigrationResult {
  success: boolean;
  totalRecords: number;
  migratedRecords: number;
  skippedRecords: number;
  errors: string[];
  duration: number;
  tableName: string;
}

export interface MigrationOptions {
  batchSize: number;
  skipExisting: boolean;
  validateData: boolean;
  dryRun: boolean;
}

export abstract class BaseMigration {
  protected readonly defaultOptions: MigrationOptions = {
    batchSize: 1000,
    skipExisting: true,
    validateData: true,
    dryRun: false
  };

  constructor(protected readonly options: Partial<MigrationOptions> = {}) {
    this.options = { ...this.defaultOptions, ...options };
  }

  /**
   * Abstract method to be implemented by concrete migration classes
   */
  abstract migrate(): Promise<MigrationResult>;

  /**
   * Process records in optimized batches to avoid memory issues
   * Uses efficient batch processing instead of forEach
   */
  protected async processBatch<T, R>(
    records: T[],
    processor: (batch: T[]) => Promise<R[]>,
    batchSize: number = this.options.batchSize
  ): Promise<R[]> {
    const results: R[] = [];
    const totalBatches = Math.ceil(records.length / batchSize);
    
    for (let i = 0; i < totalBatches; i++) {
      const start = i * batchSize;
      const end = Math.min(start + batchSize, records.length);
      const batch = records.slice(start, end);
      
      try {
        const batchResults = await processor(batch);
        results.push(...batchResults);
        
        logger.info(`Processed batch ${i + 1}/${totalBatches} (${batch.length} records)`);
      } catch (error) {
        logger.error(`Error processing batch ${i + 1}:`, error);
        throw error;
      }
    }
    
    return results;
  }

  /**
   * Validate data before migration using efficient filtering
   */
  protected validateRecords<T>(
    records: T[],
    validator: (record: T) => boolean
  ): { valid: T[]; invalid: T[] } {
    // Use efficient reduce instead of forEach for better performance
    return records.reduce(
      (acc, record) => {
        if (validator(record)) {
          acc.valid.push(record);
        } else {
          acc.invalid.push(record);
        }
        return acc;
      },
      { valid: [] as T[], invalid: [] as T[] }
    );
  }

  /**
   * Transform records using efficient mapping
   */
  protected transformRecords<T, R>(
    records: T[],
    transformer: (record: T) => R
  ): R[] {
    // Use native map for optimal performance
    return records.map(transformer);
  }

  /**
   * Log migration progress efficiently
   */
  protected logProgress(
    tableName: string,
    processed: number,
    total: number,
    errors: number = 0
  ): void {
    const percentage = ((processed / total) * 100).toFixed(1);
    logger.info(
      `Migration Progress [${tableName}]: ${processed}/${total} (${percentage}%) - Errors: ${errors}`
    );
  }

  /**
   * Create migration result with timing
   */
  protected createResult(
    tableName: string,
    totalRecords: number,
    migratedRecords: number,
    errors: string[],
    startTime: number
  ): MigrationResult {
    return {
      success: errors.length === 0,
      totalRecords,
      migratedRecords,
      skippedRecords: totalRecords - migratedRecords,
      errors,
      duration: Date.now() - startTime,
      tableName
    };
  }

  /**
   * Execute migration with error handling and timing
   */
  async execute(): Promise<MigrationResult> {
    const startTime = Date.now();
    
    try {
      logger.info(`Starting migration with options:`, this.options);
      
      if (this.options.dryRun) {
        logger.info('DRY RUN MODE - No data will be written');
      }
      
      const result = await this.migrate();
      
      logger.info(`Migration completed in ${result.duration}ms:`, {
        table: result.tableName,
        total: result.totalRecords,
        migrated: result.migratedRecords,
        skipped: result.skippedRecords,
        errors: result.errors.length
      });
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Migration failed:', error);
      
      return {
        success: false,
        totalRecords: 0,
        migratedRecords: 0,
        skippedRecords: 0,
        errors: [errorMessage],
        duration: Date.now() - startTime,
        tableName: 'unknown'
      };
    }
  }
}
