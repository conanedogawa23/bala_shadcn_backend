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
  // FHIR Core Fields
  resourceType: 'Organization';
  identifier: IOrganizationIdentifier[];
  
  // Legacy Support
  clinicId: number;
  
  // FHIR Organization Fields
  active: boolean;
  type: OrganizationType[];
  name: string;
  alias?: string[];
  telecom: IOrganizationContactPoint[];
  address: IOrganizationAddress[];
  partOf?: string; // Reference to parent organization
  contact?: IOrganizationContact[];
  
  // Business Fields
  displayName: string;
  completeName?: string;
  services: string[];
  status: OrganizationStatus;
  clientCount: number;
  isRetainedClinic: boolean; // Business rule from VISIO requirements
  
  // Analytics
  stats: {
    totalOrders: number;
    totalRevenue: number;
    totalClients: number;
    lastActivity?: Date;
    averageOrderValue: number;
  };
  
  // Audit Fields
  dateCreated: Date;
  dateModified: Date;
  createdBy?: string;
  updatedBy?: string;
  
  // Instance Methods
  isActive(): boolean;
  getFullAddress(): string;
  getPrimaryPhone(): string | null;
  getPrimaryEmail(): string | null;
  toFHIRResource(): any;
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

// Main Clinic Schema with FHIR alignment
const ClinicSchema = new Schema<IClinic>({
  // FHIR Core Fields
  resourceType: { 
    type: String, 
    default: 'Organization',
    enum: ['Organization']
  },
  identifier: [OrganizationIdentifierSchema],
  
  // Legacy Support
  clinicId: {
    type: Number,
    required: true,
    unique: true,
    index: true
  },
  
  // FHIR Organization Fields
  active: { 
    type: Boolean, 
    default: true,
    index: true
  },
  type: [{
    type: String,
    enum: Object.values(OrganizationType),
    default: OrganizationType.CLINIC
  }],
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 100,
    index: true
  },
  alias: [{ type: String, trim: true }],
  telecom: [OrganizationContactPointSchema],
  address: [OrganizationAddressSchema],
  partOf: { type: String, trim: true }, // Reference to parent organization
  contact: [OrganizationContactSchema],
  
  // Business Fields
  displayName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  completeName: {
    type: String,
    trim: true,
    maxlength: 200
  },
  services: [{
    type: String,
    trim: true
  }],
  status: {
    type: String,
    enum: Object.values(OrganizationStatus),
    default: OrganizationStatus.ACTIVE,
    index: true
  },
  clientCount: {
    type: Number,
    default: 0,
    min: 0
  },
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
ClinicSchema.index({ name: 1 }, { unique: true });
ClinicSchema.index({ status: 1, active: 1 });
ClinicSchema.index({ isRetainedClinic: 1 });
ClinicSchema.index({ 'address.city': 1 });
ClinicSchema.index({ 'address.state': 1 });
ClinicSchema.index({ 'identifier.system': 1, 'identifier.value': 1 });
ClinicSchema.index({ dateCreated: -1 });

// Pre-save middleware for business rules
ClinicSchema.pre<IClinic>('save', async function(next) {
  this.dateModified = new Date();
  
  // Auto-set retained clinic status based on business rules
  if (RETAINED_CLINIC_NAMES.includes(this.name)) {
    this.isRetainedClinic = true;
    this.active = true;
    this.status = OrganizationStatus.ACTIVE;
  } else {
    this.isRetainedClinic = false;
    // Optionally set non-retained clinics as historical
    if (this.isNew) {
      this.status = OrganizationStatus.HISTORICAL;
      this.active = false;
    }
  }
  
  // FHIR identifier auto-generation
  if (this.isNew && (!this.identifier || this.identifier.length === 0)) {
    this.identifier = [{
      system: 'http://bala-visio.com/fhir/organization-identifier',
      value: `ORG-${this.clinicId}`,
      use: 'official'
    }];
  }
  
  // Calculate average order value
  if (this.stats.totalOrders > 0) {
    this.stats.averageOrderValue = this.stats.totalRevenue / this.stats.totalOrders;
  }
  
  next();
});

// Instance Methods
ClinicSchema.methods.isActive = function(): boolean {
  return this.active && this.status === OrganizationStatus.ACTIVE;
};

ClinicSchema.methods.getFullAddress = function(): string {
  if (!this.address || this.address.length === 0) return '';
  
  const primaryAddress = this.address.find((addr: IOrganizationAddress) => addr.use === 'work') || this.address[0];
  const addressLine = primaryAddress.line.join(', ');
  return `${addressLine}, ${primaryAddress.city}, ${primaryAddress.state} ${primaryAddress.postalCode}`;
};

ClinicSchema.methods.getPrimaryPhone = function(): string | null {
  const phoneContact = this.telecom.find((contact: IOrganizationContactPoint) => 
    contact.system === 'phone' && contact.use === 'work'
  );
  return phoneContact ? phoneContact.value : null;
};

ClinicSchema.methods.getPrimaryEmail = function(): string | null {
  const emailContact = this.telecom.find((contact: IOrganizationContactPoint) => 
    contact.system === 'email' && contact.use === 'work'
  );
  return emailContact ? emailContact.value : null;
};

ClinicSchema.methods.isBusinessRetained = function(): boolean {
  return this.isRetainedClinic && RETAINED_CLINIC_NAMES.includes(this.name);
};

ClinicSchema.methods.toFHIRResource = function(): any {
  return {
    resourceType: this.resourceType,
    id: this._id.toString(),
    identifier: this.identifier,
    active: this.active,
    type: this.type.map((t: OrganizationType) => ({
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/organization-type',
        code: t,
        display: t === OrganizationType.CLINIC ? 'Hospital Department' : 'Healthcare Provider'
      }]
    })),
    name: this.name,
    alias: this.alias,
    telecom: this.telecom,
    address: this.address,
    partOf: this.partOf ? {
      reference: `Organization/${this.partOf}`
    } : undefined,
    contact: this.contact
  };
};

// Static Methods with business filtering
ClinicSchema.statics.findActiveClinic = function(): Promise<IClinic[]> {
  return this.find({ 
    active: true, 
    status: OrganizationStatus.ACTIVE,
    isRetainedClinic: true 
  }).sort({ name: 1 });
};

ClinicSchema.statics.findRetainedClinics = function(): Promise<IClinic[]> {
  return this.find({ 
    isRetainedClinic: true,
    active: true
  }).sort({ name: 1 });
};

ClinicSchema.statics.findByBusinessStatus = function(status: OrganizationStatus): Promise<IClinic[]> {
  const filter: any = { status };
  
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
