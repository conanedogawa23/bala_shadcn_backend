import mongoose, { Schema, Document, Model, Types } from 'mongoose';

// Payment Status based on MSSQL structure
export enum PaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  PARTIAL = 'partial',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  WRITEOFF = 'writeoff'
}

// Canadian Healthcare Payment Types (from MSSQL structure)
export enum PaymentType {
  POP = 'POP',                    // Patient Out of Pocket
  POPFP = 'POPFP',               // Patient Out of Pocket - Final Payment
  DPA = 'DPA',                   // Direct Payment Authorization
  DPAFP = 'DPAFP',               // DPA Final Payment
  COB_1 = 'COB_1',               // Coordination of Benefits - Primary
  COB_2 = 'COB_2',               // Coordination of Benefits - Secondary
  COB_3 = 'COB_3',               // Coordination of Benefits - Tertiary
  INSURANCE_1ST = 'INSURANCE_1ST', // 1st Insurance Payment
  INSURANCE_2ND = 'INSURANCE_2ND', // 2nd Insurance Payment
  INSURANCE_3RD = 'INSURANCE_3RD', // 3rd Insurance Payment
  SALES_REFUND = 'SALES_REFUND',   // Sales Refund
  WRITEOFF = 'WRITEOFF',           // Write-off Amount
  NO_INSUR_FP = 'NO_INSUR_FP'     // No Insurance Final Payment
}

// Payment Methods from MSSQL structure
export enum PaymentMethod {
  CASH = 'Cash',
  CREDIT_CARD = 'Credit Card',
  DEBIT = 'Debit',
  CHEQUE = 'Cheque',
  INSURANCE = 'Insurance',
  BANK_TRANSFER = 'Bank Transfer',
  OTHER = 'Other'
}

// Payment Amount Breakdown (based on MSSQL sb_payment_history structure)
export interface IPaymentAmounts {
  totalPaymentAmount: number;      // sb_payment_total_payment_amount
  totalPaid: number;               // sb_payment_total_paid
  totalOwed: number;               // sb_payment_total_owed
  
  // Canadian Healthcare Payment Types
  popAmount: number;               // sb_payment_POP_amount
  popfpAmount: number;             // sb_payment_POPFP_amount
  dpaAmount: number;               // sb_payment_DPA_amount
  dpafpAmount: number;             // sb_payment_DPAFP_amount
  
  // Coordination of Benefits
  cob1Amount: number;              // sb_payment_COB_1_amount
  cob2Amount: number;              // sb_payment_COB_2_amount
  cob3Amount: number;              // sb_payment_COB_3_amount
  
  // Insurance Payments
  insurance1stAmount: number;      // sb_payment_1st_insurance_cheque_amount
  insurance2ndAmount: number;      // sb_payment_2nd_insurance_cheque_amount
  insurance3rdAmount: number;      // sb_payment_3rd_insurance_cheque_amount
  
  // Other Amounts
  refundAmount: number;            // sb_payment_refund_amount
  salesRefundAmount: number;       // sb_payment_SALESREFUND_amount
  writeoffAmount: number;          // sb_payment_WRITEOFF_amount
  noInsurFpAmount: number;         // sb_no_insur_fp
  badDebtAmount: number;           // BadDebtAmount
}

// Payment Interface
export interface IPayment extends Document {
  _id: Types.ObjectId;
  
  // Core Payment Information (based on MSSQL structure)
  paymentNumber?: string;          // sb_payment_number (auto-generated) - optional for backwards compatibility
  paymentId?: string;              // Primary payment identifier (actual database field)
  orderNumber?: string;            // sb_order_number
  clientId: number;                // sb_client_id (matches MSSQL)
  clientName?: string;             // Derived from clientId
  clinicName: string;              // sb_clinic_name
  
  // Payment Details
  paymentDate: Date;               // sb_payment_date
  paymentMethod: PaymentMethod;    // sb_payment_method
  paymentType: PaymentType;        // sb_payment_type
  status: PaymentStatus;           // sb_payment_status
  
  // Amount Breakdown
  amounts: IPaymentAmounts;
  
  // References and Notes
  referringNo?: string;            // sb_payment_referring_no
  notes?: string;                  // sb_payment_note
  
  // Order/Appointment Link
  orderId?: Types.ObjectId;        // Link to Order/Appointment
  advancedBillingId?: number;      // AdvancedBillingId from MSSQL
  
  // Audit Fields (matching MSSQL structure)
  deletedStatus?: string;          // sb_deleted_status
  userLoginName?: string;          // UserLoginName
  debuggingColumn?: string;        // sb_debugging_column
  createdAt: Date;                 // sb_date_created
  updatedAt: Date;
  
  // MongoDB specific
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  
  // Instance Methods
  calculateTotal(): number;
  isFullyPaid(): boolean;
  getOutstandingAmount(): number;
  canRefund(): boolean;
  processRefund(amount: number, refundType: PaymentType): Promise<IPayment>;
  addPaymentAmount(paymentType: PaymentType, amount: number): void;
}

// Payment Amounts Schema
const PaymentAmountsSchema = new Schema<IPaymentAmounts>({
  totalPaymentAmount: { type: Number, default: 0, min: 0 },
  totalPaid: { type: Number, default: 0, min: 0 },
  totalOwed: { type: Number, default: 0, min: 0 },
  
  // Canadian Healthcare Payment Types
  popAmount: { type: Number, default: 0, min: 0 },
  popfpAmount: { type: Number, default: 0, min: 0 },
  dpaAmount: { type: Number, default: 0, min: 0 },
  dpafpAmount: { type: Number, default: 0, min: 0 },
  
  // Coordination of Benefits
  cob1Amount: { type: Number, default: 0, min: 0 },
  cob2Amount: { type: Number, default: 0, min: 0 },
  cob3Amount: { type: Number, default: 0, min: 0 },
  
  // Insurance Payments
  insurance1stAmount: { type: Number, default: 0, min: 0 },
  insurance2ndAmount: { type: Number, default: 0, min: 0 },
  insurance3rdAmount: { type: Number, default: 0, min: 0 },
  
  // Other Amounts
  refundAmount: { type: Number, default: 0, min: 0 },
  salesRefundAmount: { type: Number, default: 0, min: 0 },
  writeoffAmount: { type: Number, default: 0, min: 0 },
  noInsurFpAmount: { type: Number, default: 0, min: 0 },
  badDebtAmount: { type: Number, default: 0, min: 0 }
});

// Payment Schema
const PaymentSchema = new Schema<IPayment>({
  paymentNumber: {
    type: String,
    required: false, // Made optional since data uses paymentId
    unique: true,
    trim: true,
    index: true,
    sparse: true // Allow multiple null values
  },
  paymentId: {
    type: String,
    required: false, // Made optional for backwards compatibility
    unique: true,
    trim: true,
    index: true,
    sparse: true // Allow multiple null values
  },
  orderNumber: {
    type: String,
    trim: true,
    index: true
  },
  clientId: {
    type: Number,
    required: true,
    index: true
  },
  clientName: {
    type: String,
    trim: true,
    maxlength: 200
  },
  clinicName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    index: true
  },
  paymentDate: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  paymentMethod: {
    type: String,
    enum: Object.values(PaymentMethod),
    required: true,
    index: true
  },
  paymentType: {
    type: String,
    enum: Object.values(PaymentType),
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: Object.values(PaymentStatus),
    required: true,
    default: PaymentStatus.PENDING,
    index: true
  },
  amounts: {
    type: PaymentAmountsSchema,
    required: true
  },
  referringNo: {
    type: String,
    trim: true,
    maxlength: 30
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 100
  },
  orderId: {
    type: Schema.Types.ObjectId,
    ref: 'Order',
    index: true
  },
  advancedBillingId: {
    type: Number,
    index: true
  },
  deletedStatus: {
    type: String,
    trim: true,
    maxlength: 50
  },
  userLoginName: {
    type: String,
    trim: true,
    maxlength: 25
  },
  debuggingColumn: {
    type: String,
    trim: true,
    maxlength: 50
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  collection: 'payments'
});

// Indexes for efficient queries (based on MSSQL usage patterns)
PaymentSchema.index({ clinicName: 1, paymentDate: -1 });
PaymentSchema.index({ clientId: 1, paymentDate: -1 });
PaymentSchema.index({ status: 1, paymentDate: -1 });
PaymentSchema.index({ paymentMethod: 1, paymentType: 1 });
PaymentSchema.index({ orderNumber: 1 });
PaymentSchema.index({ 'amounts.totalOwed': 1 }); // For outstanding payments

// Pre-save middleware
PaymentSchema.pre<IPayment>('save', async function(next) {
  // Generate payment number if new
  if (this.isNew && !this.paymentNumber) {
    try {
      const counter = await mongoose.connection.collection('counters').findOneAndUpdate(
        { _id: 'paymentNumber' } as any,
        { $inc: { sequence: 1 } },
        { upsert: true, returnDocument: 'after' }
      );
      const sequence = counter?.value?.sequence || counter?.sequence || 1;
      this.paymentNumber = `PAY-${String(sequence).padStart(8, '0')}`;
    } catch (error) {
      // Fallback to timestamp-based ID if counter fails
      this.paymentNumber = `PAY-${Date.now().toString().slice(-8)}`;
    }
  }
  
  // Calculate totals if amounts changed
  if (this.isModified('amounts')) {
    this.calculateTotal();
  }
  
  // Auto-set status based on payment amounts
  const totalPaid = this.amounts.totalPaid;
  const totalAmount = this.amounts.totalPaymentAmount;
  
  if (totalPaid === 0) {
    this.status = PaymentStatus.PENDING;
  } else if (totalPaid >= totalAmount) {
    this.status = PaymentStatus.COMPLETED;
  } else if (totalPaid > 0 && totalPaid < totalAmount) {
    this.status = PaymentStatus.PARTIAL;
  }
  
  // Update totalOwed
  this.amounts.totalOwed = Math.max(0, totalAmount - totalPaid);
  
  next();
});

// Instance Methods
PaymentSchema.methods.calculateTotal = function(): number {
  const amounts = this.amounts;
  
  // Sum all payment amounts (excluding refunds and writeoffs)
  const totalPaid = amounts.popAmount + amounts.popfpAmount + 
                   amounts.dpaAmount + amounts.dpafpAmount +
                   amounts.cob1Amount + amounts.cob2Amount + amounts.cob3Amount +
                   amounts.insurance1stAmount + amounts.insurance2ndAmount + amounts.insurance3rdAmount +
                   amounts.noInsurFpAmount;
  
  this.amounts.totalPaid = Math.round(totalPaid * 100) / 100;
  this.amounts.totalOwed = Math.max(0, this.amounts.totalPaymentAmount - this.amounts.totalPaid);
  
  return this.amounts.totalPaid;
};

PaymentSchema.methods.isFullyPaid = function(): boolean {
  return this.amounts.totalPaid >= this.amounts.totalPaymentAmount;
};

PaymentSchema.methods.getOutstandingAmount = function(): number {
  return Math.max(0, this.amounts.totalPaymentAmount - this.amounts.totalPaid);
};

PaymentSchema.methods.canRefund = function(): boolean {
  return this.status === PaymentStatus.COMPLETED && this.amounts.totalPaid > 0;
};

PaymentSchema.methods.processRefund = async function(amount: number, refundType: PaymentType = PaymentType.SALES_REFUND): Promise<IPayment> {
  if (!this.canRefund()) {
    throw new Error('Payment cannot be refunded');
  }
  
  if (amount > this.amounts.totalPaid) {
    throw new Error('Refund amount cannot exceed paid amount');
  }
  
  // Add refund amount
  if (refundType === PaymentType.SALES_REFUND) {
    this.amounts.salesRefundAmount += amount;
  } else {
    this.amounts.refundAmount += amount;
  }
  
  // Recalculate totals
  this.amounts.totalPaid -= amount;
  this.amounts.totalOwed = Math.max(0, this.amounts.totalPaymentAmount - this.amounts.totalPaid);
  
  // Update status
  if (this.amounts.totalPaid === 0) {
    this.status = PaymentStatus.REFUNDED;
  } else if (this.amounts.totalPaid < this.amounts.totalPaymentAmount) {
    this.status = PaymentStatus.PARTIAL;
  }
  
  return this.save();
};

PaymentSchema.methods.addPaymentAmount = function(paymentType: PaymentType, amount: number): void {
  const roundedAmount = Math.round(amount * 100) / 100;
  
  switch (paymentType) {
    case PaymentType.POP:
      this.amounts.popAmount += roundedAmount;
      break;
    case PaymentType.POPFP:
      this.amounts.popfpAmount += roundedAmount;
      break;
    case PaymentType.DPA:
      this.amounts.dpaAmount += roundedAmount;
      break;
    case PaymentType.DPAFP:
      this.amounts.dpafpAmount += roundedAmount;
      break;
    case PaymentType.COB_1:
      this.amounts.cob1Amount += roundedAmount;
      break;
    case PaymentType.COB_2:
      this.amounts.cob2Amount += roundedAmount;
      break;
    case PaymentType.COB_3:
      this.amounts.cob3Amount += roundedAmount;
      break;
    case PaymentType.INSURANCE_1ST:
      this.amounts.insurance1stAmount += roundedAmount;
      break;
    case PaymentType.INSURANCE_2ND:
      this.amounts.insurance2ndAmount += roundedAmount;
      break;
    case PaymentType.INSURANCE_3RD:
      this.amounts.insurance3rdAmount += roundedAmount;
      break;
    case PaymentType.NO_INSUR_FP:
      this.amounts.noInsurFpAmount += roundedAmount;
      break;
    default:
      throw new Error(`Unsupported payment type: ${paymentType}`);
  }
  
  this.calculateTotal();
};

// Static Methods Interface
interface IPaymentModel extends Model<IPayment> {
  findByClinic(clinicName: string): Promise<IPayment[]>;
  findByClient(clientId: number): Promise<IPayment[]>;
  findByOrder(orderNumber: string): Promise<IPayment[]>;
  findByStatus(status: PaymentStatus): Promise<IPayment[]>;
  findOutstandingPayments(clinicName?: string): Promise<IPayment[]>;
  findByPaymentType(paymentType: PaymentType): Promise<IPayment[]>;
  getTotalRevenue(clinicName?: string, startDate?: Date, endDate?: Date): Promise<number>;
  getPaymentStats(clinicName?: string): Promise<any>;
  getPaymentMethodStats(clinicName?: string): Promise<any>;
}

// Static Methods
PaymentSchema.statics.findByClinic = function(clinicName: string) {
  return this.find({ clinicName }).sort({ paymentDate: -1 });
};

PaymentSchema.statics.findByClient = function(clientId: number) {
  return this.find({ clientId }).sort({ paymentDate: -1 });
};

PaymentSchema.statics.findByOrder = function(orderNumber: string) {
  return this.find({ orderNumber }).sort({ paymentDate: -1 });
};

PaymentSchema.statics.findByStatus = function(status: PaymentStatus) {
  return this.find({ status }).sort({ paymentDate: -1 });
};

PaymentSchema.statics.findOutstandingPayments = function(clinicName?: string) {
  const match: any = { 'amounts.totalOwed': { $gt: 0 } };
  if (clinicName) {
    match.clinicName = clinicName;
  }
  return this.find(match).sort({ paymentDate: 1 });
};

PaymentSchema.statics.findByPaymentType = function(paymentType: PaymentType) {
  return this.find({ paymentType }).sort({ paymentDate: -1 });
};

PaymentSchema.statics.getTotalRevenue = function(clinicName?: string, startDate?: Date, endDate?: Date) {
  const match: any = {};
  if (clinicName) {
    match.clinicName = clinicName;
  }
  if (startDate || endDate) {
    match.paymentDate = {};
    if (startDate) match.paymentDate.$gte = startDate;
    if (endDate) match.paymentDate.$lte = endDate;
  }
  
  return this.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: '$amounts.totalPaid' } } }
  ]).then(result => result[0]?.total || 0);
};

PaymentSchema.statics.getPaymentStats = function(clinicName?: string) {
  const match: any = {};
  if (clinicName) {
    match.clinicName = clinicName;
  }
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amounts.totalPaymentAmount' },
        totalPaid: { $sum: '$amounts.totalPaid' },
        totalOwed: { $sum: '$amounts.totalOwed' }
      }
    }
  ]);
};

PaymentSchema.statics.getPaymentMethodStats = function(clinicName?: string) {
  const match: any = {};
  if (clinicName) {
    match.clinicName = clinicName;
  }
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          method: '$paymentMethod',
          type: '$paymentType'
        },
        count: { $sum: 1 },
        totalAmount: { $sum: '$amounts.totalPaid' }
      }
    }
  ]);
};

// Export the model
export const PaymentModel = mongoose.model<IPayment, IPaymentModel>('Payment', PaymentSchema);
export default PaymentModel;
