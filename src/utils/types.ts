import { Types } from 'mongoose';

// Utility type for MongoDB documents with proper _id typing
export type MongoDocument<T> = T & { 
  _id: Types.ObjectId | string;
  __v?: number;
};

// Helper function to safely convert _id to string
export function toObjectIdString(id: unknown): string {
  if (typeof id === 'string') {
    return id;
  }
  if (id && typeof id === 'object' && 'toString' in id) {
    return (id as any).toString();
  }
  throw new Error('Invalid ObjectId format');
}

// Type guard for checking if an object has an _id property
export function hasValidId(obj: any): obj is { _id: Types.ObjectId | string } {
  return obj && (typeof obj._id === 'string' || Types.ObjectId.isValid(obj._id));
}

// Utility type for paginated results
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Utility type for API responses
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  code?: string;
}

// Utility type for query filters
export interface QueryFilters {
  [key: string]: any;
  limit?: number;
  skip?: number;
  sort?: string;
}

// MongoDB aggregation result type
export type AggregationResult<T = any> = T[];

// Generic error type for better error handling
export interface AppErrorData {
  code: string;
  message: string;
  details?: any;
  statusCode?: number;
}
