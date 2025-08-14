import { Schema, model, Document } from 'mongoose';

export interface IInsurance {
  type: '1st' | '2nd' | '3rd';
  policyHolder: string;
  policyHolderName?: string;
  company: string;
  companyAddress?: string;
  groupNumber?: string;
  certificateNumber?: string;
  coverage: {
    orthotics?: number;
    physiotherapy?: number;
    massage?: number;
    orthopedicShoes?: number;
    compressionStockings?: number;
    other?: number;
    numberOfOrthotics?: string;
    totalAmountPerOrthotic?: number;
    totalAmountPerYear?: number;
    frequency?: string;
    numOrthoticsPerYear?: string;
  };
  birthday?: {
    day?: string;
    month?: string;
    year?: string;
  };
}

export interface IClient extends Document {
  clientId: string;
  personalInfo: {
    firstName: string;
    lastName: string;
    fullName: string;
    dateOfBirth?: Date;
    gender: 'Male' | 'Female' | 'Other';
  };
  contact: {
    address: {
      street?: string;
      apartment?: string;
      city: string;
      province: string;
      postalCode?: string;
    };
    phones: {
      home?: string;
      cell?: string;
      work?: string;
      workExtension?: string;
    };
    email?: string;
    company?: string;
    companyOther?: string;
  };
  medical: {
    familyMD?: string;
    referringMD?: string;
    csrName?: string;
    location?: string;
    dpa1st?: string;
    dpa2nd?: string;
    dpa3rd?: string;
  };
  insurance: IInsurance[];
  clinics: string[];
  defaultClinic: string;
  isActive: boolean;
  dateCreated: Date;
  dateModified: Date;
  
  // Instance methods
  getFullName(): string;
  getAge(): number | null;
  getPrimaryInsurance(): IInsurance | null;
  hasInsurance(): boolean;
  
  // Static methods
  static findByClinic(clinicName: string): Promise<IClient[]>;
  static searchClients(searchTerm: string, clinicName?: string): Promise<IClient[]>;
}

const InsuranceSchema = new Schema<IInsurance>({
  type: {
    type: String,
    enum: ['1st', '2nd', '3rd'],
    required: true
  },
  policyHolder: {
    type: String,
    required: true,
    trim: true
  },
  policyHolderName: {
    type: String,
    trim: true
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
  groupNumber: {
    type: String,
    trim: true
  },
  certificateNumber: {
    type: String,
    trim: true
  },
  coverage: {
    orthotics: Number,
    physiotherapy: Number,
    massage: Number,
    orthopedicShoes: Number,
    compressionStockings: Number,
    other: Number,
    numberOfOrthotics: String,
    totalAmountPerOrthotic: Number,
    totalAmountPerYear: Number,
    frequency: String,
    numOrthoticsPerYear: String
  },
  birthday: {
    day: String,
    month: String,
    year: String
  }
});

const ClientSchema = new Schema<IClient>({
  clientId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
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
    dateOfBirth: {
      type: Date
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
        type: String,
        trim: true,
        uppercase: true,
        maxlength: 10
      }
    },
    phones: {
      home: {
        type: String,
        trim: true,
        maxlength: 20
      },
      cell: {
        type: String,
        trim: true,
        maxlength: 20
      },
      work: {
        type: String,
        trim: true,
        maxlength: 20
      },
      workExtension: {
        type: String,
        trim: true,
        maxlength: 10
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
    },
    dpa1st: {
      type: String,
      trim: true,
      maxlength: 20
    },
    dpa2nd: {
      type: String,
      trim: true,
      maxlength: 20
    },
    dpa3rd: {
      type: String,
      trim: true,
      maxlength: 20
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
    trim: true,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
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
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes for performance
ClientSchema.index({ clientId: 1 }, { unique: true });
ClientSchema.index({ defaultClinic: 1 });
ClientSchema.index({ 'personalInfo.lastName': 1, 'personalInfo.firstName': 1 });
ClientSchema.index({ 'contact.email': 1 });
ClientSchema.index({ isActive: 1 });
ClientSchema.index({ dateCreated: -1 });

// Text index for search
ClientSchema.index({
  'personalInfo.firstName': 'text',
  'personalInfo.lastName': 'text',
  'personalInfo.fullName': 'text',
  'contact.email': 'text'
});

// Instance methods
ClientSchema.methods.getFullName = function(): string {
  return `${this.personalInfo.lastName}, ${this.personalInfo.firstName}`;
};

ClientSchema.methods.getAge = function(): number | null {
  if (!this.personalInfo.dateOfBirth) return null;
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

ClientSchema.methods.hasInsurance = function(): boolean {
  return this.insurance.length > 0;
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

// Pre-save middleware
ClientSchema.pre('save', function(next) {
  this.dateModified = new Date();
  
  // Auto-generate fullName if not provided
  if (!this.personalInfo.fullName) {
    this.personalInfo.fullName = `${this.personalInfo.lastName}, ${this.personalInfo.firstName}`;
  }
  
  next();
});

export const ClientModel = model<IClient>('Client', ClientSchema);
