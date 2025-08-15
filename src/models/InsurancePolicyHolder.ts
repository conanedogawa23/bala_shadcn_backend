import { Schema, model, Document, Model } from 'mongoose';

export enum PolicyHolderType {
  NONE = 'NONE',
  SELF = 'SELF',
  SPOUSE = 'SPOUSE',
  PARENT = 'PARENT',
  CHILD = 'CHILD',
  OTHER = 'OTHER'
}

export interface IInsurancePolicyHolder extends Document {
  policyHolderKey: number; // sb_1st_insurance_policy_holder_key from MSSQL
  policyHolderName: string; // sb_1st_insurance_policy_holder_name from MSSQL
  policyHolderType: PolicyHolderType; // derived from name
  
  // Computed fields
  isValidSelection: boolean; // Whether this is a valid selection option
  displayOrder: number; // Order for UI display
  requiresAdditionalInfo: boolean; // Whether additional info is needed
  
  // Audit fields
  dateCreated: Date;
  dateModified: Date;
  
  // Instance methods
  getPolicyHolderType(): PolicyHolderType;
  isValidPolicyHolderSelection(): boolean;
  requiresDetails(): boolean;
  getDisplayName(): string;
  getLogicalOrder(policyHolderType: PolicyHolderType): number;
}

const InsurancePolicyHolderSchema = new Schema<IInsurancePolicyHolder>({
  policyHolderKey: {
    type: Number,
    required: true,
    unique: true,
    index: true,
    min: 1
  },
  policyHolderName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    index: true
  },
  policyHolderType: {
    type: String,
    required: true,
    enum: Object.values(PolicyHolderType),
    index: true
  },
  isValidSelection: {
    type: Boolean,
    required: true,
    default: true,
    index: true
  },
  displayOrder: {
    type: Number,
    required: true,
    default: 1,
    min: 1,
    index: true
  },
  requiresAdditionalInfo: {
    type: Boolean,
    required: true,
    default: false
  },
  
  // Audit fields
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
  toJSON: {
    transform: function(doc, ret: any) {
      delete ret.__v;
      return ret;
    }
  }
});

// Compound indexes for common queries
InsurancePolicyHolderSchema.index({ isValidSelection: 1, displayOrder: 1 });
InsurancePolicyHolderSchema.index({ policyHolderType: 1, isValidSelection: 1 });

// Text search index
InsurancePolicyHolderSchema.index({
  policyHolderName: 'text'
});

// Instance methods
InsurancePolicyHolderSchema.methods.getPolicyHolderType = function(): PolicyHolderType {
  const name = this.policyHolderName.toUpperCase().trim();
  
  if (name === 'NONE') {return PolicyHolderType.NONE;}
  if (name === 'SELF') {return PolicyHolderType.SELF;}
  if (name === 'SPOUSE') {return PolicyHolderType.SPOUSE;}
  if (name.includes('PARENT')) {return PolicyHolderType.PARENT;}
  if (name.includes('CHILD')) {return PolicyHolderType.CHILD;}
  
  return PolicyHolderType.OTHER;
};

InsurancePolicyHolderSchema.methods.isValidPolicyHolderSelection = function(): boolean {
  return this.policyHolderType !== PolicyHolderType.NONE;
};

InsurancePolicyHolderSchema.methods.requiresDetails = function(): boolean {
  return [PolicyHolderType.SPOUSE, PolicyHolderType.PARENT, PolicyHolderType.OTHER].includes(this.policyHolderType);
};

InsurancePolicyHolderSchema.methods.getDisplayName = function(): string {
  const name = this.policyHolderName.trim();
  
  // Format display name properly
  switch (this.policyHolderType) {
  case PolicyHolderType.NONE:
    return 'None';
  case PolicyHolderType.SELF:
    return 'Self';
  case PolicyHolderType.SPOUSE:
    return 'Spouse';
  case PolicyHolderType.PARENT:
    return 'Parent';
  case PolicyHolderType.CHILD:
    return 'Child';
  default:
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  }
};

// Static methods
InsurancePolicyHolderSchema.statics.getValidSelections = function() {
  return this.find({ 
    isValidSelection: true,
    policyHolderType: { $ne: PolicyHolderType.NONE }
  }).sort({ displayOrder: 1 });
};

InsurancePolicyHolderSchema.statics.getByKey = function(policyHolderKey: number) {
  return this.findOne({ policyHolderKey });
};

InsurancePolicyHolderSchema.statics.getByType = function(policyHolderType: PolicyHolderType) {
  return this.find({ policyHolderType }).sort({ displayOrder: 1 });
};

InsurancePolicyHolderSchema.statics.getAllPolicyHolders = function() {
  return this.find({}).sort({ displayOrder: 1 });
};

InsurancePolicyHolderSchema.statics.getRequiringAdditionalInfo = function() {
  return this.find({ 
    requiresAdditionalInfo: true,
    isValidSelection: true 
  }).sort({ displayOrder: 1 });
};

// Pre-save middleware
InsurancePolicyHolderSchema.pre('save', function(next) {
  this.dateModified = new Date();
  
  // Auto-derive policy holder type if not set
  if (!this.policyHolderType) {
    this.policyHolderType = this.getPolicyHolderType();
  }
  
  // Set validity based on type
  this.isValidSelection = this.policyHolderType !== PolicyHolderType.NONE;
  
  // Set whether additional info is required
  this.requiresAdditionalInfo = this.requiresDetails();
  
  // Set display order based on logical hierarchy
  if (!this.displayOrder || this.displayOrder === 1) {
    this.displayOrder = this.getLogicalOrder(this.policyHolderType);
  }
  
  next();
});

// Helper method for logical ordering
InsurancePolicyHolderSchema.methods.getLogicalOrder = function(policyHolderType: PolicyHolderType): number {
  switch (policyHolderType) {
  case PolicyHolderType.SELF: return 1;
  case PolicyHolderType.SPOUSE: return 2;
  case PolicyHolderType.PARENT: return 3;
  case PolicyHolderType.CHILD: return 4;
  case PolicyHolderType.OTHER: return 5;
  case PolicyHolderType.NONE: return 99;
  default: return this.policyHolderKey;
  }
};

// InsurancePolicyHolder model interface with static methods
interface IInsurancePolicyHolderModel extends Model<IInsurancePolicyHolder> {
  getAllPolicyHolders(): any;
  getValidSelections(): any;
  getByKey(key: number): any;
  getRequiringAdditionalInfo(): any;
}

export const InsurancePolicyHolderModel = model<IInsurancePolicyHolder, IInsurancePolicyHolderModel>('InsurancePolicyHolder', InsurancePolicyHolderSchema);
