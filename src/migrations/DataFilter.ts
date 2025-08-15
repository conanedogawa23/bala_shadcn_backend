import { logger } from '@/utils/logger';

/**
 * DataFilter utility to implement VISIO business rules
 * Based on Copy of VISIO_(1)(1).xlsx - VISIO.csv requirements
 */
export class DataFilter {
  // Clinics to retain during migration
  private static readonly RETAINED_CLINICS = new Set([
    'Bodybliss Physiotherapy',
    'Bodybliss One Care',
    'Century Care', 
    'Duncan Mills Ortholine',
    'My Cloud',
    'Physiobliss'
  ]);

  // Clinics to exclude during migration
  private static readonly EXCLUDED_CLINICS = new Set([
    'Bodybliss',
    'Bioform Health',
    'Orthopedic Orthotic Appliances',
    'Markham Orthopedic',
    'Extreme Physio',
    'Active Force'
  ]);

  // Product codes to exclude from orders
  private static readonly EXCLUDED_PRODUCTS = new Set([
    'AC', 'AC50', 'AC60', 'AC80', 'ALLE', 'ANX', 'ARTH', 'BNP',
    'BPH', 'CANPREV5HTP', 'CANPREVALA', 'CANPREVEP', 'CANPREVHH',
    'CANPREVHL', 'CANPREVIBS', 'CANPREVNEM', 'CANPREVPP', 'CANPREVTP',
    'CFOS', 'CHRF', 'CHS', 'CP', 'DeeP1', 'DLA300', 'DLFC', 'DLGMCM',
    'DLIG', 'DLLIV', 'DLMC', 'DLPSP', 'DLQ', 'DLTQ', 'DLTS', 'DLUPRO',
    'EVCO', 'HB', 'HC', 'IND', 'INS', 'LB01', 'LB02', 'LB03', 'LBCOS',
    'LCKK', 'LFB219', 'LS', 'ME', 'MenoPrev', 'MI', 'MIG00', 'MIG01',
    'MIG02', 'MIG03', 'MIG24', 'MIGM0', 'MIGSG', 'MIGTR', 'NATser',
    'NATser125', 'NATser140', 'NATser180', 'NAtser25', 'NATser250',
    'NATser30', 'NATSer49', 'NATser80', 'NSA', 'NSAUT', 'NSBA', 'NSFV1',
    'NSFV10', 'NSFV15', 'NSFV20', 'NSFV30', 'NSFV45', 'NSFV5', 'NSIV1',
    'NSIV30', 'NSMR', 'NSU', 'OCF63', 'OS', 'OS135', 'OS200', 'OSTAS',
    'OSTT30', 'OSTT45', 'OSTT60', 'PEB12', 'PEEX', 'PEHE', 'PELG',
    'PELGD', 'PEOB', 'PEP', 'PEPB', 'PEV', 'PM', 'PR1', 'PR2', 'SC',
    'SFH', 'SFHCGS', 'SFHEDI', 'SH01', 'SHCOS', 'SlimPro', 'UL', 'WH',
    'WM', 'WSVB100', 'WSVB9995'
  ]);

  // Fields to retain for Client page
  private static readonly CLIENT_RETAINED_FIELDS = new Set([
    'Name', 'Address', 'Birthday', 'Cellphone No.', 'Home No.',
    'Email. Address', 'Company Name', 'Referring MD', 'Gender'
  ]);

  // Fields to exclude for Client page
  private static readonly CLIENT_EXCLUDED_FIELDS = new Set([
    'CSR Name', 'Work no. and Extension', 'Family MD',
    'How did you hear about us', 'View Insuranc',
    'Generate PDF. Form (insurance)'
  ]);

  // Insurance fields to retain
  private static readonly INSURANCE_RETAINED_FIELDS = new Set([
    'Policy Holder Name', 'Policy Holder Bday', 'Insurance Company Name',
    'Group No.', 'Certificate No.'
  ]);

  // Insurance fields to exclude
  private static readonly INSURANCE_EXCLUDED_FIELDS = new Set([
    '3rd Insurance Column'
  ]);

  // Order statuses to retain
  private static readonly RETAINED_ORDER_STATUSES = new Set([
    'Pending Sales Refund 1',
    'Pending Sales Refund 1 & COB 1'
  ]);

  // Date types to retain
  private static readonly RETAINED_DATE_TYPES = new Set([
    'Order Date',
    'Invoice Date'
  ]);

  /**
   * Filter clinics based on VISIO business rules
   * Uses efficient Set operations instead of forEach
   */
  static shouldRetainClinic(clinicName?: string): boolean {
    if (!clinicName) {return false;}
    
    // Normalize clinic name for comparison
    const normalizedName = clinicName.trim();
    
    // Check if explicitly excluded
    if (this.EXCLUDED_CLINICS.has(normalizedName)) {
      logger.debug(`❌ Excluding clinic: ${normalizedName}`);
      return false;
    }
    
    // Check if explicitly retained
    if (this.RETAINED_CLINICS.has(normalizedName)) {
      logger.debug(`✅ Retaining clinic: ${normalizedName}`);
      return true;
    }
    
    // For partial matches, check if clinic name contains retained clinic
    const isRetained = Array.from(this.RETAINED_CLINICS).some(retainedClinic =>
      normalizedName.toLowerCase().includes(retainedClinic.toLowerCase()) ||
      retainedClinic.toLowerCase().includes(normalizedName.toLowerCase())
    );
    
    if (isRetained) {
      logger.debug(`✅ Retaining clinic (partial match): ${normalizedName}`);
      return true;
    }
    
    logger.debug(`❓ Unknown clinic: ${normalizedName} - excluding by default`);
    return false;
  }

  /**
   * Filter product codes based on VISIO business rules
   */
  static shouldRetainProduct(productCode?: string): boolean {
    if (!productCode) {return false;}
    
    const normalizedCode = productCode.trim().toUpperCase();
    
    if (this.EXCLUDED_PRODUCTS.has(normalizedCode)) {
      logger.debug(`❌ Excluding product: ${normalizedCode}`);
      return false;
    }
    
    logger.debug(`✅ Retaining product: ${normalizedCode}`);
    return true;
  }

  /**
   * Filter client fields based on VISIO business rules
   */
  static shouldRetainClientField(fieldName?: string): boolean {
    if (!fieldName) {return false;}
    
    const normalizedField = fieldName.trim();
    
    if (this.CLIENT_EXCLUDED_FIELDS.has(normalizedField)) {
      return false;
    }
    
    return this.CLIENT_RETAINED_FIELDS.has(normalizedField);
  }

  /**
   * Filter insurance fields based on VISIO business rules
   */
  static shouldRetainInsuranceField(fieldName?: string): boolean {
    if (!fieldName) {return false;}
    
    const normalizedField = fieldName.trim();
    
    if (this.INSURANCE_EXCLUDED_FIELDS.has(normalizedField)) {
      return false;
    }
    
    return this.INSURANCE_RETAINED_FIELDS.has(normalizedField);
  }

  /**
   * Filter order status based on VISIO business rules
   */
  static shouldRetainOrderStatus(status?: string): boolean {
    if (!status) {return false;}
    
    return this.RETAINED_ORDER_STATUSES.has(status.trim());
  }

  /**
   * Filter date types based on VISIO business rules
   */
  static shouldRetainDateType(dateType?: string): boolean {
    if (!dateType) {return false;}
    
    return this.RETAINED_DATE_TYPES.has(dateType.trim());
  }

  /**
   * Filter MSSQL records based on clinic association
   * Uses efficient filtering instead of forEach
   */
  static filterRecordsByClinic<T extends { clinicName?: string }>(records: T[]): T[] {
    return records.filter(record => this.shouldRetainClinic(record.clinicName));
  }

  /**
   * Filter orders by product codes
   * Uses efficient filtering instead of forEach
   */
  static filterOrdersByProducts<T extends { productCode?: string }>(orders: T[]): T[] {
    return orders.filter(order => this.shouldRetainProduct(order.productCode));
  }

  /**
   * Get filtered clinic list for migration
   */
  static getRetainedClinics(): string[] {
    return Array.from(this.RETAINED_CLINICS);
  }

  /**
   * Get excluded product codes for logging
   */
  static getExcludedProducts(): string[] {
    return Array.from(this.EXCLUDED_PRODUCTS);
  }

  /**
   * Generate migration filter summary
   */
  static getMigrationFilterSummary(): {
    retainedClinics: number;
    excludedClinics: number;
    excludedProducts: number;
    excludedModules: string[];
    } {
    return {
      retainedClinics: this.RETAINED_CLINICS.size,
      excludedClinics: this.EXCLUDED_CLINICS.size,
      excludedProducts: this.EXCLUDED_PRODUCTS.size,
      excludedModules: ['SCHEDULE', 'LAB', 'RELATIONS']
    };
  }

  /**
   * Validate if clinic data should be migrated
   */
  static validateClinicForMigration(clinicData: any): boolean {
    // Check clinic name
    if (!this.shouldRetainClinic(clinicData.clinicName)) {
      return false;
    }

    // Additional validation rules can be added here
    return true;
  }

  /**
   * Apply client field filtering to MSSQL data
   */
  static filterClientData(clientData: any): any {
    const filteredData: any = {};
    
    // Use efficient Object.entries instead of forEach
    Object.entries(clientData).filter(([key, value]) => {
      if (this.shouldRetainClientField(key)) {
        filteredData[key] = value;
      }
    });
    
    return filteredData;
  }

  /**
   * Apply insurance field filtering to MSSQL data
   */
  static filterInsuranceData(insuranceData: any): any {
    const filteredData: any = {};
    
    // Use efficient Object.entries instead of forEach
    Object.entries(insuranceData).filter(([key, value]) => {
      if (this.shouldRetainInsuranceField(key)) {
        filteredData[key] = value;
      }
    });
    
    return filteredData;
  }

  /**
   * Log filter statistics for monitoring
   */
  static logFilterStats(originalCount: number, filteredCount: number, type: string): void {
    const excludedCount = originalCount - filteredCount;
    const retentionRate = originalCount > 0 ? (filteredCount / originalCount * 100).toFixed(1) : '0';
    
    logger.info(`🔍 ${type} Filter Results:`);
    logger.info(`   Original: ${originalCount}`);
    logger.info(`   Retained: ${filteredCount}`);
    logger.info(`   Excluded: ${excludedCount}`);
    logger.info(`   Retention Rate: ${retentionRate}%`);
  }
}
