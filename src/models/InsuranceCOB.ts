import { Schema, model, Document } from 'mongoose';

export enum COBStatus {
  NO = 'NO',
  YES = 'YES'
}

export interface IInsuranceCOB extends Document {
  cobKey: number; // sb_1st_insurance_cob_key from MSSQL
  cobName: string; // sb_1st_insurance_cob_name from MSSQL
  cobStatus: COBStatus; // derived from name (YES/NO)
  
  // Computed fields
  cobValue: boolean; // Boolean representation of YES/NO
  isDefault: boolean; // Whether this is the default selection
  displayOrder: number; // Order for UI display
  
  // Audit fields
  dateCreated: Date;
  dateModified: Date;
  
  // Instance methods
  getCOBStatus(): COBStatus;
  getBooleanValue(): boolean;
  isPositive(): boolean;
  getDisplayName(): string;
}

const InsuranceCOBSchema = new Schema<IInsuranceCOB>({
  cobKey: {
    type: Number,
    required: true,
    unique: true,
    index: true,
    min: 1
  },
  cobName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    index: true,
    validate: {
      validator: (v: string) => ['YES', 'NO'].includes(v.trim().toUpperCase()),
      message: 'COB name must be either YES or NO'
    }
  },
  cobStatus: {
    type: String,
    required: true,
    enum: Object.values(COBStatus),
    index: true
  },
  cobValue: {
    type: Boolean,
    required: true,
    index: true
  },
  isDefault: {
    type: Boolean,
    required: true,
    default: false,
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
InsuranceCOBSchema.index({ cobValue: 1, displayOrder: 1 });
InsuranceCOBSchema.index({ isDefault: 1, displayOrder: 1 });

// Text search index
InsuranceCOBSchema.index({
  cobName: 'text'
});

// Instance methods
InsuranceCOBSchema.methods.getCOBStatus = function(): COBStatus {
  const name = this.cobName.toUpperCase().trim();
  
  if (name === 'YES') {return COBStatus.YES;}
  if (name === 'NO') {return COBStatus.NO;}
  
  return COBStatus.NO; // default to NO if unclear
};

InsuranceCOBSchema.methods.getBooleanValue = function(): boolean {
  return this.cobStatus === COBStatus.YES;
};

InsuranceCOBSchema.methods.isPositive = function(): boolean {
  return this.cobStatus === COBStatus.YES;
};

InsuranceCOBSchema.methods.getDisplayName = function(): string {
  switch (this.cobStatus) {
  case COBStatus.YES:
    return 'Yes';
  case COBStatus.NO:
    return 'No';
  default:
    return this.cobName.trim();
  }
};

// Static methods
InsuranceCOBSchema.statics.getAllCOBOptions = function() {
  return this.find({}).sort({ displayOrder: 1 });
};

InsuranceCOBSchema.statics.getByKey = function(cobKey: number) {
  return this.findOne({ cobKey });
};

InsuranceCOBSchema.statics.getByStatus = function(cobStatus: COBStatus) {
  return this.findOne({ cobStatus });
};

InsuranceCOBSchema.statics.getByValue = function(cobValue: boolean) {
  return this.findOne({ cobValue });
};

InsuranceCOBSchema.statics.getDefault = function() {
  return this.findOne({ isDefault: true });
};

InsuranceCOBSchema.statics.getYesOption = function() {
  return this.findOne({ cobStatus: COBStatus.YES });
};

InsuranceCOBSchema.statics.getNoOption = function() {
  return this.findOne({ cobStatus: COBStatus.NO });
};

InsuranceCOBSchema.statics.setDefault = async function(cobKey: number): Promise<IInsuranceCOB | null> {
  // First, unset all defaults
  await this.updateMany({}, { isDefault: false });
  
  // Then set the new default
  const cob = await this.findOneAndUpdate(
    { cobKey },
    { isDefault: true, dateModified: new Date() },
    { new: true }
  );
  
  return cob;
};

// Pre-save middleware
InsuranceCOBSchema.pre('save', function(next) {
  this.dateModified = new Date();
  
  // Auto-derive COB status if not set
  if (!this.cobStatus) {
    this.cobStatus = this.getCOBStatus();
  }
  
  // Set boolean value based on status
  this.cobValue = this.getBooleanValue();
  
  // Set display order based on logical ordering (NO first, then YES)
  if (!this.displayOrder || this.displayOrder === 1) {
    this.displayOrder = this.cobStatus === COBStatus.NO ? 1 : 2;
  }
  
  // Set default if this is the NO option and no default exists
  if (this.cobStatus === COBStatus.NO && !this.isDefault) {
    this.checkAndSetDefault();
  }
  
  next();
});

// Helper method to check and set default
InsuranceCOBSchema.methods.checkAndSetDefault = async function(): Promise<void> {
  const existingDefault = await this.constructor.findOne({ isDefault: true });
  if (!existingDefault) {
    this.isDefault = true;
  }
};

// Ensure only one default exists
InsuranceCOBSchema.pre('save', async function(next) {
  if (this.isDefault && this.isModified('isDefault')) {
    // Unset other defaults
    await this.constructor.updateMany(
      { _id: { $ne: this._id } },
      { isDefault: false }
    );
  }
  next();
});

export const InsuranceCOBModel = model<IInsuranceCOB>('InsuranceCOB', InsuranceCOBSchema);
