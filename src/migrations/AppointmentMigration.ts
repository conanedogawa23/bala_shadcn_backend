import { BaseMigration, MigrationResult } from './BaseMigration';
import { AppointmentModel } from '../models/Appointment';
import { DataFilter } from './DataFilter';
import { logger } from '../utils/logger';

interface MSSQLAppointmentRecord {
  ID: number;
  Type: number;
  StartDate: Date;
  EndDate: Date;
  AllDay?: boolean;
  Subject: string;
  Location?: string;
  Description?: string;
  Status: number;
  Label: number;
  ResourceID: number;
  ReminderInfo?: string;
  RecurrenceInfo?: string;
  Duration?: number;
  ClientID?: number;
  ProductKey?: number;
  BillDate?: Date;
  ReadyToBill?: boolean;
  IsActive?: boolean;
  ClinicName: string;
  InvoiceDate?: Date;
  AdvancedBilling?: boolean;
  shadowID?: number;
  AdvancedBillingId?: number;
  GroupID?: number;
}

export class AppointmentMigration extends BaseMigration {
  protected tableName = 'Appointments';
  protected modelName = 'Appointment';

  constructor() {
    super();
  }

  /**
   * Transform MSSQL record to MongoDB document
   */
  protected transformRecord(record: MSSQLAppointmentRecord): any {
    return {
      appointmentId: record.ID,
      type: record.Type || 0,
      startDate: this.parseDate(record.StartDate),
      endDate: this.parseDate(record.EndDate),
      allDay: record.AllDay || false,
      subject: (record.Subject || '').trim(),
      location: this.cleanTextContent(record.Location),
      description: this.cleanTextContent(record.Description),
      status: record.Status || 0,
      label: record.Label || 0,
      resourceId: record.ResourceID,
      reminderInfo: this.cleanTextContent(record.ReminderInfo),
      recurrenceInfo: this.cleanTextContent(record.RecurrenceInfo),
      duration: this.calculateDuration(record),
      clientId: this.convertClientId(record.ClientID),
      clientKey: record.ClientID || undefined,
      productKey: record.ProductKey || undefined,
      billDate: this.parseDate(record.BillDate),
      invoiceDate: this.parseDate(record.InvoiceDate),
      readyToBill: record.ReadyToBill || false,
      advancedBilling: record.AdvancedBilling || false,
      advancedBillingId: record.AdvancedBillingId || undefined,
      clinicName: (record.ClinicName || '').trim(),
      isActive: record.IsActive !== false, // Default to true unless explicitly false
      shadowId: record.shadowID || undefined,
      groupId: record.GroupID ? record.GroupID.toString() : undefined,
      dateCreated: new Date(),
      dateModified: new Date()
    };
  }

  /**
   * Validate transformed record
   */
  protected validateRecord(record: any): boolean {
    // Required fields validation
    if (!record.appointmentId || typeof record.appointmentId !== 'number') {
      logger.warn(`Invalid appointmentId: ${record.appointmentId}`);
      return false;
    }

    if (!record.startDate || !(record.startDate instanceof Date)) {
      logger.warn(`Invalid startDate for appointment: ${record.appointmentId}`);
      return false;
    }

    if (!record.endDate || !(record.endDate instanceof Date)) {
      logger.warn(`Invalid endDate for appointment: ${record.appointmentId}`);
      return false;
    }

    if (!record.subject || record.subject.trim().length === 0) {
      logger.warn(`Missing subject for appointment: ${record.appointmentId}`);
      return false;
    }

    if (!record.resourceId || typeof record.resourceId !== 'number') {
      logger.warn(`Invalid resourceId for appointment: ${record.appointmentId}`);
      return false;
    }

    if (!record.clinicName || record.clinicName.trim().length === 0) {
      logger.warn(`Missing clinicName for appointment: ${record.appointmentId}`);
      return false;
    }

    // Date logic validation
    if (record.endDate <= record.startDate) {
      logger.warn(`Invalid date range for appointment: ${record.appointmentId}`);
      return false;
    }

    // Duration validation
    if (record.duration && record.duration < 0) {
      logger.warn(`Invalid duration for appointment: ${record.appointmentId}`);
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

    // Appointment specific filters
    filteredRecords = filteredRecords.filter(record => {
      // Filter out appointments with test/demo data
      const subject = (record.subject || '').toLowerCase();
      if (subject.includes('test') || 
          subject.includes('demo') ||
          subject.includes('sample')) {
        return false;
      }

      // Filter out appointments with invalid dates (too old or too far future)
      const appointmentDate = record.startDate;
      const earliestValidDate = new Date('2010-01-01');
      const latestValidDate = new Date();
      latestValidDate.setFullYear(latestValidDate.getFullYear() + 5);

      if (appointmentDate < earliestValidDate || appointmentDate > latestValidDate) {
        return false;
      }

      // Filter out appointments with invalid durations (over 24 hours)
      if (record.duration && record.duration > 1440) { // 24 hours in minutes
        return false;
      }

      return true;
    });

    return filteredRecords;
  }

  /**
   * Execute the migration with batching for large dataset
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
          duration: 0,
          tableName: this.tableName
        };
      }

      // Check if migration already completed
      const existingCount = await AppointmentModel.countDocuments();
      if (existingCount > 0) {
        logger.info(`Found ${existingCount} existing documents. Skipping migration.`);
        return {
          success: true,
          totalRecords: totalCount,
          migratedRecords: 0,
          skippedRecords: existingCount,
          errors: [],
          duration: 0,
          tableName: this.tableName
        };
      }

      // Use larger batch size for appointments due to large volume
      const batchSize = 5000;
      let offset = 0;
      let totalProcessed = 0;
      let totalMigrated = 0;

      while (offset < totalCount) {
        logger.info(`Processing batch: ${offset + 1} to ${Math.min(offset + batchSize, totalCount)}`);

        // Fetch batch
        const mssqlRecords = await this.fetchRecordsBatch(batchSize, offset);
        logger.info(`Fetched ${mssqlRecords.length} records from MSSQL`);

        if (mssqlRecords.length === 0) {
          break;
        }

        // Transform records
        const transformedRecords = mssqlRecords.map(record => this.transformRecord(record));
        
        // Apply VISIO filters
        const filteredRecords = this.applyVisioFilters(transformedRecords);
        
        // Validate records
        const validRecords = filteredRecords.filter(record => this.validateRecord(record));
        
        logger.info(`Batch processing: ${mssqlRecords.length} fetched, ${filteredRecords.length} filtered, ${validRecords.length} valid`);

        if (validRecords.length > 0) {
          // Batch insert
          await this.batchInsert(validRecords, AppointmentModel);
          totalMigrated += validRecords.length;
        }

        totalProcessed += mssqlRecords.length;
        offset += batchSize;

        // Log progress
        const progress = Math.round((offset / totalCount) * 100);
        logger.info(`Migration progress: ${progress}% (${totalProcessed}/${totalCount} processed, ${totalMigrated} migrated)`);
      }

      // Verify migration
      const finalCount = await AppointmentModel.countDocuments();
      logger.info(`Migration completed. Final count: ${finalCount} (${totalMigrated} migrated)`);

      // Create indexes
      await this.createIndexes();

      // Log appointment statistics
      await this.logAppointmentStatistics();

      return {
        success: true,
        totalRecords: totalCount,
        migratedRecords: totalMigrated,
        skippedRecords: totalCount - totalMigrated,
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
   * Fetch records in batch with pagination
   */
  private async fetchRecordsBatch(limit: number, offset: number): Promise<MSSQLAppointmentRecord[]> {
    const query = `
      SELECT 
        ID,
        Type,
        StartDate,
        EndDate,
        AllDay,
        Subject,
        Location,
        Description,
        Status,
        Label,
        ResourceID,
        ReminderInfo,
        RecurrenceInfo,
        Duration,
        ClientID,
        ProductKey,
        BillDate,
        ReadyToBill,
        IsActive,
        ClinicName,
        InvoiceDate,
        AdvancedBilling,
        shadowID,
        AdvancedBillingId,
        GroupID
      FROM ${this.tableName}
      ORDER BY ID
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;
    
    return this.executeMSSQLQuery(query);
  }

  /**
   * Create additional indexes for appointments
   */
  private async createIndexes(): Promise<void> {
    try {
      logger.info('Creating indexes for Appointment collection');

      await Promise.all([
        AppointmentModel.collection.createIndex(
          { appointmentId: 1 }, 
          { unique: true, background: true }
        ),
        AppointmentModel.collection.createIndex(
          { clinicName: 1, startDate: 1 }, 
          { background: true }
        ),
        AppointmentModel.collection.createIndex(
          { clientId: 1, startDate: 1 }, 
          { background: true }
        ),
        AppointmentModel.collection.createIndex(
          { resourceId: 1, startDate: 1 }, 
          { background: true }
        ),
        AppointmentModel.collection.createIndex(
          { startDate: 1, endDate: 1 }, 
          { background: true }
        ),
        AppointmentModel.collection.createIndex(
          { billDate: 1, readyToBill: 1 }, 
          { background: true }
        ),
        AppointmentModel.collection.createIndex(
          { status: 1, isActive: 1 }, 
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
   * Log appointment statistics after migration
   */
  private async logAppointmentStatistics(): Promise<void> {
    try {
      const [
        totalAppointments,
        activeAppointments,
        completedAppointments,
        readyToBillCount,
        futureAppointments,
        pastAppointments
      ] = await Promise.all([
        AppointmentModel.countDocuments(),
        AppointmentModel.countDocuments({ isActive: true }),
        AppointmentModel.countDocuments({ status: 1 }),
        AppointmentModel.countDocuments({ readyToBill: true, invoiceDate: { $exists: false } }),
        AppointmentModel.countDocuments({ startDate: { $gte: new Date() } }),
        AppointmentModel.countDocuments({ endDate: { $lt: new Date() } })
      ]);

      // Get clinic distribution
      const clinicStats = await AppointmentModel.aggregate([
        { $group: { _id: '$clinicName', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);

      logger.info('Appointment Migration Statistics:', {
        totalAppointments,
        activeAppointments,
        completedAppointments,
        readyToBillCount,
        futureAppointments,
        pastAppointments,
        percentageActive: Math.round((activeAppointments / totalAppointments) * 100),
        percentageCompleted: Math.round((completedAppointments / totalAppointments) * 100),
        topClinics: clinicStats.map(stat => ({
          clinic: stat._id,
          appointments: stat.count
        }))
      });
    } catch (error) {
      logger.error('Error logging appointment statistics:', error);
    }
  }

  /**
   * Calculate duration from start/end dates if not provided
   */
  private calculateDuration(record: MSSQLAppointmentRecord): number {
    if (record.Duration && record.Duration > 0) {
      return record.Duration;
    }

    // Calculate from dates
    const startDate = this.parseDate(record.StartDate);
    const endDate = this.parseDate(record.EndDate);

    if (startDate && endDate) {
      return Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60));
    }

    return 30; // Default 30 minutes
  }

  /**
   * Convert numeric client ID to string
   */
  private convertClientId(clientId?: number): string | undefined {
    if (!clientId) {return undefined;}
    return clientId.toString();
  }

  /**
   * Clean text content
   */
  private cleanTextContent(text?: string): string | undefined {
    if (!text) {return undefined;}
    
    const cleaned = text.trim();
    return cleaned.length > 0 ? cleaned : undefined;
  }

  /**
   * Parse date safely
   */
  private parseDate(date?: Date | string | null): Date | undefined {
    if (!date) {return undefined;}
    
    try {
      const parsed = new Date(date);
      return isNaN(parsed.getTime()) ? undefined : parsed;
    } catch {
      return undefined;
    }
  }

  /**
   * Get sample records for verification
   */
  async getSampleRecords(limit = 5): Promise<any[]> {
    const query = `
      SELECT TOP ${limit} 
        ID,
        Type,
        StartDate,
        EndDate,
        AllDay,
        Subject,
        Location,
        Description,
        Status,
        Label,
        ResourceID,
        Duration,
        ClientID,
        ProductKey,
        ClinicName,
        IsActive
      FROM ${this.tableName}
      ORDER BY ID
    `;
    
    return this.executeMSSQLQuery(query);
  }
}
