import { BaseMigration, MigrationResult } from './BaseMigration';
import { EventModel } from '../models/Event';
import { DataFilter } from './DataFilter';
import { logger } from '../utils/logger';

interface MSSQLEventRecord {
  event_id: number;
  event_parent_id?: number;
  user_id?: number;
  category_id?: number;
  event_title: string;
  event_desc?: string;
  event_date: Date;
  event_time?: Date;
  event_time_end?: Date;
  event_date_add: Date;
  event_user_add?: number;
  event_is_public: number; // 0 or 1
  event_is_approved: number; // 0 or 1
  event_location?: string;
  event_cost?: string;
  event_url?: string;
  custom_TextBox1?: string;
  custom_TextBox2?: string;
  custom_TextBox3?: string;
  custom_TextArea1?: string;
  custom_TextArea2?: string;
  custom_TextArea3?: string;
  custom_CheckBox1?: number; // 0 or 1
  custom_CheckBox2?: number; // 0 or 1
  custom_CheckBox3?: number; // 0 or 1
  sb_client_id?: string;
  sb_client_full_name?: string;
  sb_client_clinic_name?: string;
}

export class EventMigration extends BaseMigration {
  protected tableName = 'events';
  protected modelName = 'Event';

  constructor() {
    super();
  }

  /**
   * Transform MSSQL record to MongoDB document
   */
  protected transformRecord(record: MSSQLEventRecord): any {
    return {
      eventId: record.event_id,
      parentEventId: record.event_parent_id || undefined,
      userId: record.user_id || undefined,
      categoryId: record.category_id || undefined,
      title: (record.event_title || '').trim(),
      description: this.cleanTextContent(record.event_desc),
      eventDate: this.parseDate(record.event_date),
      eventTime: this.parseDate(record.event_time),
      eventTimeEnd: this.parseDate(record.event_time_end),
      location: this.cleanTextContent(record.event_location),
      cost: this.cleanTextContent(record.event_cost),
      url: this.cleanUrl(record.event_url),
      isPublic: this.convertBooleanFlag(record.event_is_public),
      isApproved: this.convertBooleanFlag(record.event_is_approved),
      customTextBox1: this.cleanTextContent(record.custom_TextBox1),
      customTextBox2: this.cleanTextContent(record.custom_TextBox2),
      customTextBox3: this.cleanTextContent(record.custom_TextBox3),
      customTextArea1: this.cleanTextContent(record.custom_TextArea1),
      customTextArea2: this.cleanTextContent(record.custom_TextArea2),
      customTextArea3: this.cleanTextContent(record.custom_TextArea3),
      customCheckBox1: this.convertBooleanFlag(record.custom_CheckBox1),
      customCheckBox2: this.convertBooleanFlag(record.custom_CheckBox2),
      customCheckBox3: this.convertBooleanFlag(record.custom_CheckBox3),
      clientId: this.cleanTextContent(record.sb_client_id),
      clientFullName: this.cleanTextContent(record.sb_client_full_name),
      clientClinicName: this.cleanTextContent(record.sb_client_clinic_name),
      dateAdded: this.parseDate(record.event_date_add) || new Date(),
      userAdded: record.event_user_add || undefined,
      dateCreated: new Date(),
      dateModified: new Date()
    };
  }

  /**
   * Validate transformed record
   */
  protected validateRecord(record: any): boolean {
    // Required fields
    if (!record.eventId || typeof record.eventId !== 'number') {
      logger.warn(`Invalid eventId: ${record.eventId}`);
      return false;
    }

    if (!record.title || record.title.trim().length === 0) {
      logger.warn(`Missing title for event: ${record.eventId}`);
      return false;
    }

    if (!record.eventDate || !(record.eventDate instanceof Date)) {
      logger.warn(`Invalid eventDate for event: ${record.eventId}`);
      return false;
    }

    // Validate date logic
    if (record.eventTime && record.eventTimeEnd) {
      if (record.eventTimeEnd <= record.eventTime) {
        logger.warn(`Invalid time range for event: ${record.eventId}`);
        // Don't reject, just log warning
      }
    }

    return true;
  }

  /**
   * Apply VISIO-specific filters
   */
  protected applyVisioFilters(records: any[]): any[] {
    // Apply base VISIO filters first
    let filteredRecords = DataFilter.applyVISIOFilters(records);

    // Event specific filters
    filteredRecords = filteredRecords.filter(record => {
      // Filter out test events
      const title = (record.title || '').toLowerCase();
      if (title.includes('test') || 
          title.includes('demo') ||
          title.includes('sample')) {
        return false;
      }

      // Filter out events with invalid dates
      if (!record.eventDate || record.eventDate < new Date('2000-01-01')) {
        return false;
      }

      // Filter out future events too far out (likely data errors)
      const futureLimit = new Date();
      futureLimit.setFullYear(futureLimit.getFullYear() + 10);
      if (record.eventDate > futureLimit) {
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
          duration: 0,
          tableName: this.tableName
        };
      }

      // Check if migration already completed
      const existingCount = await EventModel.countDocuments();
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

      // Fetch all records from MSSQL
      const query = `
        SELECT 
          e.event_id,
          e.event_parent_id,
          e.user_id,
          e.category_id,
          e.event_title,
          e.event_desc,
          e.event_date,
          e.event_time,
          e.event_time_end,
          e.event_location,
          e.event_cost,
          e.event_url,
          e.event_is_public,
          e.event_is_approved,
          e.custom_TextBox1,
          e.custom_TextBox2,
          e.custom_TextBox3,
          e.custom_TextArea1,
          e.custom_TextArea2,
          e.custom_TextArea3,
          e.custom_CheckBox1,
          e.custom_CheckBox2,
          e.custom_CheckBox3,
          e.sb_client_id,
          e.sb_client_full_name,
          e.sb_client_clinic_name,
          e.event_date_add,
          e.event_user_add
        FROM events e
        ORDER BY e.event_id
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
          duration: 0,
          tableName: this.tableName
        };
      }

      // Batch insert
      await this.batchInsert(validRecords, EventModel);

      // Verify migration
      const finalCount = await EventModel.countDocuments();
      logger.info(`Migration completed. Final count: ${finalCount}`);

      // Create indexes
      await this.createIndexes();

      // Log event statistics
      await this.logEventStatistics();

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
   * Create additional indexes for events
   */
  private async createIndexes(): Promise<void> {
    try {
      logger.info('Creating indexes for Event collection');

      await Promise.all([
        EventModel.collection.createIndex(
          { eventId: 1 }, 
          { unique: true, background: true }
        ),
        EventModel.collection.createIndex(
          { eventDate: 1, isPublic: 1, isApproved: 1 }, 
          { background: true }
        ),
        EventModel.collection.createIndex(
          { clientId: 1, eventDate: 1 }, 
          { background: true }
        ),
        EventModel.collection.createIndex(
          { categoryId: 1, eventDate: 1 }, 
          { background: true }
        ),
        EventModel.collection.createIndex(
          { clientClinicName: 1, eventDate: 1 }, 
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
   * Log event statistics after migration
   */
  private async logEventStatistics(): Promise<void> {
    try {
      const [
        totalEvents,
        publicEvents,
        approvedEvents,
        upcomingEvents,
        eventsWithClients
      ] = await Promise.all([
        EventModel.countDocuments(),
        EventModel.countDocuments({ isPublic: true }),
        EventModel.countDocuments({ isApproved: true }),
        EventModel.countDocuments({ eventDate: { $gte: new Date() } }),
        EventModel.countDocuments({ $and: [{ clientId: { $ne: null } }, { clientId: { $ne: '' } }] })
      ]);

      logger.info('Event Migration Statistics:', {
        totalEvents,
        publicEvents,
        approvedEvents,
        upcomingEvents,
        eventsWithClients,
        percentagePublic: Math.round((publicEvents / totalEvents) * 100),
        percentageApproved: Math.round((approvedEvents / totalEvents) * 100),
        percentageWithClients: Math.round((eventsWithClients / totalEvents) * 100)
      });
    } catch (error) {
      logger.error('Error logging event statistics:', error);
    }
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
   * Clean and validate URL
   */
  private cleanUrl(url?: string): string | undefined {
    if (!url) {return undefined;}
    
    const cleaned = url.trim();
    if (cleaned.length === 0) {return undefined;}
    
    // Basic URL validation
    try {
      if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
        return `http://${cleaned}`;
      }
      return cleaned;
    } catch {
      return cleaned; // Return as-is if URL parsing fails
    }
  }

  /**
   * Convert numeric boolean flags (0/1) to boolean
   */
  private convertBooleanFlag(value?: number): boolean {
    return value === 1;
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
        event_id,
        event_parent_id,
        user_id,
        category_id,
        event_title,
        event_desc,
        event_date,
        event_time,
        event_time_end,
        event_date_add,
        event_user_add,
        event_is_public,
        event_is_approved,
        event_location,
        event_cost,
        event_url,
        custom_TextBox1,
        custom_TextBox2,
        custom_TextBox3,
        custom_TextArea1,
        custom_TextArea2,
        custom_TextArea3,
        custom_CheckBox1,
        custom_CheckBox2,
        custom_CheckBox3,
        sb_client_id,
        sb_client_full_name,
        sb_client_clinic_name
      FROM ${this.tableName}
      ORDER BY event_id
    `;
    
    return this.executeMSSQLQuery(query);
  }
}
