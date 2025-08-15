import { BaseMigration } from './BaseMigration';
import { AdvancedBillingModel, IAdvancedBilling, BillingStatus } from '../models/AdvancedBilling';
import { DataFilter } from './DataFilter';
import logger from '../utils/logger';

export interface MSSQLAdvancedBillingRecord {
  id: number;
  advanced_billing_id: number;
  client_id: string;
  client_key: number;
  start_date: Date;
  end_date: Date;
  product_key: number;
  bill_date: Date;
  is_active: boolean;
  status: string;
  clinic_name: string;
  date_created: Date;
  date_modified: Date;
}

export class AdvancedBillingMigration extends BaseMigration {
  protected collectionName = 'advancedbillings';
  protected batchSize = 100; // Smaller batch size for careful processing

  /**
   * Get total count from MSSQL
   */
  protected async getTotalCount(): Promise<number> {
    const query = `
      SELECT COUNT(*) as count 
      FROM advanced_billing 
      WHERE is_active = 1 AND status != 'DELETED'
    `;
    
    const result = await this.executeMSSQLQuery(query);
    return result[0]?.count || 0;
  }

  /**
   * Fetch batch from MSSQL with filtering
   */
  protected async fetchBatch(offset: number): Promise<MSSQLAdvancedBillingRecord[]> {
    const query = `
      SELECT 
        id,
        advanced_billing_id,
        client_id,
        client_key,
        start_date,
        end_date,
        product_key,
        bill_date,
        is_active,
        status,
        clinic_name,
        date_created,
        date_modified
      FROM advanced_billing 
      WHERE is_active = 1 AND status != 'DELETED'
      ORDER BY id 
      OFFSET ${offset} ROWS 
      FETCH NEXT ${this.batchSize} ROWS ONLY
    `;
    
    const records = await this.executeMSSQLQuery(query);
    logger.info(`Fetched ${records.length} advanced billing records from MSSQL (offset: ${offset})`);
    
    return records;
  }

  /**
   * Transform MSSQL record to MongoDB document
   */
  protected transformRecord(record: MSSQLAdvancedBillingRecord): Partial<IAdvancedBilling> {
    // Convert status string to enum
    const status = this.mapBillingStatus(record.status);
    
    return {
      billingId: record.advanced_billing_id,
      clientId: record.client_id?.trim() || '',
      clientKey: record.client_key,
      startDate: new Date(record.start_date),
      endDate: new Date(record.end_date),
      productKey: record.product_key,
      billDate: new Date(record.bill_date),
      isActive: record.is_active,
      status,
      clinicName: record.clinic_name?.trim() || '',
      dateCreated: new Date(record.date_created),
      dateModified: new Date(record.date_modified)
    };
  }

  /**
   * Map MSSQL status strings to enum values
   */
  private mapBillingStatus(status: string): BillingStatus {
    const statusMap: Record<string, BillingStatus> = {
      'ACTIVE': BillingStatus.ACTIVE,
      'INACTIVE': BillingStatus.INACTIVE,
      'CANCELLED': BillingStatus.CANCELLED,
      'COMPLETED': BillingStatus.COMPLETED,
      'SUSPENDED': BillingStatus.SUSPENDED
    };
    
    return statusMap[status?.toUpperCase()] || BillingStatus.INACTIVE;
  }

  /**
   * Apply business rules and data filtering
   */
  protected async applyBusinessRules(records: MSSQLAdvancedBillingRecord[]): Promise<MSSQLAdvancedBillingRecord[]> {
    const dataFilter = DataFilter.getInstance();
    
    // Apply VISIO clinic filtering
    const filteredByClinic = records.filter(record => 
      dataFilter.shouldIncludeClinic(record.clinic_name?.trim() || '')
    );
    
    // Apply product key filtering if needed
    const filteredByProduct = filteredByClinic.filter(record => 
      dataFilter.shouldIncludeProduct(record.product_key)
    );
    
    // Additional business rules
    const finalFiltered = filteredByProduct.filter(record => {
      // Only include records with valid dates
      if (!record.start_date || !record.end_date || !record.bill_date) {
        return false;
      }
      
      // Only include records with valid client ID
      if (!record.client_id?.trim()) {
        return false;
      }
      
      // Only include records with valid billing ID
      if (!record.advanced_billing_id || record.advanced_billing_id <= 0) {
        return false;
      }
      
      return true;
    });
    
    if (filteredByClinic.length !== records.length) {
      logger.info(`Filtered out ${records.length - filteredByClinic.length} records by clinic rules`);
    }
    
    if (filteredByProduct.length !== filteredByClinic.length) {
      logger.info(`Filtered out ${filteredByClinic.length - filteredByProduct.length} records by product rules`);
    }
    
    if (finalFiltered.length !== filteredByProduct.length) {
      logger.info(`Filtered out ${filteredByProduct.length - finalFiltered.length} records by validation rules`);
    }
    
    return finalFiltered;
  }

  /**
   * Process and save batch to MongoDB with conflict resolution
   */
  protected async processBatch(records: MSSQLAdvancedBillingRecord[]): Promise<void> {
    if (records.length === 0) {return;}
    
    // Apply business rules
    const filteredRecords = await this.applyBusinessRules(records);
    
    if (filteredRecords.length === 0) {
      logger.info('No records to process after filtering');
      return;
    }
    
    // Transform records using map for optimization
    const transformedRecords = filteredRecords.map(record => 
      this.transformRecord(record)
    );
    
    // Check for existing records to handle duplicates
    const billingIds = transformedRecords.map(record => record.billingId);
    const existing = await AdvancedBillingModel.find({
      billingId: { $in: billingIds }
    }).select('billingId').lean();
    
    const existingIds = new Set(existing.map(doc => doc.billingId));
    
    // Separate new records from updates
    const newRecords = transformedRecords.filter(record => 
      !existingIds.has(record.billingId)
    );
    
    const updateRecords = transformedRecords.filter(record => 
      existingIds.has(record.billingId)
    );
    
    // Insert new records
    if (newRecords.length > 0) {
      await AdvancedBillingModel.insertMany(newRecords, { 
        ordered: false,
        rawResult: false 
      });
      logger.info(`Inserted ${newRecords.length} new advanced billing records`);
    }
    
    // Update existing records
    if (updateRecords.length > 0) {
      const updateOperations = updateRecords.map(record => ({
        updateOne: {
          filter: { billingId: record.billingId },
          update: { 
            $set: {
              ...record,
              dateModified: new Date()
            }
          }
        }
      }));
      
      const result = await AdvancedBillingModel.bulkWrite(updateOperations);
      logger.info(`Updated ${result.modifiedCount} existing advanced billing records`);
    }
  }

  /**
   * Create indexes for optimal query performance
   */
  protected async createIndexes(): Promise<void> {
    const indexes = [
      { billingId: 1 }, // Unique index
      { clientId: 1, isActive: 1 },
      { clinicName: 1, isActive: 1 },
      { status: 1, isActive: 1 },
      { billDate: 1, isActive: 1 },
      { startDate: 1, endDate: 1 },
      { productKey: 1 },
      { dateCreated: 1 },
      { dateModified: 1 },
      // Compound indexes for common queries
      { clientId: 1, status: 1, isActive: 1 },
      { clinicName: 1, status: 1, isActive: 1 },
      { isActive: 1, status: 1, billDate: 1 }
    ];
    
    await Promise.all(
      indexes.map(index => 
        AdvancedBillingModel.collection.createIndex(index)
      )
    );
    
    // Unique index on billingId
    await AdvancedBillingModel.collection.createIndex(
      { billingId: 1 }, 
      { unique: true }
    );
    
    logger.info('Created indexes for AdvancedBilling collection');
  }

  /**
   * Validate migrated data
   */
  protected async validateMigration(): Promise<void> {
    const [totalMongoDB, totalActive, totalByStatus] = await Promise.all([
      AdvancedBillingModel.countDocuments(),
      AdvancedBillingModel.countDocuments({ isActive: true }),
      AdvancedBillingModel.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ])
    ]);
    
    logger.info('Advanced Billing Migration Validation:');
    logger.info(`Total MongoDB documents: ${totalMongoDB}`);
    logger.info(`Active billings: ${totalActive}`);
    logger.info('Status distribution:', totalByStatus);
    
    // Validate data integrity
    const invalidRecords = await AdvancedBillingModel.countDocuments({
      $or: [
        { billingId: { $exists: false } },
        { clientId: { $exists: false } },
        { startDate: { $exists: false } },
        { endDate: { $exists: false } },
        { billDate: { $exists: false } }
      ]
    });
    
    if (invalidRecords > 0) {
      logger.warn(`Found ${invalidRecords} invalid advanced billing records`);
    } else {
      logger.info('All advanced billing records passed validation');
    }
    
    // Validate date consistency
    const dateInconsistencies = await AdvancedBillingModel.countDocuments({
      $expr: { $gt: ['$startDate', '$endDate'] }
    });
    
    if (dateInconsistencies > 0) {
      logger.warn(`Found ${dateInconsistencies} records with start date > end date`);
    }
    
    // Check for duplicate billing IDs
    const duplicates = await AdvancedBillingModel.aggregate([
      { $group: { _id: '$billingId', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }
    ]);
    
    if (duplicates.length > 0) {
      logger.warn(`Found ${duplicates.length} duplicate billing IDs`);
    }
  }

  /**
   * Get migration summary
   */
  public async getMigrationSummary(): Promise<{
    totalRecords: number;
    activeRecords: number;
    statusDistribution: Array<{ status: string; count: number }>;
    topClients: Array<{ clientId: string; count: number }>;
    topClinics: Array<{ clinic: string; count: number }>;
  }> {
    const [
      totalRecords,
      activeRecords,
      statusDistribution,
      clientStats,
      clinicStats
    ] = await Promise.all([
      AdvancedBillingModel.countDocuments(),
      AdvancedBillingModel.countDocuments({ isActive: true }),
      AdvancedBillingModel.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      AdvancedBillingModel.aggregate([
        { $group: { _id: '$clientId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      AdvancedBillingModel.aggregate([
        { $group: { _id: '$clinicName', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ])
    ]);
    
    return {
      totalRecords,
      activeRecords,
      statusDistribution: statusDistribution.map(item => ({
        status: item._id,
        count: item.count
      })),
      topClients: clientStats.map(item => ({
        clientId: item._id,
        count: item.count
      })),
      topClinics: clinicStats.map(item => ({
        clinic: item._id,
        count: item.count
      }))
    };
  }
}
