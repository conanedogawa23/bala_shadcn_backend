import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Payment Type Lookup Table Model
 * Maps to MSSQL: sb_paymentType
 * Purpose: Store payment type codes (POP, DPA, COB_1, Insurance, etc.)
 */

export interface IPaymentType extends Document {
  _id: mongoose.Types.ObjectId;
  sb_paymentType_key: number;           // sb_paymentType_key - Primary key from MSSQL
  sb_paymentType_name: string;          // sb_paymentType_name - Payment type name (e.g., 'POP', 'DPA')
  createdAt: Date;
  updatedAt: Date;
}

const PaymentTypeSchema = new Schema<IPaymentType>({
  sb_paymentType_key: {
    type: Number,
    required: true,
    unique: true,
    index: true,
    min: 1
  },
  sb_paymentType_name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    unique: true,
    index: true
  }
}, {
  timestamps: true,
  collection: 'paymentTypes'
});

// Static method to find by name
PaymentTypeSchema.statics.findByName = function(name: string) {
  return this.findOne({ sb_paymentType_name: name });
};

// Static method to get all types
PaymentTypeSchema.statics.getAllTypes = function() {
  return this.find().sort({ sb_paymentType_key: 1 });
};

export interface IPaymentTypeModel extends Model<IPaymentType> {
  findByName(name: string): Promise<IPaymentType | null>;
  getAllTypes(): Promise<IPaymentType[]>;
}

export const PaymentTypeModel = mongoose.model<IPaymentType, IPaymentTypeModel>('PaymentType', PaymentTypeSchema);
export default PaymentTypeModel;
