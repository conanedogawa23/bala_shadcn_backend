import { Schema, model, Document, Model } from 'mongoose';

export enum BillingStatus {
  ACTIVE = 'Active',
  INACTIVE = 'Inactive',
  CANCELLED = 'Cancel',
  SUSPENDED = 'Suspended',
  COMPLETED = 'Completed'
}

export interface IAdvancedBilling extends Document {
  billingId: number; // Id from MSSQL
  clientId: number; // ClientId from MSSQL (now NUMBER for consistency)
  clientKey?: number; // Original numeric ClientId for reference
  startDate: Date; // StartDate - when billing cycle begins
  endDate: Date; // EndDate - when billing cycle ends
  productKey: number; // ProductKey - reference to product/service
  billDate: Date; // BillDate - when to generate bill
  isActive: boolean; // IsActive - whether billing is active
  status: BillingStatus; // Status - current billing status
  clinicName: string; // ClinicName - associated clinic
  
  // Computed fields
  isCurrentlyActive: boolean; // Based on dates and status
  daysRemaining: number; // Days until end date
  billingCycleDays: number; // Total days in billing cycle
  isOverdue: boolean; // If bill date has passed
  
  // Audit fields
  dateCreated: Date;
  dateModified: Date;
  
  // Instance methods
  calculateDaysRemaining(): number;
  calculateBillingCycleDays(): number;
  isCurrentlyActiveStatus(): boolean;
  isOverdueBilling(): boolean;
  activate(): Promise<void>;
  deactivate(): Promise<void>;
  cancel(): Promise<void>;
  complete(): Promise<void>;
  suspend(): Promise<void>;
  updateBillDate(newBillDate: Date): Promise<void>;
}

interface IAdvancedBillingModel extends Model<IAdvancedBilling> {
  getActiveBillings(): any;
  getBillingsByClient(clientId: number): any; // Changed from string to number
  getBillingsByClinic(clinicName: string): any;
  getOverdueBillings(): any;
  getUpcomingBillings(days?: number): any;
  getBillingsExpiringSoon(days?: number): any;
  bulkUpdateBillDates(updates: Array<{ billingId: number; billDate: Date }>): any;
}

const AdvancedBillingSchema = new Schema<IAdvancedBilling>({
  billingId: {
    type: Number,
    required: true,
    unique: true,
    index: true,
    min: 1
  },
  clientId: {
    type: Number,
    required: true,
    index: true
  },
  clientKey: {
    type: Number,
    index: true
  },
  startDate: {
    type: Date,
    required: true,
    index: true
  },
  endDate: {
    type: Date,
    required: true,
    index: true
  },
  productKey: {
    type: Number,
    required: true,
    index: true,
    min: 1
  },
  billDate: {
    type: Date,
    required: true,
    index: true
  },
  isActive: {
    type: Boolean,
    required: true,
    default: true,
    index: true
  },
  status: {
    type: String,
    required: true,
    enum: Object.values(BillingStatus),
    default: BillingStatus.ACTIVE,
    index: true
  },
  clinicName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    index: true
  },
  isCurrentlyActive: {
    type: Boolean,
    index: true
  },
  daysRemaining: {
    type: Number,
    index: true
  },
  billingCycleDays: {
    type: Number,
    min: 1
  },
  isOverdue: {
    type: Boolean,
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
AdvancedBillingSchema.index({ clientId: 1, isActive: 1, status: 1 });
AdvancedBillingSchema.index({ clinicName: 1, isActive: 1 });
AdvancedBillingSchema.index({ billDate: 1, isActive: 1 });
AdvancedBillingSchema.index({ startDate: 1, endDate: 1 });
AdvancedBillingSchema.index({ productKey: 1, isActive: 1 });
AdvancedBillingSchema.index({ isOverdue: 1, isActive: 1 });

// Instance methods
AdvancedBillingSchema.methods.calculateDaysRemaining = function(): number {
  const today = new Date();
  const end = new Date(this.endDate);
  const diffTime = end.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
};

AdvancedBillingSchema.methods.calculateBillingCycleDays = function(): number {
  const start = new Date(this.startDate);
  const end = new Date(this.endDate);
  const diffTime = end.getTime() - start.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

AdvancedBillingSchema.methods.isCurrentlyActiveStatus = function(): boolean {
  const today = new Date();
  const start = new Date(this.startDate);
  const end = new Date(this.endDate);
  
  return this.isActive && 
         this.status === BillingStatus.ACTIVE &&
         today >= start && 
         today <= end;
};

AdvancedBillingSchema.methods.isOverdueBilling = function(): boolean {
  const today = new Date();
  const billDate = new Date(this.billDate);
  
  return this.isActive && 
         this.status === BillingStatus.ACTIVE &&
         today > billDate;
};

AdvancedBillingSchema.methods.activate = async function(): Promise<void> {
  this.isActive = true;
  this.status = BillingStatus.ACTIVE;
  this.dateModified = new Date();
  await this.save();
};

AdvancedBillingSchema.methods.deactivate = async function(): Promise<void> {
  this.isActive = false;
  this.status = BillingStatus.INACTIVE;
  this.dateModified = new Date();
  await this.save();
};

AdvancedBillingSchema.methods.cancel = async function(): Promise<void> {
  this.isActive = false;
  this.status = BillingStatus.CANCELLED;
  this.dateModified = new Date();
  await this.save();
};

AdvancedBillingSchema.methods.complete = async function(): Promise<void> {
  this.isActive = false;
  this.status = BillingStatus.COMPLETED;
  this.dateModified = new Date();
  await this.save();
};

AdvancedBillingSchema.methods.suspend = async function(): Promise<void> {
  this.status = BillingStatus.SUSPENDED;
  this.dateModified = new Date();
  await this.save();
};

AdvancedBillingSchema.methods.updateBillDate = async function(newBillDate: Date): Promise<void> {
  this.billDate = newBillDate;
  this.dateModified = new Date();
  await this.save();
};

// Static methods
AdvancedBillingSchema.statics.getActiveBillings = function() {
  return this.find({ 
    isActive: true, 
    status: BillingStatus.ACTIVE 
  }).sort({ billDate: 1 });
};

AdvancedBillingSchema.statics.getBillingsByClient = function(clientId: number) {
  return this.find({ clientId }).sort({ startDate: -1 });
};

AdvancedBillingSchema.statics.getBillingsByClinic = function(clinicName: string) {
  return this.find({ clinicName }).sort({ billDate: 1 });
};

AdvancedBillingSchema.statics.getOverdueBillings = function() {
  const today = new Date();
  return this.find({
    isActive: true,
    status: BillingStatus.ACTIVE,
    billDate: { $lt: today }
  }).sort({ billDate: 1 });
};

AdvancedBillingSchema.statics.getUpcomingBillings = function(days = 30) {
  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + days);
  
  return this.find({
    isActive: true,
    status: BillingStatus.ACTIVE,
    billDate: { $gte: today, $lte: futureDate }
  }).sort({ billDate: 1 });
};

AdvancedBillingSchema.statics.getBillingsByProduct = function(productKey: number) {
  return this.find({ productKey }).sort({ startDate: -1 });
};

AdvancedBillingSchema.statics.getBillingsExpiringSoon = function(days = 7) {
  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + days);
  
  return this.find({
    isActive: true,
    status: BillingStatus.ACTIVE,
    endDate: { $gte: today, $lte: futureDate }
  }).sort({ endDate: 1 });
};

AdvancedBillingSchema.statics.getBillingsByStatus = function(status: BillingStatus) {
  return this.find({ status }).sort({ dateModified: -1 });
};

AdvancedBillingSchema.statics.getBillingsByDateRange = function(startDate: Date, endDate: Date) {
  return this.find({
    $or: [
      { startDate: { $gte: startDate, $lte: endDate } },
      { endDate: { $gte: startDate, $lte: endDate } },
      { 
        startDate: { $lte: startDate }, 
        endDate: { $gte: endDate } 
      }
    ]
  }).sort({ startDate: 1 });
};

AdvancedBillingSchema.statics.updateBillingStatus = async function(billingId: number, status: BillingStatus): Promise<IAdvancedBilling | null> {
  const billing = await this.findOne({ billingId });
  if (!billing) {return null;}
  
  billing.status = status;
  billing.isActive = [BillingStatus.ACTIVE, BillingStatus.SUSPENDED].includes(status);
  billing.dateModified = new Date();
  
  await billing.save();
  return billing;
};

AdvancedBillingSchema.statics.bulkUpdateBillDates = async function(updates: Array<{ billingId: number; billDate: Date }>): Promise<void> {
  const operations = updates.map(update => ({
    updateOne: {
      filter: { billingId: update.billingId },
      update: { 
        billDate: update.billDate,
        dateModified: new Date()
      }
    }
  }));
  
  await this.bulkWrite(operations);
};

// Pre-save middleware
AdvancedBillingSchema.pre('save', function(next) {
  this.dateModified = new Date();
  
  // Ensure clientKey is set from clientId if possible
  if (!this.clientKey && this.clientId) {
    const numericClientId = parseInt(this.clientId.toString()); // Ensure it's a number
    if (!isNaN(numericClientId)) {
      this.clientKey = numericClientId;
    }
  }
  
  // Calculate computed fields
  this.daysRemaining = this.calculateDaysRemaining();
  this.billingCycleDays = this.calculateBillingCycleDays();
  this.isCurrentlyActive = this.isCurrentlyActiveStatus();
  this.isOverdue = this.isOverdueBilling();
  
  // Validate date logic
  if (this.endDate <= this.startDate) {
    next(new Error('End date must be after start date'));
    return;
  }
  
  // Ensure inactive status for non-active states
  if ([BillingStatus.CANCELLED, BillingStatus.COMPLETED, BillingStatus.INACTIVE].includes(this.status)) {
    this.isActive = false;
  }
  
  next();
});

export const AdvancedBillingModel = model<IAdvancedBilling, IAdvancedBillingModel>('AdvancedBilling', AdvancedBillingSchema);
