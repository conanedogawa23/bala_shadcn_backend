import { BaseMigration, MigrationResult } from './BaseMigration';
import { ContactHistoryModel } from '@/models/ContactHistory';
import { DataFilter } from './DataFilter';
import { logger } from '@/utils/logger';

interface MSSQLContactHistoryRecord {
  contact_id: number;
  client_id?: string;
  clinic_name?: string;
  contact_type?: string;
  contact_direction?: string;
  subject?: string;
  description?: string;
  contact_date: Date;
  duration_minutes?: number;
  outcome?: string;
  follow_up_required?: boolean;
  follow_up_date?: Date;
  priority?: string;
  category?: string;
  created_by?: string;
  created_date?: Date;
  modified_date?: Date;
  is_active?: boolean;
  phone_number?: string;
  email_address?: string;
  appointment_id?: string;
  insurance_company?: string;
  claim_number?: string;
  authorization_number?: string;
}

export class ContactHistoryMigration extends BaseMigration {
  private readonly MSSQL_QUERY = `
    SELECT 
      contact_id,
      client_id,
      clinic_name,
      contact_type,
      contact_direction,
      subject,
      description,
      contact_date,
      duration_minutes,
      outcome,
      follow_up_required,
      follow_up_date,
      priority,
      category,
      created_by,
      created_date,
      modified_date,
      is_active,
      phone_number,
      email_address,
      appointment_id,
      insurance_company,
      claim_number,
      authorization_number
    FROM sb_contact_history 
    WHERE contact_id IS NOT NULL 
      AND contact_date IS NOT NULL
    ORDER BY contact_id
  `;

  async migrate(): Promise<MigrationResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let migratedCount = 0;

    try {
      logger.info('🚀 Starting Contact History migration (92,599+ records)');

      // Fetch MSSQL data (to be implemented with actual MSSQL connection)
      const allMssqlRecords = await this.fetchMSSQLData();
      
      logger.info(`📊 Fetched ${allMssqlRecords.length} contact history records from MSSQL`);

      // Apply VISIO business rules to filter clinics
      const mssqlRecords = DataFilter.filterRecordsByClinic(allMssqlRecords);
      
      DataFilter.logFilterStats(allMssqlRecords.length, mssqlRecords.length, 'Contact History Clinic Filter');
      logger.info(`✅ Retained ${mssqlRecords.length} records after applying VISIO clinic filters`);

      // Validate records efficiently using reduce instead of forEach
      const { valid: validRecords, invalid: invalidRecords } = this.validateRecords(
        mssqlRecords,
        this.validateContactRecord.bind(this)
      );

      if (invalidRecords.length > 0) {
        logger.warn(`⚠️  Found ${invalidRecords.length} invalid contact records`);
        // Use efficient slice and map instead of forEach
        invalidRecords.slice(0, 5).map(record => 
          errors.push(`Invalid contact record: ${record.contact_id} - Missing required fields`)
        );
      }

      // Process in optimized batches to avoid memory issues
      const mongoDocuments = await this.processBatch(
        validRecords,
        this.transformContactBatch.bind(this)
      );

      this.logProgress('sb_contact_history', mongoDocuments.length, validRecords.length, errors.length);

      if (!this.options.dryRun) {
        // Insert in batches to MongoDB efficiently
        const insertResults = await this.processBatch(
          mongoDocuments,
          this.insertContactBatch.bind(this)
        );

        // Use efficient reduce instead of forEach to sum results
        migratedCount = insertResults.reduce((sum, batch) => sum + batch.length, 0);
      } else {
        migratedCount = mongoDocuments.length;
        logger.info('🧪 DRY RUN: Would have migrated', migratedCount, 'contact history records');
      }

      return this.createResult(
        'sb_contact_history',
        mssqlRecords.length,
        migratedCount,
        errors,
        startTime
      );

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMessage);
      logger.error('💥 Contact History migration failed:', error);
      
      return this.createResult(
        'sb_contact_history',
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
  private async fetchMSSQLData(): Promise<MSSQLContactHistoryRecord[]> {
    // TODO: Implement actual MSSQL query execution
    // const pool = await sql.connect(mssqlConfig);
    // const result = await pool.request().query(this.MSSQL_QUERY);
    // return result.recordset;
    
    logger.info('📝 TODO: Implement actual MSSQL connection for contact history');
    return [];
  }

  /**
   * Validate individual contact record
   */
  private validateContactRecord(record: MSSQLContactHistoryRecord): boolean {
    return Boolean(
      record.contact_id &&
      record.contact_date &&
      record.contact_type
    );
  }

  /**
   * Transform MSSQL batch to MongoDB documents efficiently
   */
  private async transformContactBatch(batch: MSSQLContactHistoryRecord[]): Promise<any[]> {
    // Use efficient map transformation instead of forEach
    return batch.map(record => this.transformContactRecord(record));
  }

  /**
   * Transform single MSSQL record to MongoDB document
   */
  private transformContactRecord(record: MSSQLContactHistoryRecord): any {
    return {
      id: record.contact_id,
      clientId: record.client_id || undefined,
      clinicName: record.clinic_name || 'Unknown',
      contactType: this.normalizeContactType(record.contact_type),
      direction: this.normalizeDirection(record.contact_direction),
      subject: record.subject || '',
      description: record.description || '',
      contactDate: record.contact_date,
      duration: record.duration_minutes || undefined,
      outcome: record.outcome || '',
      followUpRequired: record.follow_up_required || false,
      followUpDate: record.follow_up_date || undefined,
      priority: this.normalizePriority(record.priority),
      category: record.category || '',
      createdBy: record.created_by || '',
      createdAt: record.created_date || record.contact_date,
      modifiedAt: record.modified_date || undefined,
      isActive: record.is_active !== false,
      
      // Communication details
      communication: {
        method: this.getMethodFromType(record.contact_type),
        phoneNumber: record.phone_number || undefined,
        emailAddress: record.email_address || undefined
      },
      
      // Appointment relation
      appointmentId: record.appointment_id || undefined,
      
      // Insurance context
      insuranceContext: record.insurance_company ? {
        insuranceCompany: record.insurance_company,
        claimNumber: record.claim_number || undefined,
        authorizationNumber: record.authorization_number || undefined
      } : undefined
    };
  }

  /**
   * Insert batch to MongoDB efficiently
   */
  private async insertContactBatch(batch: any[]): Promise<any[]> {
    if (this.options.skipExisting) {
      // Use efficient bulk operations to check for existing records
      const existingContactIds = await ContactHistoryModel.find(
        { id: { $in: batch.map(doc => doc.id) } },
        { id: 1 }
      ).lean();

      const existingIds = new Set(existingContactIds.map(doc => doc.id));
      const newDocuments = batch.filter(doc => !existingIds.has(doc.id));

      if (newDocuments.length === 0) {
        return [];
      }

      batch = newDocuments;
    }

    // Use insertMany for optimal performance
    try {
      const result = await ContactHistoryModel.insertMany(batch, { 
        ordered: false,
        writeConcern: { w: 1, j: false } // Optimize for speed
      });
      return Array.isArray(result) ? result : [result];
    } catch (error) {
      logger.error('Error inserting contact history batch:', error);
      // Handle duplicate key errors gracefully
      if (error.code === 11000) {
        logger.warn('Duplicate key error in contact history batch, skipping duplicates');
        return [];
      }
      throw error;
    }
  }

  /**
   * Utility functions for data normalization
   */
  private normalizeContactType(type?: string): 'call' | 'email' | 'sms' | 'visit' | 'note' | 'appointment' | 'other' {
    if (!type) return 'other';
    
    const normalized = type.toLowerCase().trim();
    
    if (normalized.includes('call') || normalized.includes('phone')) return 'call';
    if (normalized.includes('email') || normalized.includes('mail')) return 'email';
    if (normalized.includes('sms') || normalized.includes('text')) return 'sms';
    if (normalized.includes('visit') || normalized.includes('in-person')) return 'visit';
    if (normalized.includes('note') || normalized.includes('memo')) return 'note';
    if (normalized.includes('appointment') || normalized.includes('appt')) return 'appointment';
    
    return 'other';
  }

  private normalizeDirection(direction?: string): 'inbound' | 'outbound' | 'internal' {
    if (!direction) return 'internal';
    
    const normalized = direction.toLowerCase().trim();
    
    if (normalized.includes('in') || normalized.includes('incoming')) return 'inbound';
    if (normalized.includes('out') || normalized.includes('outgoing')) return 'outbound';
    
    return 'internal';
  }

  private normalizePriority(priority?: string): 'low' | 'medium' | 'high' | 'urgent' {
    if (!priority) return 'medium';
    
    const normalized = priority.toLowerCase().trim();
    
    if (normalized.includes('low')) return 'low';
    if (normalized.includes('high')) return 'high';
    if (normalized.includes('urgent') || normalized.includes('critical')) return 'urgent';
    
    return 'medium';
  }

  private getMethodFromType(type?: string): string {
    return this.normalizeContactType(type);
  }
}
