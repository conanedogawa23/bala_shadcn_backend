import mongoose, { Schema, Document } from 'mongoose';

export interface IInsuranceCompany extends Document {
  id: number;
  companyName: string;
  companyCode?: string;
  displayName?: string;
  isActive: boolean;
  
  // Contact information
  contact: {
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
    tollFreeNumber?: string;
  };
  
  // Coverage details
  coverage: {
    orthotics?: {
      enabled: boolean;
      maxPerYear?: number;
      maxAmount?: number;
      frequency?: string;
      requiresPreAuth?: boolean;
    };
    physiotherapy?: {
      enabled: boolean;
      maxPerYear?: number;
      maxAmount?: number;
      requiresPreAuth?: boolean;
    };
    massage?: {
      enabled: boolean;
      maxPerYear?: number;
      maxAmount?: number;
      requiresPreAuth?: boolean;
    };
    compressionStockings?: {
      enabled: boolean;
      maxPerYear?: number;
      maxAmount?: number;
      requiresPreAuth?: boolean;
    };
    orthopedicShoes?: {
      enabled: boolean;
      maxPerYear?: number;
      maxAmount?: number;
      requiresPreAuth?: boolean;
    };
  };
  
  // Billing and claims
  billing: {
    directBilling?: boolean;
    claimsEmail?: string;
    claimsFax?: string;
    turnaroundDays?: number;
    preferredFormat?: 'electronic' | 'paper' | 'both';
    requiresSignature?: boolean;
    requiresReceipt?: boolean;
  };
  
  // Business rules
  businessRules: {
    cobEnabled?: boolean; // Coordination of Benefits
    dpaRequired?: boolean; // Direct Payment Authorization
    preAuthRequired?: boolean;
    ageRestrictions?: {
      minAge?: number;
      maxAge?: number;
    };
    waitingPeriod?: number; // in days
    renewalDate?: Date;
    exclusions?: string[];
  };
  
  // Statistics
  stats: {
    totalClients: number;
    activePolicies: number;
    totalClaims: number;
    approvedClaims: number;
    deniedClaims: number;
    pendingClaims: number;
    averageClaimAmount: number;
    totalClaimAmount: number;
    averageProcessingDays: number;
    lastClaimDate?: Date;
  };
  
  // Admin fields
  notes?: string;
  internalNotes?: string;
  priority: 'low' | 'medium' | 'high';
  tags?: string[];
  createdAt: Date;
  modifiedAt?: Date;
  createdBy?: string;
  modifiedBy?: string;
}

const InsuranceCompanySchema = new Schema<IInsuranceCompany>({
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
    index: true
  },
  companyCode: {
    type: String,
    maxlength: 20,
    sparse: true,
    index: true
  },
  displayName: {
    type: String,
    maxlength: 200
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
    },
    tollFreeNumber: {
      type: String,
      maxlength: 50
    }
  },
  coverage: {
    orthotics: {
      enabled: {
        type: Boolean,
        default: false
      },
      maxPerYear: {
        type: Number,
        min: 0
      },
      maxAmount: {
        type: Number,
        min: 0
      },
      frequency: {
        type: String,
        enum: ['annually', 'biannually', 'lifetime', 'per-claim'],
        default: 'annually'
      },
      requiresPreAuth: {
        type: Boolean,
        default: false
      }
    },
    physiotherapy: {
      enabled: {
        type: Boolean,
        default: false
      },
      maxPerYear: {
        type: Number,
        min: 0
      },
      maxAmount: {
        type: Number,
        min: 0
      },
      requiresPreAuth: {
        type: Boolean,
        default: false
      }
    },
    massage: {
      enabled: {
        type: Boolean,
        default: false
      },
      maxPerYear: {
        type: Number,
        min: 0
      },
      maxAmount: {
        type: Number,
        min: 0
      },
      requiresPreAuth: {
        type: Boolean,
        default: false
      }
    },
    compressionStockings: {
      enabled: {
        type: Boolean,
        default: false
      },
      maxPerYear: {
        type: Number,
        min: 0
      },
      maxAmount: {
        type: Number,
        min: 0
      },
      requiresPreAuth: {
        type: Boolean,
        default: false
      }
    },
    orthopedicShoes: {
      enabled: {
        type: Boolean,
        default: false
      },
      maxPerYear: {
        type: Number,
        min: 0
      },
      maxAmount: {
        type: Number,
        min: 0
      },
      requiresPreAuth: {
        type: Boolean,
        default: false
      }
    }
  },
  billing: {
    directBilling: {
      type: Boolean,
      default: false
    },
    claimsEmail: {
      type: String,
      maxlength: 200,
      lowercase: true
    },
    claimsFax: {
      type: String,
      maxlength: 50
    },
    turnaroundDays: {
      type: Number,
      min: 1,
      max: 90,
      default: 14
    },
    preferredFormat: {
      type: String,
      enum: ['electronic', 'paper', 'both'],
      default: 'electronic'
    },
    requiresSignature: {
      type: Boolean,
      default: true
    },
    requiresReceipt: {
      type: Boolean,
      default: true
    }
  },
  businessRules: {
    cobEnabled: {
      type: Boolean,
      default: false
    },
    dpaRequired: {
      type: Boolean,
      default: false
    },
    preAuthRequired: {
      type: Boolean,
      default: false
    },
    ageRestrictions: {
      minAge: {
        type: Number,
        min: 0,
        max: 100
      },
      maxAge: {
        type: Number,
        min: 0,
        max: 150
      }
    },
    waitingPeriod: {
      type: Number,
      min: 0,
      default: 0
    },
    renewalDate: {
      type: Date
    },
    exclusions: [{
      type: String,
      maxlength: 200
    }]
  },
  stats: {
    totalClients: {
      type: Number,
      default: 0,
      min: 0
    },
    activePolicies: {
      type: Number,
      default: 0,
      min: 0
    },
    totalClaims: {
      type: Number,
      default: 0,
      min: 0
    },
    approvedClaims: {
      type: Number,
      default: 0,
      min: 0
    },
    deniedClaims: {
      type: Number,
      default: 0,
      min: 0
    },
    pendingClaims: {
      type: Number,
      default: 0,
      min: 0
    },
    averageClaimAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    totalClaimAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    averageProcessingDays: {
      type: Number,
      default: 14,
      min: 0
    },
    lastClaimDate: {
      type: Date
    }
  },
  notes: {
    type: String,
    maxlength: 2000
  },
  internalNotes: {
    type: String,
    maxlength: 2000
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium',
    index: true
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
  },
  modifiedBy: {
    type: String,
    maxlength: 100
  }
}, {
  timestamps: true,
  collection: 'insurance_companies'
});

// Indexes for optimal performance
InsuranceCompanySchema.index({ companyName: 1, isActive: 1 });
InsuranceCompanySchema.index({ companyCode: 1 }, { sparse: true });
InsuranceCompanySchema.index({ priority: 1, isActive: 1 });
InsuranceCompanySchema.index({ 'billing.directBilling': 1, isActive: 1 });
InsuranceCompanySchema.index({ 'businessRules.cobEnabled': 1 });
InsuranceCompanySchema.index({ 'businessRules.dpaRequired': 1 });

// Text search index
InsuranceCompanySchema.index({
  companyName: 'text',
  displayName: 'text',
  companyCode: 'text',
  'contact.address.city': 'text',
  notes: 'text'
});

// Instance methods
InsuranceCompanySchema.methods.updateStats = function(claimData: {
  type: 'approved' | 'denied' | 'pending' | 'cancelled';
  amount?: number;
  processingDays?: number;
  date: Date;
}): void {
  this.stats.totalClaims += 1;
  this.stats.lastClaimDate = claimData.date;
  
  switch (claimData.type) {
  case 'approved':
    this.stats.approvedClaims += 1;
    if (claimData.amount) {
      this.stats.totalClaimAmount += claimData.amount;
      this.stats.averageClaimAmount = this.stats.totalClaimAmount / this.stats.approvedClaims;
    }
    break;
  case 'denied':
    this.stats.deniedClaims += 1;
    break;
  case 'pending':
    this.stats.pendingClaims += 1;
    break;
  }
  
  // Update average processing days
  if (claimData.processingDays && (claimData.type === 'approved' || claimData.type === 'denied')) {
    const totalProcessedClaims = this.stats.approvedClaims + this.stats.deniedClaims;
    const totalProcessingDays = this.stats.averageProcessingDays * (totalProcessedClaims - 1);
    this.stats.averageProcessingDays = Math.round(
      (totalProcessingDays + claimData.processingDays) / totalProcessedClaims
    );
  }
  
  this.modifiedAt = new Date();
};

InsuranceCompanySchema.methods.getCoverageForService = function(serviceType: string) {
  const coverageMap: { [key: string]: any } = {
    'orthotics': this.coverage.orthotics,
    'physiotherapy': this.coverage.physiotherapy,
    'massage': this.coverage.massage,
    'compression_stockings': this.coverage.compressionStockings,
    'orthopedic_shoes': this.coverage.orthopedicShoes
  };
  
  return coverageMap[serviceType] || null;
};

InsuranceCompanySchema.methods.isServiceCovered = function(serviceType: string): boolean {
  const coverage = this.getCoverageForService(serviceType);
  return coverage ? coverage.enabled : false;
};

InsuranceCompanySchema.methods.requiresPreAuth = function(serviceType: string): boolean {
  const coverage = this.getCoverageForService(serviceType);
  return coverage ? (coverage.requiresPreAuth || this.businessRules.preAuthRequired) : false;
};

// Static methods
InsuranceCompanySchema.statics.findActive = function() {
  return this.find({ isActive: true })
    .sort({ companyName: 1 })
    .lean();
};

InsuranceCompanySchema.statics.findByService = function(serviceType: string) {
  const query: any = { isActive: true };
  query[`coverage.${serviceType}.enabled`] = true;
  
  return this.find(query)
    .sort({ companyName: 1 })
    .lean();
};

InsuranceCompanySchema.statics.findDirectBilling = function() {
  return this.find({ 
    isActive: true, 
    'billing.directBilling': true 
  })
    .sort({ companyName: 1 })
    .lean();
};

InsuranceCompanySchema.statics.getPerformanceReport = function() {
  return this.aggregate([
    { $match: { isActive: true } },
    {
      $project: {
        companyName: 1,
        totalClaims: '$stats.totalClaims',
        approvalRate: {
          $cond: [
            { $gt: ['$stats.totalClaims', 0] },
            { $divide: ['$stats.approvedClaims', '$stats.totalClaims'] },
            0
          ]
        },
        averageClaimAmount: '$stats.averageClaimAmount',
        averageProcessingDays: '$stats.averageProcessingDays',
        directBilling: '$billing.directBilling'
      }
    },
    { $sort: { approvalRate: -1, averageProcessingDays: 1 } }
  ]);
};

InsuranceCompanySchema.statics.searchCompanies = function(searchTerm: string) {
  return this.find({
    $text: { $search: searchTerm },
    isActive: true
  })
    .select('companyName displayName companyCode contact.address.city billing.directBilling')
    .sort({ score: { $meta: 'textScore' } })
    .lean();
};

// Pre-save middleware
InsuranceCompanySchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.modifiedAt = new Date();
  }
  
  // Auto-generate display name if not provided
  if (!this.displayName) {
    this.displayName = this.companyName;
  }
  
  // Normalize email addresses
  if (this.contact?.email) {
    this.contact.email = this.contact.email.toLowerCase().trim();
  }
  
  if (this.billing?.claimsEmail) {
    this.billing.claimsEmail = this.billing.claimsEmail.toLowerCase().trim();
  }
  
  // Validate age restrictions
  if (this.businessRules?.ageRestrictions?.minAge && this.businessRules?.ageRestrictions?.maxAge) {
    if (this.businessRules.ageRestrictions.minAge > this.businessRules.ageRestrictions.maxAge) {
      return next(new Error('Minimum age cannot be greater than maximum age'));
    }
  }
  
  next();
});

export const InsuranceCompanyModel = mongoose.model<IInsuranceCompany>('InsuranceCompany', InsuranceCompanySchema);
export default InsuranceCompanyModel;
