import { BaseMigration, MigrationResult } from './BaseMigration';
import { ClientModel } from '@/models/Client';
import { DataFilter } from './DataFilter';
import { logger } from '@/utils/logger';

interface MSSQLClientRecord {
  sb_clients_id: string;
  sb_clients_key?: number;
  sb_clients_first_name: string;
  sb_clients_last_name: string;
  sb_clients_name: string;
  sb_clients_name_for_autocomplete?: string;
  sb_clients_birthday_day?: string;
  sb_clients_birthday_month?: string;
  sb_clients_birthday_year?: string;
  sb_clients_gender?: string;
  sb_clients_address?: string;
  sb_clients_apartment?: string;
  sb_clients_city: string;
  sb_clients_province: string;
  sb_clients_postal_code_1?: string;
  sb_clients_postal_code_2?: string;
  sb_clients_home_country_code?: string;
  sb_clients_home_area_code?: string;
  sb_clients_home_phone_number?: string;
  sb_clients_cell_country_code?: string;
  sb_clients_cell_area_code?: string;
  sb_clients_cell_phone_number?: string;
  sb_clients_work_country_code?: string;
  sb_clients_work_area_code?: string;
  sb_clients_work_phone_number?: string;
  sb_clients_work_phone_extension?: string;
  sb_clients_email?: string;
  sb_clients_company?: string;
  sb_clients_company_other?: string;
  sb_clients_family_md?: string;
  sb_clients_referring_md?: string;
  sb_clients_csr_name?: string;
  sb_clients_location?: string;
  sb_default_clinic: string;
  sb_clients_date_created?: Date;
  sb_clients_referral_type?: number;
  sb_clients_referral_subtype?: number;
  
  // Insurance fields
  sb_clients_1st_insurance_dpa?: string;
  sb_clients_1st_insurance_policy_holder?: string;
  sb_clients_1st_insurance_cob?: string;
  sb_clients_1st_insurance_policy_holder_name?: string;
  sb_clients_1st_insurance_policy_holder_birthday_day?: string;
  sb_clients_1st_insurance_policy_holder_birthday_month?: string;
  sb_clients_1st_insurance_policy_holder_birthday_year?: string;
  sb_clients_1st_insurance_company?: string;
  sb_clients_1st_insurance_company_address?: string;
  sb_clients_1st_insurance_city?: string;
  sb_clients_1st_insurance_province?: string;
  sb_clients_1st_insurance_postal_code_1?: string;
  sb_clients_1st_insurance_postal_code_2?: string;
  sb_clients_1st_insurance_group_number?: string;
  sb_clients_1st_insurance_certificate_number?: string;
  // Add 2nd and 3rd insurance fields as needed...
}

export class ClientMigration extends BaseMigration {
  private readonly MSSQL_QUERY = `
    SELECT 
      sb_clients_id,
      sb_clients_key,
      sb_clients_first_name,
      sb_clients_last_name,
      sb_clients_name,
      sb_clients_name_for_autocomplete,
      sb_clients_birthday_day,
      sb_clients_birthday_month,
      sb_clients_birthday_year,
      sb_clients_gender,
      sb_clients_address,
      sb_clients_apartment,
      sb_clients_city,
      sb_clients_province,
      sb_clients_postal_code_1,
      sb_clients_postal_code_2,
      sb_clients_home_country_code,
      sb_clients_home_area_code,
      sb_clients_home_phone_number,
      sb_clients_cell_country_code,
      sb_clients_cell_area_code,
      sb_clients_cell_phone_number,
      sb_clients_work_country_code,
      sb_clients_work_area_code,
      sb_clients_work_phone_number,
      sb_clients_work_phone_extension,
      sb_clients_email,
      sb_clients_company,
      sb_clients_company_other,
      sb_clients_family_md,
      sb_clients_referring_md,
      sb_clients_csr_name,
      sb_clients_location,
      sb_default_clinic,
      sb_clients_date_created,
      sb_clients_referral_type,
      sb_clients_referral_subtype,
      sb_clients_1st_insurance_dpa,
      sb_clients_1st_insurance_policy_holder,
      sb_clients_1st_insurance_cob,
      sb_clients_1st_insurance_policy_holder_name,
      sb_clients_1st_insurance_policy_holder_birthday_day,
      sb_clients_1st_insurance_policy_holder_birthday_month,
      sb_clients_1st_insurance_policy_holder_birthday_year,
      sb_clients_1st_insurance_company,
      sb_clients_1st_insurance_company_address,
      sb_clients_1st_insurance_city,
      sb_clients_1st_insurance_province,
      sb_clients_1st_insurance_postal_code_1,
      sb_clients_1st_insurance_postal_code_2,
      sb_clients_1st_insurance_group_number,
      sb_clients_1st_insurance_certificate_number
    FROM sb_clients 
    WHERE sb_clients_id IS NOT NULL
    ORDER BY sb_clients_id
  `;

  async migrate(): Promise<MigrationResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let migratedCount = 0;

    try {
      logger.info('Starting Client migration from MSSQL to MongoDB');

      // This would be replaced with actual MSSQL connection
      const allMssqlRecords = await this.fetchMSSQLData();
      
      logger.info(`📊 Fetched ${allMssqlRecords.length} client records from MSSQL`);

      // Apply VISIO business rules to filter clinics and client fields
      const clinicFilteredRecords = DataFilter.filterRecordsByClinic(
        allMssqlRecords.map(record => ({ ...record, clinicName: record.sb_default_clinic }))
      );
      
      // Apply client field filtering based on VISIO requirements
      const mssqlRecords = clinicFilteredRecords.map(record => 
        DataFilter.filterClientData(record)
      );
      
      DataFilter.logFilterStats(allMssqlRecords.length, mssqlRecords.length, 'Client Records Filter');
      logger.info(`✅ Retained ${mssqlRecords.length} client records after applying VISIO filters`);

      // Validate records efficiently
      const { valid: validRecords, invalid: invalidRecords } = this.validateRecords(
        mssqlRecords,
        this.validateClientRecord.bind(this)
      );

      if (invalidRecords.length > 0) {
        logger.warn(`Found ${invalidRecords.length} invalid records`);
        invalidRecords.slice(0, 5).map(record => 
          errors.push(`Invalid record: ${record.sb_clients_id} - Missing required fields`)
        );
      }

      // Process in optimized batches
      const mongoDocuments = await this.processBatch(
        validRecords,
        this.transformClientBatch.bind(this)
      );

      if (!this.options.dryRun) {
        // Insert in batches to MongoDB efficiently
        const insertResults = await this.processBatch(
          mongoDocuments,
          this.insertClientBatch.bind(this)
        );

        migratedCount = insertResults.reduce((sum, batch) => sum + batch.length, 0);
      } else {
        migratedCount = mongoDocuments.length;
        logger.info('DRY RUN: Would have migrated', migratedCount, 'clients');
      }

      return this.createResult(
        'sb_clients',
        mssqlRecords.length,
        migratedCount,
        errors,
        startTime
      );

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMessage);
      
      return this.createResult(
        'sb_clients',
        0,
        migratedCount,
        errors,
        startTime
      );
    }
  }

  /**
   * Fetch data from MSSQL (to be implemented with actual connection)
   */
  private async fetchMSSQLData(): Promise<MSSQLClientRecord[]> {
    // In real implementation, this would use the MSSQL connection
    // For now, return mock data structure
    
    // TODO: Replace with actual MSSQL query execution
    // const pool = await sql.connect(mssqlConfig);
    // const result = await pool.request().query(this.MSSQL_QUERY);
    // return result.recordset;
    
    logger.info('TODO: Implement actual MSSQL connection');
    return [];
  }

  /**
   * Validate individual client record
   */
  private validateClientRecord(record: MSSQLClientRecord): boolean {
    return Boolean(
      record.sb_clients_id &&
      record.sb_clients_first_name &&
      record.sb_clients_last_name &&
      record.sb_clients_city &&
      record.sb_clients_province &&
      record.sb_default_clinic
    );
  }

  /**
   * Transform MSSQL batch to MongoDB documents efficiently
   */
  private async transformClientBatch(batch: MSSQLClientRecord[]): Promise<any[]> {
    // Use efficient map transformation instead of forEach
    return batch.map(record => this.transformClientRecord(record));
  }

  /**
   * Transform single MSSQL record to MongoDB document
   */
  private transformClientRecord(record: MSSQLClientRecord): any {
    const insurance = [];

    // Build 1st insurance if exists
    if (record.sb_clients_1st_insurance_company) {
      insurance.push({
        type: '1st',
        dpa: record.sb_clients_1st_insurance_dpa === 'Y',
        policyHolder: record.sb_clients_1st_insurance_policy_holder || 'self',
        cob: record.sb_clients_1st_insurance_cob || 'NO',
        policyHolderName: record.sb_clients_1st_insurance_policy_holder_name || '',
        birthday: {
          day: record.sb_clients_1st_insurance_policy_holder_birthday_day || '',
          month: record.sb_clients_1st_insurance_policy_holder_birthday_month || '',
          year: record.sb_clients_1st_insurance_policy_holder_birthday_year || ''
        },
        company: record.sb_clients_1st_insurance_company,
        companyAddress: record.sb_clients_1st_insurance_company_address || '',
        city: record.sb_clients_1st_insurance_city || '',
        province: record.sb_clients_1st_insurance_province || '',
        postalCode: {
          first3: record.sb_clients_1st_insurance_postal_code_1 || '',
          last3: record.sb_clients_1st_insurance_postal_code_2 || ''
        },
        groupNumber: record.sb_clients_1st_insurance_group_number || '',
        certificateNumber: record.sb_clients_1st_insurance_certificate_number || '',
        coverage: {
          numberOfOrthotics: '',
          totalAmountPerOrthotic: 0,
          totalAmountPerYear: 0,
          frequency: '',
          numOrthoticsPerYear: '',
          orthopedicShoes: 0,
          compressionStockings: 0,
          physiotherapy: 0,
          massage: 0,
          other: 0
        }
      });
    }

    return {
      clientId: record.sb_clients_id,
      clientKey: record.sb_clients_key,
      personalInfo: {
        firstName: record.sb_clients_first_name,
        lastName: record.sb_clients_last_name,
        fullName: record.sb_clients_name,
        fullNameForAutocomplete: record.sb_clients_name_for_autocomplete || record.sb_clients_name,
        birthday: {
          day: record.sb_clients_birthday_day || '',
          month: record.sb_clients_birthday_month || '',
          year: record.sb_clients_birthday_year || ''
        },
        gender: this.normalizeGender(record.sb_clients_gender)
      },
      contact: {
        address: {
          street: record.sb_clients_address || '',
          apartment: record.sb_clients_apartment || '',
          city: record.sb_clients_city,
          province: record.sb_clients_province,
          postalCode: {
            first3: record.sb_clients_postal_code_1 || '',
            last3: record.sb_clients_postal_code_2 || '',
            full: this.buildFullPostalCode(
              record.sb_clients_postal_code_1,
              record.sb_clients_postal_code_2
            )
          }
        },
        phones: {
          ...(record.sb_clients_home_phone_number && {
            home: {
              countryCode: record.sb_clients_home_country_code || '1',
              areaCode: record.sb_clients_home_area_code || '',
              number: record.sb_clients_home_phone_number,
              full: this.buildFullPhone(
                record.sb_clients_home_area_code,
                record.sb_clients_home_phone_number
              )
            }
          }),
          ...(record.sb_clients_cell_phone_number && {
            cell: {
              countryCode: record.sb_clients_cell_country_code || '1',
              areaCode: record.sb_clients_cell_area_code || '',
              number: record.sb_clients_cell_phone_number,
              full: this.buildFullPhone(
                record.sb_clients_cell_area_code,
                record.sb_clients_cell_phone_number
              )
            }
          }),
          ...(record.sb_clients_work_phone_number && {
            work: {
              countryCode: record.sb_clients_work_country_code || '1',
              areaCode: record.sb_clients_work_area_code || '',
              number: record.sb_clients_work_phone_number,
              extension: record.sb_clients_work_phone_extension || '',
              full: this.buildFullPhone(
                record.sb_clients_work_area_code,
                record.sb_clients_work_phone_number,
                record.sb_clients_work_phone_extension
              )
            }
          })
        },
        email: record.sb_clients_email || '',
        company: record.sb_clients_company || '',
        companyOther: record.sb_clients_company_other || ''
      },
      medical: {
        familyMD: record.sb_clients_family_md || '',
        referringMD: record.sb_clients_referring_md || '',
        csrName: record.sb_clients_csr_name || '',
        location: record.sb_clients_location || ''
      },
      insurance,
      clinics: [record.sb_default_clinic],
      defaultClinic: record.sb_default_clinic,
      isActive: true,
      dateCreated: record.sb_clients_date_created || new Date(),
      referralType: record.sb_clients_referral_type || 0,
      referralSubtype: record.sb_clients_referral_subtype || 0
    };
  }

  /**
   * Insert batch to MongoDB efficiently
   */
  private async insertClientBatch(batch: any[]): Promise<any[]> {
    if (this.options.skipExisting) {
      // Use efficient bulk operations to check for existing records
      const existingClientIds = await ClientModel.find(
        { clientId: { $in: batch.map(doc => doc.clientId) } },
        { clientId: 1 }
      ).lean();

      const existingIds = new Set(existingClientIds.map(doc => doc.clientId));
      const newDocuments = batch.filter(doc => !existingIds.has(doc.clientId));

      if (newDocuments.length === 0) {
        return [];
      }

      batch = newDocuments;
    }

    // Use insertMany for optimal performance
    const result = await ClientModel.insertMany(batch, { ordered: false });
    return Array.isArray(result) ? result : [result];
  }

  /**
   * Utility functions for data transformation
   */
  private normalizeGender(gender?: string): 'Male' | 'Female' | 'Other' {
    if (!gender) return 'Other';
    const normalized = gender.toLowerCase();
    if (normalized.includes('m') || normalized.includes('male')) return 'Male';
    if (normalized.includes('f') || normalized.includes('female')) return 'Female';
    return 'Other';
  }

  private buildFullPostalCode(first3?: string, last3?: string): string {
    if (first3 && last3) {
      return `${first3.toUpperCase()} ${last3.toUpperCase()}`;
    }
    return '';
  }

  private buildFullPhone(areaCode?: string, number?: string, extension?: string): string {
    if (!areaCode || !number) return '';
    
    const formatted = `(${areaCode}) ${number}`;
    return extension ? `${formatted} ext. ${extension}` : formatted;
  }
}
