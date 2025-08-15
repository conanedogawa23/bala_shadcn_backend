import { BaseMigration, MigrationResult } from './BaseMigration';
import { ClientClinicRelationshipModel } from '@/models/ClientClinicRelationship';
import { logger } from '@/utils/logger';

interface MSSQLClientClinicRecord {
  relationship_id: number;
  client_id: string;
  clinic_name: string;
  relationship_type?: string;
  start_date?: Date;
  end_date?: Date;
  is_active?: boolean;
  is_primary?: boolean;
  can_schedule?: boolean;
  can_view_records?: boolean;
  can_receive_bills?: boolean;
  can_authorize_insurance?: boolean;
  referred_by?: string;
  referral_date?: Date;
  referral_reason?: string;
  notes?: string;
  preferred_practitioner?: string;
  billing_street?: string;
  billing_city?: string;
  billing_province?: string;
  billing_postal_code?: string;
  preferred_payment_method?: string;
  insurance_primary?: boolean;
  special_instructions?: string;
  total_appointments?: number;
  completed_appointments?: number;
  cancelled_appointments?: number;
  no_show_appointments?: number;
  last_appointment_date?: Date;
  total_amount_billed?: number;
  total_amount_paid?: number;
  average_appointment_duration?: number;
  created_date?: Date;
  modified_date?: Date;
  created_by?: string;
  modified_by?: string;
}

export class ClientClinicRelationshipMigration extends BaseMigration {
  private readonly MSSQL_QUERY = `
    SELECT 
      relationship_id,
      client_id,
      clinic_name,
      relationship_type,
      start_date,
      end_date,
      is_active,
      is_primary,
      can_schedule,
      can_view_records,
      can_receive_bills,
      can_authorize_insurance,
      referred_by,
      referral_date,
      referral_reason,
      notes,
      preferred_practitioner,
      billing_street,
      billing_city,
      billing_province,
      billing_postal_code,
      preferred_payment_method,
      insurance_primary,
      special_instructions,
      total_appointments,
      completed_appointments,
      cancelled_appointments,
      no_show_appointments,
      last_appointment_date,
      total_amount_billed,
      total_amount_paid,
      average_appointment_duration,
      created_date,
      modified_date,
      created_by,
      modified_by
    FROM sb_client_and_clinic 
    WHERE relationship_id IS NOT NULL 
      AND client_id IS NOT NULL 
      AND clinic_name IS NOT NULL
    ORDER BY relationship_id
  `;

  async migrate(): Promise<MigrationResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let migratedCount = 0;

    try {
      logger.info('🚀 Starting Client-Clinic Relationship migration (34,918+ records)');

      // Fetch MSSQL data (to be implemented with actual MSSQL connection)
      const mssqlRecords = await this.fetchMSSQLData();
      
      logger.info(`📊 Fetched ${mssqlRecords.length} client-clinic relationship records from MSSQL`);

      // Validate records efficiently using reduce instead of forEach
      const { valid: validRecords, invalid: invalidRecords } = this.validateRecords(
        mssqlRecords,
        this.validateRelationshipRecord.bind(this)
      );

      if (invalidRecords.length > 0) {
        logger.warn(`⚠️  Found ${invalidRecords.length} invalid relationship records`);
        // Use efficient slice and map instead of forEach
        invalidRecords.slice(0, 5).map(record => 
          errors.push(`Invalid relationship record: ${record.relationship_id} - Missing required fields`)
        );
      }

      // Process in optimized batches to avoid memory issues
      const mongoDocuments = await this.processBatch(
        validRecords,
        this.transformRelationshipBatch.bind(this)
      );

      this.logProgress('sb_client_and_clinic', mongoDocuments.length, validRecords.length, errors.length);

      if (!this.options.dryRun) {
        // Insert in batches to MongoDB efficiently
        const insertResults = await this.processBatch(
          mongoDocuments,
          this.insertRelationshipBatch.bind(this)
        );

        // Use efficient reduce instead of forEach to sum results
        migratedCount = insertResults.reduce((sum, batch) => sum + batch.length, 0);
      } else {
        migratedCount = mongoDocuments.length;
        logger.info('🧪 DRY RUN: Would have migrated', migratedCount, 'client-clinic relationships');
      }

      return this.createResult(
        'sb_client_and_clinic',
        mssqlRecords.length,
        migratedCount,
        errors,
        startTime
      );

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMessage);
      logger.error('💥 Client-Clinic Relationship migration failed:', error);
      
      return this.createResult(
        'sb_client_and_clinic',
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
  private async fetchMSSQLData(): Promise<MSSQLClientClinicRecord[]> {
    // TODO: Implement actual MSSQL query execution
    // const pool = await sql.connect(mssqlConfig);
    // const result = await pool.request().query(this.MSSQL_QUERY);
    // return result.recordset;
    
    logger.info('📝 TODO: Implement actual MSSQL connection for client-clinic relationships');
    return [];
  }

  /**
   * Validate individual relationship record
   */
  private validateRelationshipRecord(record: MSSQLClientClinicRecord): boolean {
    return Boolean(
      record.relationship_id &&
      record.client_id &&
      record.clinic_name
    );
  }

  /**
   * Transform MSSQL batch to MongoDB documents efficiently
   */
  private async transformRelationshipBatch(batch: MSSQLClientClinicRecord[]): Promise<any[]> {
    // Use efficient map transformation instead of forEach
    return batch.map(record => this.transformRelationshipRecord(record));
  }

  /**
   * Transform single MSSQL record to MongoDB document
   */
  private transformRelationshipRecord(record: MSSQLClientClinicRecord): any {
    return {
      id: record.relationship_id,
      clientId: record.client_id,
      clinicName: record.clinic_name,
      relationshipType: this.normalizeRelationshipType(record.relationship_type),
      startDate: record.start_date || new Date(),
      endDate: record.end_date || undefined,
      isActive: record.is_active !== false,
      isPrimary: record.is_primary || false,
      
      // Access and permissions
      permissions: {
        canSchedule: record.can_schedule !== false,
        canViewRecords: record.can_view_records !== false,
        canReceiveBills: record.can_receive_bills !== false,
        canAuthorizeInsurance: record.can_authorize_insurance || false
      },
      
      // Relationship details
      details: {
        referredBy: record.referred_by || '',
        referralDate: record.referral_date || undefined,
        referralReason: record.referral_reason || '',
        notes: record.notes || '',
        preferredPractitioner: record.preferred_practitioner || '',
        preferredServices: [] // Will be populated from other sources if available
      },
      
      // Billing preferences
      billing: record.billing_street || record.billing_city ? {
        billingAddress: {
          street: record.billing_street || '',
          city: record.billing_city || '',
          province: record.billing_province || '',
          postalCode: record.billing_postal_code || ''
        },
        preferredPaymentMethod: record.preferred_payment_method || '',
        insurancePrimary: record.insurance_primary !== false,
        specialInstructions: record.special_instructions || ''
      } : undefined,
      
      // Analytics/Statistics
      stats: {
        totalAppointments: record.total_appointments || 0,
        completedAppointments: record.completed_appointments || 0,
        cancelledAppointments: record.cancelled_appointments || 0,
        noShowAppointments: record.no_show_appointments || 0,
        lastAppointmentDate: record.last_appointment_date || undefined,
        totalAmountBilled: record.total_amount_billed || 0,
        totalAmountPaid: record.total_amount_paid || 0,
        averageAppointmentDuration: record.average_appointment_duration || 60
      },
      
      // Administrative
      createdAt: record.created_date || new Date(),
      modifiedAt: record.modified_date || undefined,
      createdBy: record.created_by || '',
      modifiedBy: record.modified_by || ''
    };
  }

  /**
   * Insert batch to MongoDB efficiently
   */
  private async insertRelationshipBatch(batch: any[]): Promise<any[]> {
    if (this.options.skipExisting) {
      // Use efficient bulk operations to check for existing records
      const existingRelationshipIds = await ClientClinicRelationshipModel.find(
        { id: { $in: batch.map(doc => doc.id) } },
        { id: 1 }
      ).lean();

      const existingIds = new Set(existingRelationshipIds.map(doc => doc.id));
      const newDocuments = batch.filter(doc => !existingIds.has(doc.id));

      if (newDocuments.length === 0) {
        return [];
      }

      batch = newDocuments;
    }

    // Use insertMany for optimal performance
    try {
      const result = await ClientClinicRelationshipModel.insertMany(batch, { 
        ordered: false,
        writeConcern: { w: 1, j: false } // Optimize for speed
      });
      return Array.isArray(result) ? result : [result];
    } catch (error) {
      logger.error('Error inserting client-clinic relationship batch:', error);
      // Handle duplicate key errors gracefully
      if (error.code === 11000) {
        logger.warn('Duplicate key error in relationship batch, skipping duplicates');
        return [];
      }
      throw error;
    }
  }

  /**
   * Utility functions for data normalization
   */
  private normalizeRelationshipType(type?: string): 'primary' | 'secondary' | 'temporary' | 'referral' | 'inactive' {
    if (!type) {return 'primary';}
    
    const normalized = type.toLowerCase().trim();
    
    if (normalized.includes('primary') || normalized.includes('main')) {return 'primary';}
    if (normalized.includes('secondary') || normalized.includes('alternate')) {return 'secondary';}
    if (normalized.includes('temporary') || normalized.includes('temp')) {return 'temporary';}
    if (normalized.includes('referral') || normalized.includes('refer')) {return 'referral';}
    if (normalized.includes('inactive') || normalized.includes('disabled')) {return 'inactive';}
    
    return 'primary';
  }
}
