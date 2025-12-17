import { Schema, model, Document, Model } from 'mongoose';

export interface IInsurance {
  type: '1st' | '2nd' | '3rd';
  dpa: boolean; // sb_*_DPA field from MSSQL (converted to boolean)
  policyHolder: string; // sb_*_insurance_policy_holder from MSSQL
  cob: string; // sb_*_insurance_cob from MSSQL
  policyHolderName: string; // sb_*_insurance_policy_holder_name from MSSQL
  birthday: {
    day?: string; // sb_*_insurance_birthday_day from MSSQL
    month?: string; // sb_*_insurance_birthday_month from MSSQL
    year?: string; // sb_*_insurance_birthday_year from MSSQL
  };
  company: string; // sb_*_insurance_insurance_company from MSSQL
  companyAddress: string; // sb_*_insurance_company_address from MSSQL
  city: string; // sb_*_insurance_city from MSSQL
  province: string; // sb_*_insurance_province from MSSQL
  postalCode: {
    first3: string; // sb_*_insurance_postal_code_first3Digits from MSSQL
    last3: string; // sb_*_insurance_postal_code_last3Digits from MSSQL
  };
  groupNumber: string; // sb_*_insurance_group_number from MSSQL
  certificateNumber: string; // sb_*_insurance_certificate_number from MSSQL
  coverage: {
    numberOfOrthotics: string; // sb_*_coverage_numberOfOrthotics from MSSQL
    totalAmountPerOrthotic: number; // sb_*_coverage_totalAmountPerOrthotic from MSSQL
    totalAmountPerYear: number; // sb_*_coverage_totalAmountPerYear from MSSQL
    frequency: string; // sb_*_coverage_frequency from MSSQL
    numOrthoticsPerYear: string; // sb_*_coverage_num_orthotics_per_year from MSSQL
    orthopedicShoes: number; // sb_*_coverage_orthopedic_shoes from MSSQL
    compressionStockings: number; // sb_*_coverage_comp_stockings from MSSQL
    physiotherapy: number; // sb_*_coverage_physiotherapy from MSSQL
    massage: number; // sb_*_coverage_massage from MSSQL
    other: number; // sb_*_coverage_other from MSSQL
  };
}

export interface IClient extends Document {
  clientId: string; // sb_clients_id from MSSQL (stored as STRING in MongoDB)
  clientKey?: number; // sb_clients_key from MSSQL (stored as NUMBER in MongoDB)
  personalInfo: {
    firstName: string; // sb_clients_first_name from MSSQL
    lastName: string; // sb_clients_last_name from MSSQL
    fullName: string; // computed field
    fullNameForAutocomplete: string; // sb_clients_full_name_for_autocomplete from MSSQL
    dateOfBirth?: Date; // computed from birthday fields
    birthday: {
      day: string; // sb_clients_birthday_day from MSSQL
      month: string; // sb_clients_birthday_month from MSSQL
      year: string; // sb_clients_birthday_year from MSSQL
    };
    gender: string; // sb_clients_gender from MSSQL (char 20)
  };
  contact: {
    address: {
      street: string;
      apartment?: string;
      city: string;
      province: string;
      postalCode: {
        first3: string;
        last3: string;
        full: string; // computed field
      };
    };
    phones: {
      home?: {
        countryCode: string;
        areaCode: string;
        number: string;
        full: string; // computed field
      };
      cell?: {
        countryCode: string;
        areaCode: string;
        number: string;
        full: string; // computed field
      };
      work?: {
        countryCode: string;
        areaCode: string;
        number: string;
        extension?: string;
        full: string; // computed field
      };
    };
    email?: string;
    company?: string;
    companyOther?: string;
  };
  medical: {
    familyMD?: string;
    referringMD?: string;
    csrName?: string; // Customer Service Representative
    location?: string; // sb_clients_location
  };
  insurance: IInsurance[]; // Up to 3 insurance plans
  clinics: string[]; // Associated clinic names
  defaultClinic: string; // sb_default_clinic
  clinicId?: string; // Legacy field for older records
  isActive: boolean;
  dateCreated: Date; // sb_clients_date_created
  dateModified: Date;
  
  // Referral tracking
  referralTypeId?: number; // sb_referral_type_id from MSSQL
  referralSubtypeId?: number; // sb_referral_subtype_id from MSSQL

  // Additional fields from MSSQL
  firstInsuranceBirthdayDayTmp?: string; // sb_clients_1st_insurance_birthday_day_tmp from MSSQL

  // Instance methods
  getFullName(): string;
  getAge(): number | null;
  getPrimaryInsurance(): IInsurance | null;
  getSecondaryInsurance(): IInsurance | null;
  getTertiaryInsurance(): IInsurance | null;
  hasInsurance(): boolean;
  hasDPA(): boolean;
  getFormattedPhone(type: 'home' | 'cell' | 'work'): string | null;
}

interface IClientModel extends Model<IClient> {
  searchClients(searchTerm: string, clinicName?: string): any;
}

const InsuranceSchema = new Schema<IInsurance>({
  type: {
    type: String,
    enum: ['1st', '2nd', '3rd'],
    required: true
  },
  dpa: {
    type: Boolean,
    default: false
  },
  policyHolder: {
    type: String,
    required: true,
    trim: true
  },
  cob: {
    type: String,
    trim: true,
    default: 'NO'
  },
  policyHolderName: {
    type: String,
    trim: true
  },
  birthday: {
    day: String,
    month: String,
    year: String
  },
  company: {
    type: String,
    required: true,
    trim: true
  },
  companyAddress: {
    type: String,
    trim: true
  },
  city: {
    type: String,
    trim: true
  },
  province: {
    type: String,
    trim: true
  },
  postalCode: {
    first3: String,
    last3: String
  },
  groupNumber: {
    type: String,
    trim: true
  },
  certificateNumber: {
    type: String,
    trim: true
  },
  coverage: {
    numberOfOrthotics: String,
    totalAmountPerOrthotic: { type: Number, default: 0 },
    totalAmountPerYear: { type: Number, default: 0 },
    frequency: String,
    numOrthoticsPerYear: String,
    orthopedicShoes: { type: Number, default: 0 },
    compressionStockings: { type: Number, default: 0 },
    physiotherapy: { type: Number, default: 0 },
    massage: { type: Number, default: 0 },
    other: { type: Number, default: 0 }
  }
});

const ClientSchema = new Schema<IClient>({
  clientId: {
    type: String, // Stored as String in MongoDB (migrated from MSSQL)
    required: true,
    unique: true,
    trim: true
  },
  clientKey: {
    type: Number
  },
  personalInfo: {
    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    fullNameForAutocomplete: {
      type: String,
      trim: true,
      maxlength: 200
    },
    dateOfBirth: {
      type: Date
    },
    birthday: {
      day: { type: String, trim: true },
      month: { type: String, trim: true },
      year: { type: String, trim: true }
    },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other'],
      default: 'Other'
    }
  },
  contact: {
    address: {
      street: {
        type: String,
        trim: true,
        maxlength: 200
      },
      apartment: {
        type: String,
        trim: true,
        maxlength: 20
      },
      city: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
      },
      province: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
      },
      postalCode: {
        first3: { type: String, trim: true, uppercase: true },
        last3: { type: String, trim: true, uppercase: true },
        full: { type: String, trim: true, uppercase: true } // computed
      }
    },
    phones: {
      home: {
        countryCode: String,
        areaCode: String,
        number: String,
        full: String // computed
      },
      cell: {
        countryCode: String,
        areaCode: String,
        number: String,
        full: String // computed
      },
      work: {
        countryCode: String,
        areaCode: String,
        number: String,
        extension: String,
        full: String // computed
      }
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 100,
      match: [/\S+@\S+\.\S+/, 'Invalid email format']
    },
    company: {
      type: String,
      trim: true,
      maxlength: 200
    },
    companyOther: {
      type: String,
      trim: true,
      maxlength: 200
    }
  },
  medical: {
    familyMD: {
      type: String,
      trim: true,
      maxlength: 100
    },
    referringMD: {
      type: String,
      trim: true,
      maxlength: 100
    },
    csrName: {
      type: String,
      trim: true,
      maxlength: 100
    },
    location: {
      type: String,
      trim: true,
      maxlength: 200
    }
  },
  insurance: [InsuranceSchema],
  clinics: [{
    type: String,
    trim: true
  }],
  defaultClinic: {
    type: String,
    required: true,
    trim: true
  },
  clinicId: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  dateCreated: {
    type: Date,
    default: Date.now
  },
  dateModified: {
    type: Date,
    default: Date.now
  },
  referralTypeId: {
    type: Number // sb_referral_type_id from MSSQL
  },
  referralSubtypeId: {
    type: Number // sb_referral_subtype_id from MSSQL
  },
  firstInsuranceBirthdayDayTmp: {
    type: String, // sb_clients_1st_insurance_birthday_day_tmp from MSSQL
    trim: true,
    maxlength: 500
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

// Indexes for performance
// Note: clientId already has unique index from unique: true in schema
ClientSchema.index({ clientKey: 1 });
ClientSchema.index({ defaultClinic: 1 });
ClientSchema.index({ 'personalInfo.lastName': 1, 'personalInfo.firstName': 1 });
ClientSchema.index({ 'personalInfo.fullNameForAutocomplete': 1 });
ClientSchema.index({ 'contact.email': 1 });
ClientSchema.index({ isActive: 1 });
ClientSchema.index({ dateCreated: -1 });

// Text index for search
ClientSchema.index({
  'personalInfo.firstName': 'text',
  'personalInfo.lastName': 'text',
  'personalInfo.fullName': 'text',
  'personalInfo.fullNameForAutocomplete': 'text',
  'contact.email': 'text'
});

// Instance methods
ClientSchema.methods.getFullName = function(): string {
  return this.personalInfo.fullName || `${this.personalInfo.lastName}, ${this.personalInfo.firstName}`;
};

ClientSchema.methods.getAge = function(): number | null {
  if (!this.personalInfo.dateOfBirth) {return null;}
  const today = new Date();
  const birthDate = new Date(this.personalInfo.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
};

ClientSchema.methods.getPrimaryInsurance = function(): IInsurance | null {
  return this.insurance.find((ins: IInsurance) => ins.type === '1st') || null;
};

ClientSchema.methods.getSecondaryInsurance = function(): IInsurance | null {
  return this.insurance.find((ins: IInsurance) => ins.type === '2nd') || null;
};

ClientSchema.methods.getTertiaryInsurance = function(): IInsurance | null {
  return this.insurance.find((ins: IInsurance) => ins.type === '3rd') || null;
};

ClientSchema.methods.hasInsurance = function(): boolean {
  return this.insurance.length > 0;
};

ClientSchema.methods.hasDPA = function(): boolean {
  return this.insurance.some((ins: IInsurance) => ins.dpa === true);
};

ClientSchema.methods.getFormattedPhone = function(type: 'home' | 'cell' | 'work'): string | null {
  const phone = this.contact.phones[type];
  if (!phone) {return null;}
  
  if (phone.full) {return phone.full;}
  
  if (phone.countryCode && phone.areaCode && phone.number) {
    const formatted = `(${phone.areaCode}) ${phone.number}`;
    return phone.extension ? `${formatted} ext. ${phone.extension}` : formatted;
  }
  
  return null;
};

// Static methods
ClientSchema.statics.findByClinic = function(clinicName: string) {
  return this.find({ 
    defaultClinic: clinicName,
    isActive: true 
  }).sort({ 'personalInfo.lastName': 1, 'personalInfo.firstName': 1 });
};

ClientSchema.statics.searchClients = function(searchTerm: string, clinicName?: string) {
  const query: any = {
    $text: { $search: searchTerm },
    isActive: true
  };
  
  if (clinicName) {
    query.defaultClinic = clinicName;
  }
  
  return this.find(query, { score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' } });
};

ClientSchema.statics.findWithInsurance = function(clinicName?: string) {
  const query: any = {
    isActive: true,
    'insurance.0': { $exists: true }
  };
  
  if (clinicName) {
    query.defaultClinic = clinicName;
  }
  
  return this.find(query).sort({ 'personalInfo.lastName': 1 });
};

// Pre-save middleware
ClientSchema.pre('save', function(next) {
  this.dateModified = new Date();
  
  // Auto-generate fullName if not provided
  if (!this.personalInfo.fullName) {
    this.personalInfo.fullName = `${this.personalInfo.lastName}, ${this.personalInfo.firstName}`;
  }
  
  // Auto-generate fullNameForAutocomplete
  if (!this.personalInfo.fullNameForAutocomplete) {
    this.personalInfo.fullNameForAutocomplete = this.personalInfo.fullName;
  }
  
  // Generate computed fields for postal code
  if (this.contact.address.postalCode.first3 && this.contact.address.postalCode.last3) {
    this.contact.address.postalCode.full = `${this.contact.address.postalCode.first3} ${this.contact.address.postalCode.last3}`;
  }
  
  // Generate computed fields for phone numbers using for...of (avoiding forEach per coding standards)
  const phoneTypes: Array<keyof IClient['contact']['phones']> = ['home', 'cell', 'work'];
  for (const type of phoneTypes) {
    const phone = this.contact.phones[type];
    if (phone && phone.countryCode && phone.areaCode && phone.number) {
      phone.full = `(${phone.areaCode}) ${phone.number}`;
      if (type === 'work' && 'extension' in phone && phone.extension) {
        phone.full += ` ext. ${phone.extension}`;
      }
    }
  }
  
  // Parse birthday to dateOfBirth if available
  if (this.personalInfo.birthday.day && this.personalInfo.birthday.month && this.personalInfo.birthday.year) {
    const day = parseInt(this.personalInfo.birthday.day);
    const month = parseInt(this.personalInfo.birthday.month);
    const year = parseInt(this.personalInfo.birthday.year);
    
    if (!isNaN(day) && !isNaN(month) && !isNaN(year) && 
        day > 0 && day <= 31 && month > 0 && month <= 12 && year > 1900 && year < 2030) {
      this.personalInfo.dateOfBirth = new Date(year, month - 1, day);
    }
  }
  
  next();
});

export const ClientModel = model<IClient, IClientModel>('Client', ClientSchema);
