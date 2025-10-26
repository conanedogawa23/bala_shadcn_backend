import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Payment Method Lookup Table Model
 * Maps to MSSQL: sb_paymentMethod
 * Purpose: Store payment method codes (Cash, Credit Card, Cheque, etc.)
 */

export interface IPaymentMethod extends Document {
  _id: mongoose.Types.ObjectId;
  sb_paymentMethod_key: number;          // sb_paymentMethod_key - Primary key from MSSQL
  sb_paymentMethod_name: string;         // sb_paymentMethod_name - Payment method name (e.g., 'Cash')
  createdAt: Date;
  updatedAt: Date;
}

const PaymentMethodSchema = new Schema<IPaymentMethod>({
  sb_paymentMethod_key: {
    type: Number,
    required: true,
    unique: true,
    index: true,
    min: 1
  },
  sb_paymentMethod_name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
    unique: true,
    index: true
  }
}, {
  timestamps: true,
  collection: 'paymentMethods'
});

// Static method to find by name
PaymentMethodSchema.statics.findByName = function(name: string) {
  return this.findOne({ sb_paymentMethod_name: name });
};

// Static method to get all methods
PaymentMethodSchema.statics.getAllMethods = function() {
  return this.find().sort({ sb_paymentMethod_key: 1 });
};

export interface IPaymentMethodModel extends Model<IPaymentMethod> {
  findByName(name: string): Promise<IPaymentMethod | null>;
  getAllMethods(): Promise<IPaymentMethod[]>;
}

export const PaymentMethodModel = mongoose.model<IPaymentMethod, IPaymentMethodModel>('PaymentMethod', PaymentMethodSchema);
export default PaymentMethodModel;
