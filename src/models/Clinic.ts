import { Schema, model, Document, Model } from 'mongoose';

// FHIR-aligned enums
export enum OrganizationType {
  HEALTHCARE_PROVIDER = 'prov',
  CLINIC = 'dept',
  HOSPITAL = 'hosp',
  OTHER = 'other'
}

export enum OrganizationStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  HISTORICAL = 'historical'
}

// FHIR-aligned interfaces
export interface IOrganizationIdentifier {
  system: string;
  value: string;
  use?: 'usual' | 'official' | 'temp' | 'secondary';
}

export interface IOrganizationContactPoint {
  system: 'phone' | 'fax' | 'email' | 'url';
  value: string;
  use?: 'work' | 'home' | 'mobile';
  rank?: number;
}

export interface IOrganizationAddress {
  use?: 'home' | 'work' | 'temp' | 'old' | 'billing';
  type?: 'postal' | 'physical' | 'both';
  text?: string;
  line: string[];
  city: string;
  district?: string;
  state: string;
  postalCode: string;
  country?: string;
}

export interface IOrganizationContact {
  purpose?: string;
  name?: {
    family?: string;
    given?: string[];
  };
  telecom?: IOrganizationContactPoint[];
  address?: IOrganizationAddress;
}

export interface IClinic extends Document {
  // Primary key from MSSQL
  clinicId: number; // ClinicId from MSSQL

  // Core clinic information from MSSQL
  clinicName: string; // ClinicName from MSSQL
  clinicAddress: string; // ClinicAddress from MSSQL
  city: string; // City from MSSQL
  province: string; // Province from MSSQL
  postalCode: string; // PostalCode from MSSQL

  // Additional fields
  completeName?: string; // CompleteName from MSSQL

  // Business logic fields
  isRetainedClinic: boolean; // Business rule from VISIO requirements

  // Analytics (computed fields)
  stats: {
    totalOrders: number;
    totalRevenue: number;
    totalClients: number;
    lastActivity?: Date;
    averageOrderValue: number;
  };

  // Audit Fields
  dateCreated: Date; // DateCreated from MSSQL
  dateModified: Date; // DateModified from MSSQL
  createdBy?: string;
  updatedBy?: string;

  // Instance Methods
  isActive(): boolean;
  getFullAddress(): string;
  getDisplayName(): string;
  isBusinessRetained(): boolean;
}

interface IClinicModel extends Model<IClinic> {
  findActiveClinic(): Promise<IClinic[]>;
  findRetainedClinics(): Promise<IClinic[]>;
  findByBusinessStatus(status: OrganizationStatus): Promise<IClinic[]>;
  getRetainedClinicNames(): string[];
}

// BUSINESS RULE: Retained Clinics (from MongoDB analysis)
const RETAINED_CLINIC_NAMES = [
  'BodyBliss',
  'bodyblissphysio',
  'BodyBlissPhysio', // Alternative spelling
  'BodyBlissOneCare',
  'Century Care',
  'Ortholine Duncan Mills',
  'My Cloud',
  'Physio Bliss'
];

// Sub-schemas
const OrganizationIdentifierSchema = new Schema<IOrganizationIdentifier>({
  system: { type: String, required: true },
  value: { type: String, required: true },
  use: { type: String, enum: ['usual', 'official', 'temp', 'secondary'], default: 'official' }
}, { _id: false });

const OrganizationContactPointSchema = new Schema<IOrganizationContactPoint>({
  system: { 
    type: String, 
    enum: ['phone', 'fax', 'email', 'url'], 
    required: true 
  },
  value: { type: String, required: true, trim: true },
  use: { type: String, enum: ['work', 'home', 'mobile'], default: 'work' },
  rank: { type: Number, min: 1, max: 10 }
}, { _id: false });

const OrganizationAddressSchema = new Schema<IOrganizationAddress>({
  use: { type: String, enum: ['home', 'work', 'temp', 'old', 'billing'], default: 'work' },
  type: { type: String, enum: ['postal', 'physical', 'both'], default: 'both' },
  text: { type: String, trim: true },
  line: [{ type: String, trim: true }],
  city: { type: String, required: true, trim: true },
  district: { type: String, trim: true },
  state: { type: String, required: true, trim: true },
  postalCode: { type: String, required: true, trim: true, uppercase: true },
  country: { type: String, trim: true, default: 'Canada' }
}, { _id: false });

const OrganizationContactSchema = new Schema<IOrganizationContact>({
  purpose: { type: String, trim: true },
  name: {
    family: { type: String, trim: true },
    given: [{ type: String, trim: true }]
  },
  telecom: [OrganizationContactPointSchema],
  address: OrganizationAddressSchema
}, { _id: false });

// Main Clinic Schema matching MSSQL structure
const ClinicSchema = new Schema<IClinic>({
  // Primary key from MSSQL
  clinicId: {
    type: Number,
    required: true,
    unique: true,
    index: true
  },

  // Core clinic information from MSSQL
  clinicName: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 50,
    index: true
  },
  clinicAddress: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  city: {
    type: String,
    required: true,
    trim: true,
    maxlength: 300,
    index: true
  },
  province: {
    type: String,
    required: true,
    trim: true,
    maxlength: 300,
    index: true
  },
  postalCode: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50,
    uppercase: true,
    index: true
  },

  // Additional fields
  completeName: {
    type: String,
    trim: true,
    maxlength: 100
  },

  // Business logic fields
  isRetainedClinic: {
    type: Boolean,
    default: false,
    index: true
  },
  
  // Analytics
  stats: {
    totalOrders: { type: Number, default: 0, min: 0 },
    totalRevenue: { type: Number, default: 0, min: 0 },
    totalClients: { type: Number, default: 0, min: 0 },
    lastActivity: { type: Date },
    averageOrderValue: { type: Number, default: 0, min: 0 }
  },
  
  // Audit Fields
  dateCreated: {
    type: Date,
    default: Date.now,
    index: true
  },
  dateModified: {
    type: Date,
    default: Date.now
  },
  createdBy: { type: String, trim: true },
  updatedBy: { type: String, trim: true }
}, {
  timestamps: { createdAt: 'dateCreated', updatedAt: 'dateModified' },
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for optimal performance
ClinicSchema.index({ clinicId: 1 }, { unique: true });
ClinicSchema.index({ clinicName: 1 }, { unique: true });
ClinicSchema.index({ isRetainedClinic: 1 });
ClinicSchema.index({ city: 1 });
ClinicSchema.index({ province: 1 });
ClinicSchema.index({ postalCode: 1 });
ClinicSchema.index({ dateCreated: -1 });

// Pre-save middleware for business rules
ClinicSchema.pre<IClinic>('save', async function(next) {
  this.dateModified = new Date();

  // Auto-set retained clinic status based on business rules
  if (RETAINED_CLINIC_NAMES.includes(this.clinicName)) {
    this.isRetainedClinic = true;
  } else {
    this.isRetainedClinic = false;
    // Optionally set non-retained clinics as historical
    if (this.isNew) {
      // Keep as default values for non-retained clinics
    }
  }

  // Calculate average order value
  if (this.stats.totalOrders > 0) {
    this.stats.averageOrderValue = this.stats.totalRevenue / this.stats.totalOrders;
  }

  next();
});

// Instance Methods
ClinicSchema.methods.isActive = function(): boolean {
  return this.isRetainedClinic;
};

ClinicSchema.methods.getFullAddress = function(): string {
  return `${this.clinicAddress}, ${this.city}, ${this.province} ${this.postalCode}`;
};

ClinicSchema.methods.getDisplayName = function(): string {
  return this.clinicName;
};

ClinicSchema.methods.isBusinessRetained = function(): boolean {
  return this.isRetainedClinic && RETAINED_CLINIC_NAMES.includes(this.clinicName);
};

// Static Methods with business filtering
ClinicSchema.statics.findActiveClinic = function(): Promise<IClinic[]> {
  return this.find({
    isRetainedClinic: true
  }).sort({ clinicName: 1 });
};

ClinicSchema.statics.findRetainedClinics = function(): Promise<IClinic[]> {
  return this.find({
    isRetainedClinic: true
  }).sort({ clinicName: 1 });
};

ClinicSchema.statics.findByBusinessStatus = function(status: OrganizationStatus): Promise<IClinic[]> {
  const filter: any = {};

  // For active status, only show retained clinics
  if (status === OrganizationStatus.ACTIVE) {
    filter.isRetainedClinic = true;
    filter.clinicName = { $in: RETAINED_CLINIC_NAMES };
  }

  return this.find(filter).sort({ clinicName: 1 });
};

ClinicSchema.statics.getRetainedClinicNames = function(): string[] {
  return RETAINED_CLINIC_NAMES;
};

export const ClinicModel = model<IClinic, IClinicModel>('Clinic', ClinicSchema);
