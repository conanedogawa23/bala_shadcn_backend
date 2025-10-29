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
  // Primary key
  clinicId: number;

  // Core clinic information (matching MongoDB structure)
  name: string; // Main clinic identifier (was clinicName)
  displayName: string; // Human-readable name
  
  // Address as nested object (matching MongoDB structure)
  address: {
    street: string;
    city: string;
    province: string;
    postalCode: string;
  };

  // FHIR-aligned fields (matching MongoDB structure)
  resourceType: string; // FHIR resource type
  identifier: IOrganizationIdentifier[]; // FHIR identifiers
  active: boolean; // FHIR active status
  type: string[]; // Organization type
  services: string[]; // Services offered
  status: string; // Status (active, historical, inactive)

  // Business logic fields
  isRetainedClinic: boolean; // Business rule from VISIO requirements

  // Logo storage
  logo?: {
    data: string;        // Base64 encoded image
    contentType: string; // 'image/png' or 'image/jpeg'
    filename: string;    // Original filename
    uploadedAt: Date;    // Upload timestamp
  };

  // Audit Fields
  dateCreated: Date;
  dateModified: Date;

  // Instance Methods
  isActive(): boolean;
  getFullAddress(): string;
  getDisplayName(): string;
  isBusinessRetained(): boolean;
  
  // Virtual properties for backward compatibility
  clinicName?: string; // Virtual getter for name
  clinicAddress?: string; // Virtual getter for address.street
  city?: string; // Virtual getter for address.city
  province?: string; // Virtual getter for address.province
  postalCode?: string; // Virtual getter for address.postalCode
}

interface IClinicModel extends Model<IClinic> {
  findActiveClinic(): Promise<IClinic[]>;
  findRetainedClinics(): Promise<IClinic[]>;
  findByBusinessStatus(status: OrganizationStatus): Promise<IClinic[]>;
  getRetainedClinicNames(): string[];
}

// BUSINESS RULE: Retained Clinics (from MSSQL verification)
// Total MSSQL clinics: 13
// Retained for new system: 6 clinics
// Mapping MSSQL ClinicName → MongoDB clinic structure

// Retained clinics configuration based on actual MongoDB data
// Using exact MongoDB names without slug transformation
export const RETAINED_CLINICS_CONFIG = {
  'bodyblissphysio': {
    name: 'bodyblissphysio',
    displayName: 'BodyBliss Physiotherapy',
    status: OrganizationStatus.ACTIVE
  },
  'BodyBlissOneCare': {
    name: 'BodyBlissOneCare',
    displayName: 'BodyBlissOneCare',
    status: OrganizationStatus.ACTIVE
  },
  'Century Care': {
    name: 'Century Care',
    displayName: 'Century Care',
    status: OrganizationStatus.ACTIVE
  },
  'Ortholine Duncan Mills': {
    name: 'Ortholine Duncan Mills',
    displayName: 'Ortholine Duncan Mills',
    status: OrganizationStatus.ACTIVE
  },
  'My Cloud': {
    name: 'My Cloud',
    displayName: 'Active Force Health Care Inc.',
    status: OrganizationStatus.ACTIVE
  },
  'Physio Bliss': {
    name: 'Physio Bliss',
    displayName: 'Physio Bliss',
    status: OrganizationStatus.ACTIVE
  }
} as const;

export const RETAINED_CLINIC_NAMES = Object.keys(RETAINED_CLINICS_CONFIG) as Array<string>;
export type RetainedClinicName = typeof RETAINED_CLINIC_NAMES[number];

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

// Main Clinic Schema matching MongoDB structure
const ClinicSchema = new Schema<IClinic>({
  // Primary key
  clinicId: {
    type: Number,
    required: true,
    unique: true,
    index: true
  },

  // Core clinic information (matching MongoDB structure)
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  displayName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },

  // Address as nested object (matching MongoDB structure)
  address: {
    street: {
      type: String,
      required: true,
      trim: true,
      default: ''
    },
    city: {
      type: String,
      required: true,
      trim: true,
      default: ''
    },
    province: {
      type: String,
      required: true,
      trim: true,
      default: ''
    },
    postalCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      default: ''
    }
  },

  // FHIR-aligned fields (matching MongoDB structure)
  resourceType: {
    type: String,
    default: 'Organization'
  },
  identifier: {
    type: [OrganizationIdentifierSchema],
    default: []
  },
  active: {
    type: Boolean,
    default: true
  },
  type: {
    type: [String],
    default: ['dept']
  },
  services: {
    type: [String],
    default: ['physiotherapy', 'massage', 'orthotics']
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'historical', 'suspended'],
    default: 'active'
  },

  // Business logic fields
  isRetainedClinic: {
    type: Boolean,
    default: false,
    index: true
  },
  
  // Logo storage
  logo: {
    data: { type: String },
    contentType: { type: String },
    filename: { type: String },
    uploadedAt: { type: Date }
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
  }
}, {
  timestamps: { createdAt: 'dateCreated', updatedAt: 'dateModified' },
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for optimal performance (matching MongoDB indexes)
ClinicSchema.index({ 'address.city': 1 });
ClinicSchema.index({ 'address.province': 1 });
ClinicSchema.index({ 'address.postalCode': 1 });

// Pre-save middleware for business rules
ClinicSchema.pre<IClinic>('save', async function(next) {
  this.dateModified = new Date();

  // Auto-set retained clinic status based on business rules
  if (RETAINED_CLINIC_NAMES.includes(this.name)) {
    this.isRetainedClinic = true;
  } else {
    this.isRetainedClinic = false;
  }

  next();
});

// Instance Methods
ClinicSchema.methods.isActive = function(): boolean {
  return this.isRetainedClinic;
};

ClinicSchema.methods.getFullAddress = function(): string {
  if (!this.address) return '';
  const parts = [
    this.address.street,
    this.address.city,
    this.address.province,
    this.address.postalCode
  ].filter(Boolean);
  return parts.join(', ');
};

ClinicSchema.methods.getDisplayName = function(): string {
  return this.displayName || this.name;
};

ClinicSchema.methods.isBusinessRetained = function(): boolean {
  return this.isRetainedClinic && RETAINED_CLINIC_NAMES.includes(this.name);
};

// Virtual properties for backward compatibility
ClinicSchema.virtual('clinicName').get(function() {
  return this.name;
});

ClinicSchema.virtual('clinicAddress').get(function() {
  return this.address?.street || '';
});

ClinicSchema.virtual('city').get(function() {
  return this.address?.city || '';
});

ClinicSchema.virtual('province').get(function() {
  return this.address?.province || '';
});

ClinicSchema.virtual('postalCode').get(function() {
  return this.address?.postalCode || '';
});

// Static Methods with business filtering
ClinicSchema.statics.findActiveClinic = function(): Promise<IClinic[]> {
  return this.find({
    isRetainedClinic: true
  }).sort({ name: 1 });
};

ClinicSchema.statics.findRetainedClinics = function(): Promise<IClinic[]> {
  return this.find({
    isRetainedClinic: true
  }).sort({ name: 1 });
};

ClinicSchema.statics.findByBusinessStatus = function(status: OrganizationStatus): Promise<IClinic[]> {
  const filter: any = {};

  // For active status, only show retained clinics
  if (status === OrganizationStatus.ACTIVE) {
    filter.isRetainedClinic = true;
    filter.name = { $in: RETAINED_CLINIC_NAMES };
  }

  return this.find(filter).sort({ name: 1 });
};

ClinicSchema.statics.getRetainedClinicNames = function(): string[] {
  return RETAINED_CLINIC_NAMES;
};

export const ClinicModel = model<IClinic, IClinicModel>('Clinic', ClinicSchema);
