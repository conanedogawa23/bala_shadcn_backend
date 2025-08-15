import { BaseMigration, MigrationResult } from './BaseMigration';
import { InsuranceCompanyAddressModel } from '../models/InsuranceCompanyAddress';
import { DataFilter } from './DataFilter';
import { logger } from '../utils/logger';

interface MSSQLInsuranceCompanyAddressRecord {
  sb_1st_insurance_company_address_key: number;
  sb_1st_insurance_company_address_name: string;
  sb_1st_insurance_company_name: string;
  sb_1st_insurance_company_city: string;
  sb_1st_insurance_company_province: string;
  sb_1st_insurance_company_postalCode_first3Digits: string;
  sb_1st_insurance_company_postalCode_last3Digits: string;
}

export class InsuranceCompanyAddressMigration extends BaseMigration {
  protected tableName = 'sb_1st_insurance_company_address';
  protected modelName = 'InsuranceCompanyAddress';

  constructor() {
    super();
  }

  /**
   * Transform MSSQL record to MongoDB document
   */
  protected transformRecord(record: MSSQLInsuranceCompanyAddressRecord): any {
    return {
      addressKey: record.sb_1st_insurance_company_address_key,
      addressName: (record.sb_1st_insurance_company_address_name || '').trim(),
      companyName: (record.sb_1st_insurance_company_name || '').trim(),
      city: (record.sb_1st_insurance_company_city || '').trim(),
      province: (record.sb_1st_insurance_company_province || '').trim(),
      postalCodeFirst3: (record.sb_1st_insurance_company_postalCode_first3Digits || '').trim().toUpperCase(),
      postalCodeLast3: (record.sb_1st_insurance_company_postalCode_last3Digits || '').trim().toUpperCase(),
      fullPostalCode: this.buildFullPostalCode(
        record.sb_1st_insurance_company_postalCode_first3Digits,
        record.sb_1st_insurance_company_postalCode_last3Digits
      ),
      dateCreated: new Date(),
      dateModified: new Date()
    };
  }

  /**
   * Validate transformed record
   */
  protected validateRecord(record: any): boolean {
    // Required fields
    if (!record.addressKey || typeof record.addressKey !== 'number') {
      logger.warn(`Invalid addressKey: ${record.addressKey}`);
      return false;
    }

    if (!record.addressName || record.addressName.trim().length === 0) {
      logger.warn(`Missing addressName for key: ${record.addressKey}`);
      return false;
    }

    if (!record.companyName || record.companyName.trim().length === 0) {
      logger.warn(`Missing companyName for key: ${record.addressKey}`);
      return false;
    }

    if (!record.city || record.city.trim().length === 0) {
      logger.warn(`Missing city for key: ${record.addressKey}`);
      return false;
    }

    if (!record.province || record.province.trim().length === 0) {
      logger.warn(`Missing province for key: ${record.addressKey}`);
      return false;
    }

    return true;
  }

  /**
   * Apply VISIO-specific filters
   */
  protected applyVisioFilters(records: any[]): any[] {
    // Apply base VISIO filters first
    let filteredRecords = DataFilter.applyVISIOFilters(records);

    // Insurance address specific filters
    filteredRecords = filteredRecords.filter(record => {
      // Filter out addresses with invalid postal codes
      if (!this.isValidPostalCode(record.postalCodeFirst3, record.postalCodeLast3)) {
        return false;
      }

      // Filter out obviously test/invalid data
      const addressName = (record.addressName || '').toLowerCase();
      const companyName = (record.companyName || '').toLowerCase();
      
      if (addressName.includes('test') || 
          addressName.includes('demo') ||
          companyName.includes('test') ||
          companyName.includes('demo')) {
        return false;
      }

      return true;
    });

    return filteredRecords;
  }

  /**
   * Execute the migration
   */
  async migrate(): Promise<MigrationResult> {
    const startTime = Date.now();
    try {
      logger.info(`Starting ${this.modelName} migration from ${this.tableName}`);

      // Get total count
      const totalCount = await this.getTotalCount();
      logger.info(`Total ${this.modelName} records in MSSQL: ${totalCount}`);

      if (totalCount === 0) {
        logger.warn(`No records found in ${this.tableName}`);
        return {
          success: true,
          totalRecords: 0,
          migratedRecords: 0,
          skippedRecords: 0,
          errors: [],
          duration: Date.now() - startTime,
          tableName: this.tableName
        };
      }

      // Check if migration already completed
      const existingCount = await InsuranceCompanyAddressModel.countDocuments();
      if (existingCount > 0) {
        logger.info(`Found ${existingCount} existing documents. Skipping migration.`);
        return {
          success: true,
          totalRecords: totalCount,
          migratedRecords: 0,
          skippedRecords: existingCount,
          errors: [],
          duration: Date.now() - startTime,
          tableName: this.tableName
        };
      }

      // Fetch all records from MSSQL
      const query = `
        SELECT 
          ia.id,
          ia.company_name,
          ia.address_key,
          ia.address1,
          ia.address2,
          ia.city,
          ia.province,
          ia.postal_code,
          ia.country,
          ia.is_active,
          ia.date_created,
          ia.date_modified
        FROM insurance_company_address ia
        WHERE ia.is_active = 1
        ORDER BY ia.id
      `;
      const mssqlRecords = await this.executeMSSQLQuery(query);
      logger.info(`Fetched ${mssqlRecords.length} records from MSSQL`);

      // Transform records
      const transformedRecords = mssqlRecords.map((record: any) => this.transformRecord(record));
      logger.info(`Transformed ${transformedRecords.length} records`);

      // Apply VISIO filters
      const filteredRecords = this.applyVisioFilters(transformedRecords);
      logger.info(`Applied VISIO filters: ${filteredRecords.length} records remaining`);

      // Validate records
      const validRecords = filteredRecords.filter(record => this.validateRecord(record));
      logger.info(`Validated ${validRecords.length} records`);

      if (validRecords.length === 0) {
        logger.warn('No valid records to migrate');
        return {
          success: true,
          totalRecords: totalCount,
          migratedRecords: 0,
          skippedRecords: totalCount,
          errors: [],
          duration: Date.now() - startTime,
          tableName: this.tableName
        };
      }

      // Batch insert
      await this.batchInsert(validRecords, InsuranceCompanyAddressModel);

      // Verify migration
      const finalCount = await InsuranceCompanyAddressModel.countDocuments();
      logger.info(`Migration completed. Final count: ${finalCount}`);

      // Create indexes
      await this.createIndexes();

      return {
        success: true,
        totalRecords: totalCount,
        migratedRecords: finalCount,
        skippedRecords: 0,
        errors: [],
        duration: Date.now() - startTime,
        tableName: this.tableName
      };
    } catch (error) {
      logger.error(`Error during ${this.modelName} migration:`, error);
      throw error;
    }
  }

  /**
   * Create additional indexes for insurance addresses
   */
  private async createIndexes(): Promise<void> {
    try {
      logger.info('Creating indexes for InsuranceCompanyAddress collection');

      await Promise.all([
        InsuranceCompanyAddressModel.collection.createIndex(
          { addressKey: 1 }, 
          { unique: true, background: true }
        ),
        InsuranceCompanyAddressModel.collection.createIndex(
          { companyName: 1, city: 1 }, 
          { background: true }
        ),
        InsuranceCompanyAddressModel.collection.createIndex(
          { province: 1, city: 1 }, 
          { background: true }
        ),
        InsuranceCompanyAddressModel.collection.createIndex(
          { fullPostalCode: 1 }, 
          { background: true }
        )
      ]);

      logger.info('Indexes created successfully');
    } catch (error) {
      logger.error('Error creating indexes:', error);
      // Don't throw - indexes are not critical for migration success
    }
  }

  /**
   * Build full postal code from components
   */
  private buildFullPostalCode(first3?: string, last3?: string): string {
    const firstPart = (first3 || '').trim().toUpperCase();
    const lastPart = (last3 || '').trim().toUpperCase();
    
    if (firstPart && lastPart) {
      return `${firstPart} ${lastPart}`;
    }
    return firstPart + lastPart;
  }

  /**
   * Validate postal code format
   */
  private isValidPostalCode(first3?: string, last3?: string): boolean {
    if (!first3 || !last3) {return false;}
    
    const firstPart = first3.trim();
    const lastPart = last3.trim();
    
    // Canadian postal code format: A1A 1A1
    const canadianPattern = /^[A-Z]\d[A-Z]$/;
    const numberPattern = /^\d[A-Z]\d$/;
    
    return canadianPattern.test(firstPart) && numberPattern.test(lastPart);
  }

  /**
   * Get sample records for verification
   */
  async getSampleRecords(limit = 5): Promise<any[]> {
    const query = `
      SELECT TOP ${limit} 
        sb_1st_insurance_company_address_key,
        sb_1st_insurance_company_address_name,
        sb_1st_insurance_company_name,
        sb_1st_insurance_company_city,
        sb_1st_insurance_company_province,
        sb_1st_insurance_company_postalCode_first3Digits,
        sb_1st_insurance_company_postalCode_last3Digits
      FROM ${this.tableName}
      ORDER BY sb_1st_insurance_company_address_key
    `;
    
    return this.executeMSSQLQuery(query);
  }
}
