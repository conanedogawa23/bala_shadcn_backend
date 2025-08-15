import { Schema, model, Document, Model } from 'mongoose';

export enum FrequencyType {
  SELECT = 'select',
  YEARLY = 'yearly',
  ROLLING = 'rolling',
  NUMERIC = 'numeric'
}

export interface IInsuranceFrequency extends Document {
  frequencyKey: number; // sb_1st_insurance_frequency_key from MSSQL
  frequencyName: string; // sb_1st_insurance_frequency_name from MSSQL
  frequencyType: FrequencyType; // derived from name pattern
  
  // Computed fields
  isSelectable: boolean; // Whether this is a valid selection option
  displayOrder: number; // Order for UI display
  
  // Audit fields
  dateCreated: Date;
  dateModified: Date;
  
  // Instance methods
  getFrequencyType(): FrequencyType;
  isValidSelection(): boolean;
  getDisplayName(): string;
}

const InsuranceFrequencySchema = new Schema<IInsuranceFrequency>({
  frequencyKey: {
    type: Number,
    required: true,
    unique: true,
    index: true,
    min: 1
  },
  frequencyName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    index: true
  },
  frequencyType: {
    type: String,
    required: true,
    enum: Object.values(FrequencyType),
    index: true
  },
  isSelectable: {
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
InsuranceFrequencySchema.index({ isSelectable: 1, displayOrder: 1 });
InsuranceFrequencySchema.index({ frequencyType: 1, isSelectable: 1 });

// Text search index
InsuranceFrequencySchema.index({
  frequencyName: 'text'
});

// Instance methods
InsuranceFrequencySchema.methods.getFrequencyType = function(): FrequencyType {
  const name = this.frequencyName.toLowerCase();
  
  if (name.includes('select')) {return FrequencyType.SELECT;}
  if (name.includes('per year') || name.includes('year')) {return FrequencyType.YEARLY;}
  if (name.includes('months after')) {return FrequencyType.ROLLING;}
  if (name.includes('number per')) {return FrequencyType.NUMERIC;}
  
  return FrequencyType.SELECT; // default
};

InsuranceFrequencySchema.methods.isValidSelection = function(): boolean {
  return this.frequencyType !== FrequencyType.SELECT;
};

InsuranceFrequencySchema.methods.getDisplayName = function(): string {
  return this.frequencyName.trim();
};

// Static methods
InsuranceFrequencySchema.statics.getSelectableFrequencies = function() {
  return this.find({ 
    isSelectable: true,
    frequencyType: { $ne: FrequencyType.SELECT }
  }).sort({ displayOrder: 1 });
};

InsuranceFrequencySchema.statics.getByKey = function(frequencyKey: number) {
  return this.findOne({ frequencyKey });
};

InsuranceFrequencySchema.statics.getByType = function(frequencyType: FrequencyType) {
  return this.find({ frequencyType }).sort({ displayOrder: 1 });
};

InsuranceFrequencySchema.statics.getAllFrequencies = function() {
  return this.find({}).sort({ displayOrder: 1 });
};

// Pre-save middleware
InsuranceFrequencySchema.pre('save', function(next) {
  this.dateModified = new Date();
  
  // Auto-derive frequency type if not set
  if (!this.frequencyType) {
    this.frequencyType = this.getFrequencyType();
  }
  
  // Set selectability based on type
  this.isSelectable = this.frequencyType !== FrequencyType.SELECT;
  
  // Set display order based on type and key
  if (!this.displayOrder || this.displayOrder === 1) {
    this.displayOrder = this.frequencyKey;
  }
  
  next();
});

// Add static methods to the schema
InsuranceFrequencySchema.statics.getAllFrequencies = function() {
  return this.find({}).sort({ displayOrder: 1 });
};

InsuranceFrequencySchema.statics.getSelectableFrequencies = function() {
  return this.find({ isSelectable: true }).sort({ displayOrder: 1 });
};

InsuranceFrequencySchema.statics.getByKey = function(frequencyKey: number) {
  return this.findOne({ frequencyKey });
};

// InsuranceFrequency model interface with static methods
interface IInsuranceFrequencyModel extends Model<IInsuranceFrequency> {
  getAllFrequencies(): any;
  getSelectableFrequencies(): any;
  getByKey(key: number): any;
}

export const InsuranceFrequencyModel = model<IInsuranceFrequency, IInsuranceFrequencyModel>('InsuranceFrequency', InsuranceFrequencySchema);
