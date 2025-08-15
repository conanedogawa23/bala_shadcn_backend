import { Schema, model, Document, Model } from 'mongoose';

export interface IInsuranceCompanyAddress extends Document {
  addressKey: number; // sb_1st_insurance_company_address_key from MSSQL
  addressName: string; // sb_1st_insurance_company_address_name
  companyName: string; // sb_1st_insurance_company_name
  city: string; // sb_1st_insurance_company_city
  province: string; // sb_1st_insurance_company_province
  postalCodeFirst3: string; // sb_1st_insurance_company_postalCode_first3Digits
  postalCodeLast3: string; // sb_1st_insurance_company_postalCode_last3Digits
  
  // Computed fields
  fullPostalCode: string; // Combines first3 + last3
  
  // Audit fields
  dateCreated: Date;
  dateModified: Date;
  
  // Instance methods
  getFullPostalCode(): string;
  getFormattedAddress(): string;
}

const InsuranceCompanyAddressSchema = new Schema<IInsuranceCompanyAddress>({
  addressKey: {
    type: Number,
    required: true,
    unique: true,
    index: true
  },
  addressName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
    index: true
  },
  companyName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
    index: true
  },
  city: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    index: true
  },
  province: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    index: true
  },
  postalCodeFirst3: {
    type: String,
    required: true,
    trim: true,
    maxlength: 3,
    uppercase: true
  },
  postalCodeLast3: {
    type: String,
    required: true,
    trim: true,
    maxlength: 3,
    uppercase: true
  },
  fullPostalCode: {
    type: String,
    trim: true,
    maxlength: 7,
    uppercase: true,
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
InsuranceCompanyAddressSchema.index({ companyName: 1, city: 1 });
InsuranceCompanyAddressSchema.index({ province: 1, city: 1 });
InsuranceCompanyAddressSchema.index({ fullPostalCode: 1 });

// Text search index
InsuranceCompanyAddressSchema.index({
  addressName: 'text',
  companyName: 'text',
  city: 'text'
});

// Instance methods
InsuranceCompanyAddressSchema.methods.getFullPostalCode = function(): string {
  if (this.fullPostalCode) {return this.fullPostalCode;}
  
  const first3 = (this.postalCodeFirst3 || '').trim().toUpperCase();
  const last3 = (this.postalCodeLast3 || '').trim().toUpperCase();
  
  if (first3 && last3) {
    return `${first3} ${last3}`;
  }
  return first3 + last3;
};

InsuranceCompanyAddressSchema.methods.getFormattedAddress = function(): string {
  const parts = [
    this.addressName?.trim(),
    this.city?.trim(),
    this.province?.trim(),
    this.getFullPostalCode()
  ].filter(part => part && part.length > 0);
  
  return parts.join(', ');
};

// Static methods
InsuranceCompanyAddressSchema.statics.findByCompany = function(companyName: string) {
  return this.find({ 
    companyName: new RegExp(companyName, 'i') 
  }).sort({ addressName: 1 });
};

InsuranceCompanyAddressSchema.statics.findByProvince = function(province: string) {
  return this.find({ 
    province: new RegExp(province, 'i') 
  }).sort({ city: 1, addressName: 1 });
};

InsuranceCompanyAddressSchema.statics.findByCity = function(city: string) {
  return this.find({ 
    city: new RegExp(city, 'i') 
  }).sort({ companyName: 1, addressName: 1 });
};

InsuranceCompanyAddressSchema.statics.findByPostalCode = function(postalCode: string) {
  // Handle both "K1A 0A6" and "K1A0A6" formats
  const cleanPostal = postalCode.replace(/\s+/g, '').toUpperCase();
  
  if (cleanPostal.length >= 6) {
    const first3 = cleanPostal.substring(0, 3);
    const last3 = cleanPostal.substring(3, 6);
    
    return this.find({ 
      postalCodeFirst3: first3,
      postalCodeLast3: last3
    });
  }
  
  // Partial match
  return this.find({
    $or: [
      { postalCodeFirst3: new RegExp(`^${cleanPostal}`, 'i') },
      { fullPostalCode: new RegExp(cleanPostal, 'i') }
    ]
  });
};

// Pre-save middleware
InsuranceCompanyAddressSchema.pre('save', function(next) {
  this.dateModified = new Date();
  
  // Auto-generate full postal code
  this.fullPostalCode = this.getFullPostalCode();
  
  // Ensure proper casing
  if (this.postalCodeFirst3) {
    this.postalCodeFirst3 = this.postalCodeFirst3.trim().toUpperCase();
  }
  if (this.postalCodeLast3) {
    this.postalCodeLast3 = this.postalCodeLast3.trim().toUpperCase();
  }
  
  next();
});

// InsuranceCompanyAddress model interface with static methods
interface IInsuranceCompanyAddressModel extends Model<IInsuranceCompanyAddress> {
  findByCompany(companyName: string): any;
  findByProvince(province: string): any;
  findByCity(city: string): any;
  findByPostalCode(postalCode: string): any;
}

export const InsuranceCompanyAddressModel = model<IInsuranceCompanyAddress, IInsuranceCompanyAddressModel>('InsuranceCompanyAddress', InsuranceCompanyAddressSchema);
