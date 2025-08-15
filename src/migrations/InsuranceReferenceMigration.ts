import { BaseMigration } from './BaseMigration';
import { InsuranceFrequencyModel, IInsuranceFrequency, FrequencyType } from '../models/InsuranceFrequency';
import { InsurancePolicyHolderModel, IInsurancePolicyHolder, PolicyHolderType } from '../models/InsurancePolicyHolder';
import { InsuranceCOBModel, IInsuranceCOB, COBStatus } from '../models/InsuranceCOB';
import logger from '../utils/logger';

// MSSQL Record Interfaces
export interface MSSQLInsuranceFrequencyRecord {
  sb_insurance_frequency_key: number;
  sb_insurance_frequency_name: string;
}

export interface MSSQLInsurancePolicyHolderRecord {
  sb_insurance_policy_holder_key: number;
  sb_insurance_policy_holder_name: string;
}

export interface MSSQLInsuranceCOBRecord {
  sb_insurance_cob_key: number;
  sb_insurance_cob_name: string;
}

export class InsuranceReferenceMigration extends BaseMigration {
  protected collectionName = 'insurance_reference_data';
  protected batchSize = 50; // Small batch size for reference data

  /**
   * Run the complete insurance reference migration
   */
  public async runMigration(): Promise<void> {
    logger.info('Starting Insurance Reference Data Migration...');
    
    await this.connectToMongoDB();
    
    try {
      // Migrate all three reference data types
      await Promise.all([
        this.migrateInsuranceFrequencies(),
        this.migrateInsurancePolicyHolders(),
        this.migrateInsuranceCOB()
      ]);
      
      // Create indexes for all collections
      await this.createAllIndexes();
      
      // Validate all migrations
      await this.validateAllMigrations();
      
      logger.info('Insurance Reference Data Migration completed successfully');
      
    } catch (error) {
      logger.error('Insurance Reference Migration failed:', error);
      throw error;
    }
  }

  /**
   * INSURANCE FREQUENCY MIGRATION
   */
  
  private async migrateInsuranceFrequencies(): Promise<void> {
    logger.info('Migrating Insurance Frequencies...');
    
    const query = `
      SELECT 
        sb_insurance_frequency_key,
        sb_insurance_frequency_name
      FROM sb_insurance_frequency
      ORDER BY sb_insurance_frequency_key
    `;
    
    const records = await this.executeMSSQLQuery(query);
    logger.info(`Fetched ${records.length} insurance frequency records from MSSQL`);
    
    if (records.length === 0) {
      logger.warn('No insurance frequency records found in MSSQL');
      return;
    }
    
    // Transform and map frequency records
    const transformedRecords = records.map((record: MSSQLInsuranceFrequencyRecord) => 
      this.transformFrequencyRecord(record)
    );
    
    // Clear existing collection
    await InsuranceFrequencyModel.deleteMany({});
    
    // Insert new records
    await InsuranceFrequencyModel.insertMany(transformedRecords);
    
    logger.info(`Successfully migrated ${transformedRecords.length} insurance frequency records`);
  }

  private transformFrequencyRecord(record: MSSQLInsuranceFrequencyRecord): Partial<IInsuranceFrequency> {
    return {
      frequencyKey: record.sb_insurance_frequency_key,
      frequencyName: record.sb_insurance_frequency_name?.trim() || '',
      frequencyType: this.mapFrequencyType(record.sb_insurance_frequency_name),
      dateCreated: new Date(),
      dateModified: new Date()
    };
  }

  private mapFrequencyType(name: string): FrequencyType {
    const normalizedName = name?.toLowerCase().trim() || '';
    
    if (normalizedName.includes('select')) {
      return FrequencyType.SELECT;
    }
    if (normalizedName.includes('yearly') || normalizedName.includes('annual')) {
      return FrequencyType.YEARLY;
    }
    if (normalizedName.includes('rolling') || normalizedName.includes('continuous')) {
      return FrequencyType.ROLLING;
    }
    
    return FrequencyType.NUMERIC; // Default for numeric frequency values
  }

  /**
   * INSURANCE POLICY HOLDER MIGRATION
   */
  
  private async migrateInsurancePolicyHolders(): Promise<void> {
    logger.info('Migrating Insurance Policy Holders...');
    
    const query = `
      SELECT 
        sb_insurance_policy_holder_key,
        sb_insurance_policy_holder_name
      FROM sb_insurance_policy_holder
      ORDER BY sb_insurance_policy_holder_key
    `;
    
    const records = await this.executeMSSQLQuery(query);
    logger.info(`Fetched ${records.length} insurance policy holder records from MSSQL`);
    
    if (records.length === 0) {
      logger.warn('No insurance policy holder records found in MSSQL');
      return;
    }
    
    // Transform and map policy holder records
    const transformedRecords = records.map((record: MSSQLInsurancePolicyHolderRecord) => 
      this.transformPolicyHolderRecord(record)
    );
    
    // Clear existing collection
    await InsurancePolicyHolderModel.deleteMany({});
    
    // Insert new records
    await InsurancePolicyHolderModel.insertMany(transformedRecords);
    
    logger.info(`Successfully migrated ${transformedRecords.length} insurance policy holder records`);
  }

  private transformPolicyHolderRecord(record: MSSQLInsurancePolicyHolderRecord): Partial<IInsurancePolicyHolder> {
    return {
      policyHolderKey: record.sb_insurance_policy_holder_key,
      policyHolderName: record.sb_insurance_policy_holder_name?.trim() || '',
      policyHolderType: this.mapPolicyHolderType(record.sb_insurance_policy_holder_name),
      dateCreated: new Date(),
      dateModified: new Date()
    };
  }

  private mapPolicyHolderType(name: string): PolicyHolderType {
    const normalizedName = name?.toLowerCase().trim() || '';
    
    if (normalizedName.includes('none') || normalizedName === '') {
      return PolicyHolderType.NONE;
    }
    if (normalizedName.includes('self') || normalizedName.includes('patient')) {
      return PolicyHolderType.SELF;
    }
    if (normalizedName.includes('spouse') || normalizedName.includes('partner')) {
      return PolicyHolderType.SPOUSE;
    }
    if (normalizedName.includes('parent') || normalizedName.includes('mother') || normalizedName.includes('father')) {
      return PolicyHolderType.PARENT;
    }
    if (normalizedName.includes('child') || normalizedName.includes('son') || normalizedName.includes('daughter')) {
      return PolicyHolderType.CHILD;
    }
    
    return PolicyHolderType.OTHER; // Default for unrecognized types
  }

  /**
   * INSURANCE COB MIGRATION
   */
  
  private async migrateInsuranceCOB(): Promise<void> {
    logger.info('Migrating Insurance COB (Coordination of Benefits)...');
    
    const query = `
      SELECT 
        sb_insurance_cob_key,
        sb_insurance_cob_name
      FROM sb_insurance_cob
      ORDER BY sb_insurance_cob_key
    `;
    
    const records = await this.executeMSSQLQuery(query);
    logger.info(`Fetched ${records.length} insurance COB records from MSSQL`);
    
    if (records.length === 0) {
      logger.warn('No insurance COB records found in MSSQL');
      return;
    }
    
    // Transform and map COB records
    const transformedRecords = records.map((record: MSSQLInsuranceCOBRecord) => 
      this.transformCOBRecord(record)
    );
    
    // Clear existing collection
    await InsuranceCOBModel.deleteMany({});
    
    // Insert new records
    await InsuranceCOBModel.insertMany(transformedRecords);
    
    logger.info(`Successfully migrated ${transformedRecords.length} insurance COB records`);
  }

  private transformCOBRecord(record: MSSQLInsuranceCOBRecord): Partial<IInsuranceCOB> {
    const status = this.mapCOBStatus(record.sb_insurance_cob_name);
    
    return {
      cobKey: record.sb_insurance_cob_key,
      cobName: record.sb_insurance_cob_name?.trim() || '',
      cobStatus: status,
      dateCreated: new Date(),
      dateModified: new Date()
    };
  }

  private mapCOBStatus(name: string): COBStatus {
    const normalizedName = name?.toLowerCase().trim() || '';
    
    if (normalizedName.includes('yes') || normalizedName.includes('true') || normalizedName === '1') {
      return COBStatus.YES;
    }
    
    return COBStatus.NO; // Default to NO for safety
  }

  /**
   * Create indexes for all insurance reference collections
   */
  private async createAllIndexes(): Promise<void> {
    logger.info('Creating indexes for insurance reference collections...');
    
    // Insurance Frequency indexes
    await Promise.all([
      InsuranceFrequencyModel.collection.createIndex({ frequencyKey: 1 }, { unique: true }),
      InsuranceFrequencyModel.collection.createIndex({ frequencyType: 1 }),
      InsuranceFrequencyModel.collection.createIndex({ frequencyName: 1 })
    ]);
    
    // Insurance Policy Holder indexes
    await Promise.all([
      InsurancePolicyHolderModel.collection.createIndex({ policyHolderKey: 1 }, { unique: true }),
      InsurancePolicyHolderModel.collection.createIndex({ policyHolderType: 1 }),
      InsurancePolicyHolderModel.collection.createIndex({ policyHolderName: 1 })
    ]);
    
    // Insurance COB indexes
    await Promise.all([
      InsuranceCOBModel.collection.createIndex({ cobKey: 1 }, { unique: true }),
      InsuranceCOBModel.collection.createIndex({ cobStatus: 1 }),
      InsuranceCOBModel.collection.createIndex({ cobName: 1 })
    ]);
    
    logger.info('Successfully created indexes for all insurance reference collections');
  }

  /**
   * Validate all insurance reference migrations
   */
  private async validateAllMigrations(): Promise<void> {
    logger.info('Validating all insurance reference migrations...');
    
    const [frequencyCount, policyHolderCount, cobCount] = await Promise.all([
      InsuranceFrequencyModel.countDocuments(),
      InsurancePolicyHolderModel.countDocuments(),
      InsuranceCOBModel.countDocuments()
    ]);
    
    logger.info('Insurance Reference Migration Validation:');
    logger.info(`Insurance Frequencies: ${frequencyCount} records`);
    logger.info(`Insurance Policy Holders: ${policyHolderCount} records`);
    logger.info(`Insurance COB Options: ${cobCount} records`);
    
    // Validate frequency distribution
    const frequencyTypes = await InsuranceFrequencyModel.aggregate([
      { $group: { _id: '$frequencyType', count: { $sum: 1 } } }
    ]);
    logger.info('Frequency type distribution:', frequencyTypes);
    
    // Validate policy holder distribution
    const policyHolderTypes = await InsurancePolicyHolderModel.aggregate([
      { $group: { _id: '$policyHolderType', count: { $sum: 1 } } }
    ]);
    logger.info('Policy holder type distribution:', policyHolderTypes);
    
    // Validate COB distribution
    const cobStatuses = await InsuranceCOBModel.aggregate([
      { $group: { _id: '$cobStatus', count: { $sum: 1 } } }
    ]);
    logger.info('COB status distribution:', cobStatuses);
    
    // Check for data integrity issues
    const [
      invalidFrequencies,
      invalidPolicyHolders,
      invalidCOBs
    ] = await Promise.all([
      InsuranceFrequencyModel.countDocuments({
        $or: [
          { frequencyKey: { $exists: false } },
          { frequencyName: { $exists: false } },
          { frequencyType: { $exists: false } }
        ]
      }),
      InsurancePolicyHolderModel.countDocuments({
        $or: [
          { policyHolderKey: { $exists: false } },
          { policyHolderName: { $exists: false } },
          { policyHolderType: { $exists: false } }
        ]
      }),
      InsuranceCOBModel.countDocuments({
        $or: [
          { cobKey: { $exists: false } },
          { cobName: { $exists: false } },
          { cobStatus: { $exists: false } }
        ]
      })
    ]);
    
    if (invalidFrequencies > 0) {
      logger.warn(`Found ${invalidFrequencies} invalid frequency records`);
    }
    
    if (invalidPolicyHolders > 0) {
      logger.warn(`Found ${invalidPolicyHolders} invalid policy holder records`);
    }
    
    if (invalidCOBs > 0) {
      logger.warn(`Found ${invalidCOBs} invalid COB records`);
    }
    
    if (invalidFrequencies === 0 && invalidPolicyHolders === 0 && invalidCOBs === 0) {
      logger.info('All insurance reference data passed validation');
    }
  }

  /**
   * Get comprehensive migration summary
   */
  public async getMigrationSummary(): Promise<{
    frequencies: {
      total: number;
      typeDistribution: Array<{ type: string; count: number }>;
    };
    policyHolders: {
      total: number;
      typeDistribution: Array<{ type: string; count: number }>;
    };
    cob: {
      total: number;
      statusDistribution: Array<{ status: string; count: number }>;
    };
    integrity: {
      hasValidData: boolean;
      issues: string[];
    };
  }> {
    const [
      frequencyCount,
      policyHolderCount,
      cobCount,
      frequencyTypes,
      policyHolderTypes,
      cobStatuses
    ] = await Promise.all([
      InsuranceFrequencyModel.countDocuments(),
      InsurancePolicyHolderModel.countDocuments(),
      InsuranceCOBModel.countDocuments(),
      InsuranceFrequencyModel.aggregate([
        { $group: { _id: '$frequencyType', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      InsurancePolicyHolderModel.aggregate([
        { $group: { _id: '$policyHolderType', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      InsuranceCOBModel.aggregate([
        { $group: { _id: '$cobStatus', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ])
    ]);
    
    // Check data integrity
    const issues: string[] = [];
    
    if (frequencyCount === 0) {issues.push('No frequency records found');}
    if (policyHolderCount === 0) {issues.push('No policy holder records found');}
    if (cobCount === 0) {issues.push('No COB records found');}
    
    // Check for required COB statuses
    const hasYesCOB = cobStatuses.some(item => item._id === COBStatus.YES);
    const hasNoCOB = cobStatuses.some(item => item._id === COBStatus.NO);
    
    if (!hasYesCOB) {issues.push('Missing YES COB option');}
    if (!hasNoCOB) {issues.push('Missing NO COB option');}
    
    return {
      frequencies: {
        total: frequencyCount,
        typeDistribution: frequencyTypes.map(item => ({
          type: item._id,
          count: item.count
        }))
      },
      policyHolders: {
        total: policyHolderCount,
        typeDistribution: policyHolderTypes.map(item => ({
          type: item._id,
          count: item.count
        }))
      },
      cob: {
        total: cobCount,
        statusDistribution: cobStatuses.map(item => ({
          status: item._id,
          count: item.count
        }))
      },
      integrity: {
        hasValidData: issues.length === 0,
        issues
      }
    };
  }

  // Implement abstract methods (not used in this unified migration)
  protected async getTotalCount(): Promise<number> {
    return 0; // Not applicable for unified migration
  }

  protected async fetchBatch(offset: number): Promise<any[]> {
    return []; // Not applicable for unified migration
  }

  protected transformRecord(record: any): any {
    return {}; // Not applicable for unified migration
  }

  protected async processBatch(records: any[]): Promise<void> {
    // Not applicable for unified migration
  }

  protected async createIndexes(): Promise<void> {
    await this.createAllIndexes();
  }

  protected async validateMigration(): Promise<void> {
    await this.validateAllMigrations();
  }
}
