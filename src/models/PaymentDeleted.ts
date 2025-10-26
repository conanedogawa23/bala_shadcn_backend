import mongoose, { Schema, Document, Model, Types } from 'mongoose';

/**
 * Payment Deleted/Archived Model
 * Maps to MSSQL: sb_payment_history_deleted
 * Purpose: Archive and track deleted payment records
 */

export interface IPaymentDeleted extends Document {
  _id: Types.ObjectId;
  
  // Original payment data
  sb_payment_history_key: number;                         // sb_payment_history_key from MSSQL
  sb_client_id: number;                                   // sb_client_id
  sb_order_number?: string;                               // sb_order_number
  sb_payment_number?: string;                             // sb_payment_number
  sb_payment_date?: Date;                                 // sb_payment_date
  
  // Payment amounts (from MSSQL)
  sb_payment_total_payment_amount?: number;               // sb_payment_total_payment_amount
  sb_payment_total_paid?: number;                         // sb_payment_total_paid
  sb_payment_total_owed?: number;                         // sb_payment_total_owed
  sb_payment_POP_amount?: number;                         // sb_payment_POP_amount
  sb_payment_POPFP_amount?: number;                       // sb_payment_POPFP_amount
  sb_payment_DPA_amount?: number;                         // sb_payment_DPA_amount
  sb_payment_DPAFP_amount?: number;                       // sb_payment_DPAFP_amount
  sb_payment_WRITEOFF_amount?: number;                    // sb_payment_WRITEOFF_amount
  sb_payment_COB_1_amount?: number;                       // sb_payment_COB_1_amount
  sb_payment_COB_2_amount?: number;                       // sb_payment_COB_2_amount
  sb_payment_COB_3_amount?: number;                       // sb_payment_COB_3_amount
  sb_payment_1st_insurance_cheque_amount?: number;        // sb_payment_1st_insurance_cheque_amount
  sb_payment_2nd_insurance_cheque_amount?: number;        // sb_payment_2nd_insurance_cheque_amount
  sb_payment_3rd_insurance_cheque_amount?: number;        // sb_payment_3rd_insurance_cheque_amount
  sb_payment_refund_amount?: number;                      // sb_payment_refund_amount
  sb_payment_SALESREFUND_amount?: number;                 // sb_payment_SALESREFUND_amount
  
  // Payment metadata
  sb_payment_method?: string;                             // sb_payment_method
  sb_payment_type?: string;                               // sb_payment_type
  sb_payment_status?: string;                             // sb_payment_status
  sb_payment_referring_no?: string;                       // sb_payment_referring_no
  sb_payment_note?: string;                               // sb_payment_note
  
  // Deletion audit info
  sb_deleted_status?: string;                             // sb_deleted_status
  sb_clinic_name?: string;                                // sb_clinic_name
  sb_date_created?: Date;                                 // sb_date_created
  sb_debugging_column?: string;                           // sb_debugging_column
  sb_no_insur_fp?: number;                                // sb_no_insur_fp
  UserLoginName?: string;                                 // UserLoginName
  BadDebtAmount?: number;                                 // BadDebtAmount
  
  // MongoDB audit
  archivedAt: Date;
  archivedReason?: string;
  archivedBy?: Types.ObjectId;
  originalPaymentId?: Types.ObjectId;  // Link to original payment if it exists
  isRestored?: boolean;                // Track if restored from archive
  restoredAt?: Date;
  restoredBy?: Types.ObjectId;
}

const PaymentDeletedSchema = new Schema<IPaymentDeleted>({
  sb_payment_history_key: {
    type: Number,
    required: true,
    index: true
  },
  sb_client_id: {
    type: Number,
    required: true,
    index: true
  },
  sb_order_number: {
    type: String,
    trim: true,
    maxlength: 50,
    index: true
  },
  sb_payment_number: {
    type: String,
    trim: true,
    maxlength: 50,
    index: true
  },
  sb_payment_date: Date,
  
  // Payment amounts
  sb_payment_total_payment_amount: { type: Number, default: 0, min: 0 },
  sb_payment_total_paid: { type: Number, default: 0, min: 0 },
  sb_payment_total_owed: { type: Number, default: 0, min: 0 },
  sb_payment_POP_amount: { type: Number, default: 0, min: 0 },
  sb_payment_POPFP_amount: { type: Number, default: 0, min: 0 },
  sb_payment_DPA_amount: { type: Number, default: 0, min: 0 },
  sb_payment_DPAFP_amount: { type: Number, default: 0, min: 0 },
  sb_payment_WRITEOFF_amount: { type: Number, default: 0, min: 0 },
  sb_payment_COB_1_amount: { type: Number, default: 0, min: 0 },
  sb_payment_COB_2_amount: { type: Number, default: 0, min: 0 },
  sb_payment_COB_3_amount: { type: Number, default: 0, min: 0 },
  sb_payment_1st_insurance_cheque_amount: { type: Number, default: 0, min: 0 },
  sb_payment_2nd_insurance_cheque_amount: { type: Number, default: 0, min: 0 },
  sb_payment_3rd_insurance_cheque_amount: { type: Number, default: 0, min: 0 },
  sb_payment_refund_amount: { type: Number, default: 0, min: 0 },
  sb_payment_SALESREFUND_amount: { type: Number, default: 0, min: 0 },
  
  // Payment metadata
  sb_payment_method: { type: String, trim: true, maxlength: 100 },
  sb_payment_type: { type: String, trim: true, maxlength: 100 },
  sb_payment_status: { type: String, trim: true, maxlength: 100 },
  sb_payment_referring_no: { type: String, trim: true, maxlength: 30 },
  sb_payment_note: { type: String, trim: true, maxlength: 100 },
  
  // Deletion info
  sb_deleted_status: { type: String, trim: true, maxlength: 50 },
  sb_clinic_name: { type: String, trim: true, maxlength: 100, index: true },
  sb_date_created: Date,
  sb_debugging_column: { type: String, trim: true, maxlength: 50 },
  sb_no_insur_fp: { type: Number, default: 0, min: 0 },
  UserLoginName: { type: String, trim: true, maxlength: 25 },
  BadDebtAmount: { type: Number, default: 0, min: 0 },
  
  // Archive metadata
  archivedAt: { type: Date, default: Date.now, index: true },
  archivedReason: String,
  archivedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  originalPaymentId: { type: Schema.Types.ObjectId, ref: 'Payment', index: true },
  isRestored: { type: Boolean, default: false, index: true },
  restoredAt: Date,
  restoredBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: false,
  collection: 'paymentDeleted'
});

// Index for efficient archival queries
PaymentDeletedSchema.index({ sb_client_id: 1, archivedAt: -1 });
PaymentDeletedSchema.index({ sb_clinic_name: 1, archivedAt: -1 });
PaymentDeletedSchema.index({ isRestored: 1, archivedAt: -1 });

// Static method to find archived payments by client
PaymentDeletedSchema.statics.findByClient = function(clientId: number) {
  return this.find({ sb_client_id: clientId }).sort({ archivedAt: -1 });
};

// Static method to find archived payments by clinic
PaymentDeletedSchema.statics.findByClinic = function(clinicName: string) {
  return this.find({ sb_clinic_name: clinicName }).sort({ archivedAt: -1 });
};

// Static method to find unrestored archives
PaymentDeletedSchema.statics.findUnrestored = function() {
  return this.find({ isRestored: false }).sort({ archivedAt: -1 });
};

// Static method to restore an archived payment
PaymentDeletedSchema.statics.restore = async function(archiveId: Types.ObjectId, userId: Types.ObjectId) {
  const archived = await this.findById(archiveId);
  if (!archived) return null;
  
  archived.isRestored = true;
  archived.restoredAt = new Date();
  archived.restoredBy = userId;
  return archived.save();
};

export interface IPaymentDeletedModel extends Model<IPaymentDeleted> {
  findByClient(clientId: number): Promise<IPaymentDeleted[]>;
  findByClinic(clinicName: string): Promise<IPaymentDeleted[]>;
  findUnrestored(): Promise<IPaymentDeleted[]>;
  restore(archiveId: Types.ObjectId, userId: Types.ObjectId): Promise<IPaymentDeleted | null>;
}

export const PaymentDeletedModel = mongoose.model<IPaymentDeleted, IPaymentDeletedModel>('PaymentDeleted', PaymentDeletedSchema);
export default PaymentDeletedModel;
