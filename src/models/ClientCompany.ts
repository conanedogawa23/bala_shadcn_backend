import mongoose, { Schema, Document } from 'mongoose';

export interface IClientCompany extends Document {
  id: number;
  companyName: string;
  displayName?: string;
  industry?: string;
  companySize?: 'small' | 'medium' | 'large' | 'enterprise';
  isActive: boolean;
  
  // Contact information
  contact?: {
    address?: {
      street?: string;
      city?: string;
      province?: string;
      postalCode?: string;
      country?: string;
    };
    phone?: string;
    fax?: string;
    email?: string;
    website?: string;
  };
  
  // Business details
  business?: {
    registrationNumber?: string;
    taxNumber?: string;
    sicCode?: string;
    naicsCode?: string;
    foundedYear?: number;
    parentCompany?: string;
  };
  
  // Insurance and benefits
  insurance?: {
    hasGroupInsurance: boolean;
    insuranceProvider?: string;
    policyNumber?: string;
    effectiveDate?: Date;
    renewalDate?: Date;
    coverageDetails?: {
      dental?: boolean;
      vision?: boolean;
      physiotherapy?: boolean;
      massage?: boolean;
      orthotics?: boolean;
    };
  };
  
  // Employee statistics
  stats: {
    totalEmployees: number;
    activeClients: number;
    totalAppointments: number;
    totalBilledAmount: number;
    averageClaimAmount: number;
    lastActivityDate?: Date;
  };
  
  // Administrative
  notes?: string;
  tags?: string[];
  createdAt: Date;
  modifiedAt?: Date;
  createdBy?: string;
}

const ClientCompanySchema = new Schema<IClientCompany>({
  id: {
    type: Number,
    required: true,
    unique: true,
    index: true
  },
  companyName: {
    type: String,
    required: true,
    maxlength: 200,
    index: true,
    trim: true
  },
  displayName: {
    type: String,
    maxlength: 200,
    trim: true
  },
  industry: {
    type: String,
    maxlength: 100,
    index: true
  },
  companySize: {
    type: String,
    enum: ['small', 'medium', 'large', 'enterprise'],
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  contact: {
    address: {
      street: {
        type: String,
        maxlength: 200
      },
      city: {
        type: String,
        maxlength: 100
      },
      province: {
        type: String,
        maxlength: 50
      },
      postalCode: {
        type: String,
        maxlength: 20
      },
      country: {
        type: String,
        maxlength: 50,
        default: 'Canada'
      }
    },
    phone: {
      type: String,
      maxlength: 50
    },
    fax: {
      type: String,
      maxlength: 50
    },
    email: {
      type: String,
      maxlength: 200,
      lowercase: true
    },
    website: {
      type: String,
      maxlength: 200
    }
  },
  business: {
    registrationNumber: {
      type: String,
      maxlength: 50
    },
    taxNumber: {
      type: String,
      maxlength: 50
    },
    sicCode: {
      type: String,
      maxlength: 10
    },
    naicsCode: {
      type: String,
      maxlength: 10
    },
    foundedYear: {
      type: Number,
      min: 1800,
      max: new Date().getFullYear()
    },
    parentCompany: {
      type: String,
      maxlength: 200
    }
  },
  insurance: {
    hasGroupInsurance: {
      type: Boolean,
      default: false,
      index: true
    },
    insuranceProvider: {
      type: String,
      maxlength: 200
    },
    policyNumber: {
      type: String,
      maxlength: 100
    },
    effectiveDate: {
      type: Date,
      index: true
    },
    renewalDate: {
      type: Date,
      index: true
    },
    coverageDetails: {
      dental: {
        type: Boolean,
        default: false
      },
      vision: {
        type: Boolean,
        default: false
      },
      physiotherapy: {
        type: Boolean,
        default: false
      },
      massage: {
        type: Boolean,
        default: false
      },
      orthotics: {
        type: Boolean,
        default: false
      }
    }
  },
  stats: {
    totalEmployees: {
      type: Number,
      default: 0,
      min: 0
    },
    activeClients: {
      type: Number,
      default: 0,
      min: 0
    },
    totalAppointments: {
      type: Number,
      default: 0,
      min: 0
    },
    totalBilledAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    averageClaimAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    lastActivityDate: {
      type: Date,
      index: true
    }
  },
  notes: {
    type: String,
    maxlength: 2000
  },
  tags: [{
    type: String,
    maxlength: 50
  }],
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  modifiedAt: {
    type: Date,
    index: true
  },
  createdBy: {
    type: String,
    maxlength: 100
  }
}, {
  timestamps: true,
  collection: 'client_companies'
});

// Compound indexes for optimal performance
ClientCompanySchema.index({ companyName: 1, isActive: 1 });
ClientCompanySchema.index({ industry: 1, isActive: 1 });
ClientCompanySchema.index({ companySize: 1, isActive: 1 });
ClientCompanySchema.index({ 'insurance.hasGroupInsurance': 1, isActive: 1 });
ClientCompanySchema.index({ 'stats.activeClients': -1 });
ClientCompanySchema.index({ 'contact.address.city': 1, 'contact.address.province': 1 });

// Text search index
ClientCompanySchema.index({
  companyName: 'text',
  displayName: 'text',
  industry: 'text',
  notes: 'text'
});

// Instance methods
ClientCompanySchema.methods.updateStats = function(statsUpdate: {
  employees?: number;
  clients?: number;
  appointments?: number;
  billedAmount?: number;
}): void {
  if (statsUpdate.employees !== undefined) {
    this.stats.totalEmployees = statsUpdate.employees;
  }
  
  if (statsUpdate.clients !== undefined) {
    this.stats.activeClients = statsUpdate.clients;
  }
  
  if (statsUpdate.appointments !== undefined) {
    this.stats.totalAppointments += statsUpdate.appointments;
  }
  
  if (statsUpdate.billedAmount !== undefined) {
    this.stats.totalBilledAmount += statsUpdate.billedAmount;
    
    // Recalculate average
    if (this.stats.totalAppointments > 0) {
      this.stats.averageClaimAmount = this.stats.totalBilledAmount / this.stats.totalAppointments;
    }
  }
  
  this.stats.lastActivityDate = new Date();
  this.modifiedAt = new Date();
};

ClientCompanySchema.methods.addEmployee = function(): void {
  this.stats.totalEmployees += 1;
  this.modifiedAt = new Date();
};

ClientCompanySchema.methods.removeEmployee = function(): void {
  if (this.stats.totalEmployees > 0) {
    this.stats.totalEmployees -= 1;
    this.modifiedAt = new Date();
  }
};

ClientCompanySchema.methods.hasInsuranceCoverage = function(serviceType: string): boolean {
  if (!this.insurance?.hasGroupInsurance || !this.insurance.coverageDetails) {
    return false;
  }
  
  const coverageMap: Record<string, boolean> = {
    'dental': this.insurance.coverageDetails.dental || false,
    'vision': this.insurance.coverageDetails.vision || false,
    'physiotherapy': this.insurance.coverageDetails.physiotherapy || false,
    'massage': this.insurance.coverageDetails.massage || false,
    'orthotics': this.insurance.coverageDetails.orthotics || false
  };
  
  return coverageMap[serviceType] || false;
};

ClientCompanySchema.methods.getDisplayName = function(): string {
  return this.displayName || this.companyName;
};

// Static methods
ClientCompanySchema.statics.findByIndustry = function(industry: string) {
  return this.find({ 
    industry: new RegExp(industry, 'i'), 
    isActive: true 
  })
    .sort({ companyName: 1 })
    .lean();
};

ClientCompanySchema.statics.findWithGroupInsurance = function() {
  return this.find({ 
    'insurance.hasGroupInsurance': true, 
    isActive: true 
  })
    .sort({ companyName: 1 })
    .lean();
};

ClientCompanySchema.statics.findBySize = function(size: string) {
  return this.find({ 
    companySize: size, 
    isActive: true 
  })
    .sort({ 'stats.activeClients': -1 })
    .lean();
};

ClientCompanySchema.statics.searchCompanies = function(searchTerm: string, limit = 20) {
  return this.find({
    $text: { $search: searchTerm },
    isActive: true
  })
    .select('companyName displayName industry companySize stats.activeClients')
    .sort({ score: { $meta: 'textScore' } })
    .limit(limit)
    .lean();
};

ClientCompanySchema.statics.getTopCompanies = function(limit = 10) {
  return this.find({ isActive: true })
    .sort({ 'stats.activeClients': -1, 'stats.totalBilledAmount': -1 })
    .limit(limit)
    .lean();
};

ClientCompanySchema.statics.getIndustryStats = function() {
  return this.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: '$industry',
        totalCompanies: { $sum: 1 },
        totalEmployees: { $sum: '$stats.totalEmployees' },
        totalClients: { $sum: '$stats.activeClients' },
        totalRevenue: { $sum: '$stats.totalBilledAmount' },
        companiesWithInsurance: {
          $sum: { $cond: ['$insurance.hasGroupInsurance', 1, 0] }
        }
      }
    },
    {
      $project: {
        industry: '$_id',
        totalCompanies: 1,
        totalEmployees: 1,
        totalClients: 1,
        totalRevenue: 1,
        companiesWithInsurance: 1,
        insuranceRate: {
          $cond: [
            { $gt: ['$totalCompanies', 0] },
            { $divide: ['$companiesWithInsurance', '$totalCompanies'] },
            0
          ]
        }
      }
    },
    { $sort: { totalRevenue: -1 } }
  ]);
};

ClientCompanySchema.statics.getCompanySizeDistribution = function() {
  return this.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: '$companySize',
        count: { $sum: 1 },
        totalEmployees: { $sum: '$stats.totalEmployees' },
        averageEmployees: { $avg: '$stats.totalEmployees' }
      }
    },
    { $sort: { count: -1 } }
  ]);
};

// Pre-save middleware
ClientCompanySchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.modifiedAt = new Date();
  }
  
  // Auto-generate display name if not provided
  if (!this.displayName) {
    this.displayName = this.companyName;
  }
  
  // Normalize company name
  if (this.companyName) {
    this.companyName = this.companyName.trim();
  }
  
  // Normalize email
  if (this.contact?.email) {
    this.contact.email = this.contact.email.toLowerCase().trim();
  }
  
  // Auto-determine company size based on employee count
  if (this.stats.totalEmployees > 0 && !this.companySize) {
    if (this.stats.totalEmployees < 50) {
      this.companySize = 'small';
    } else if (this.stats.totalEmployees < 250) {
      this.companySize = 'medium';
    } else if (this.stats.totalEmployees < 1000) {
      this.companySize = 'large';
    } else {
      this.companySize = 'enterprise';
    }
  }
  
  next();
});

export const ClientCompanyModel = mongoose.model<IClientCompany>('ClientCompany', ClientCompanySchema);
export default ClientCompanyModel;
