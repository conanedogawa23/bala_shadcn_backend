import { Model, Document, FilterQuery, QueryOptions, UpdateQuery } from 'mongoose';

// Helper interface for models with common static methods
export interface ExtendedModel<T> extends Model<T> {
  // Common find methods
  findByClient?(clientId: string): any;
  findByClinic?(clinicName: string): any;
  findByCategory?(categoryId: string): any;
  findByResource?(resourceId: string, date?: Date): any;
  findByDateRange?(startDate: Date, endDate: Date): any;
  findUpcoming?(limit?: number): any;
  findByCompany?(companyName: string): any;
  findByProvince?(province: string): any;
  findByCity?(city: string): any;
  findByPostalCode?(postalCode: string): any;
  
  // Advanced billing methods
  getActiveBillings?(): any;
  getBillingsByClient?(clientId: string): any;
  getBillingsByClinic?(clinicName: string): any;
  getOverdueBillings?(): any;
  getUpcomingBillings?(days: number): any;
  getBillingsExpiringSoon?(days: number): any;
  bulkUpdateBillDates?(updates: any[]): any;
  
  // Insurance reference methods
  getAllFrequencies?(): any;
  getSelectableFrequencies?(): any;
  getByKey?(key: string): any;
  getAllPolicyHolders?(): any;
  getValidSelections?(): any;
  getRequiringAdditionalInfo?(): any;
  getAllCOBOptions?(): any;
  getByValue?(value: any): any;
  getDefault?(): any;
  
  // Contact history methods
  findFollowUpsRequired?(clinicName: string): any;
  getRecentActivity?(clinicName: string, days: number): any;
  
  // Appointment methods
  checkTimeSlotConflict?(resourceId: string, startTime: Date, endTime: Date, excludeId?: string): any;
  findReadyToBill?(clinicName: string): any;
  
  // Client methods
  searchClients?(searchTerm: string, clinicName?: string): any;
  
  // Clinic methods
  findActiveClinic?(): any;
  
  // Event methods
  findPublicEvents?(startDate?: Date, endDate?: Date): any;
  findPendingApproval?(): any;
  
  // Resource methods
  findPractitioners?(clinicName?: string, specialty?: string): any;
  findServices?(category?: string): any;
  findBookableResources?(clinicName: string): any;
  
  // Client clinic relationship methods
  findPrimaryRelationship?(clientId: string): any;
  getClinicStats?(clinicName: string): any;
  getClientDistribution?(): any;
}

// Helper function to safely handle undefined parameters
export function ensureString(value: string | undefined, defaultValue: string = ''): string {
  return value?.trim() || defaultValue;
}

// Helper function to safely handle optional numbers
export function ensureNumber(value: number | undefined, defaultValue: number = 0): number {
  return value !== undefined ? value : defaultValue;
}

// Helper function to validate required string parameters
export function validateRequiredString(value: string | undefined, fieldName: string): string {
  if (!value?.trim()) {
    throw new Error(`${fieldName} is required and cannot be empty`);
  }
  return value.trim();
}

// Generic query builder with type safety
export function buildSafeQuery<T>(
  filters: Record<string, any>,
  allowedFields: (keyof T)[]
): FilterQuery<T> {
  const query: FilterQuery<T> = {};
  
  for (const [key, value] of Object.entries(filters)) {
    if (allowedFields.includes(key as keyof T) && value !== undefined && value !== null) {
      (query as any)[key] = value;
    }
  }
  
  return query;
}

// Helper for safe async operations
export async function safeAsyncOperation<T>(
  operation: () => Promise<T>,
  errorMessage: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw new Error(`${errorMessage}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
