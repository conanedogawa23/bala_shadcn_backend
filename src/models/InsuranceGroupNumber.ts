import mongoose, { Schema, Document } from 'mongoose';

export interface IInsuranceGroupNumber extends Document {
  id: number;
  groupNumber: string;
  insuranceCompanyId?: number;
  planName?: string;
  planType: 'individual' | 'group' | 'family' | 'corporate';
  isActive: boolean;
  
  // Plan details
  planDetails: {
    effectiveDate?: Date;
    expiryDate?: Date;
    renewalDate?: Date;
    policyHolderType?: 'employee' | 'dependent' | 'retiree' | 'cobra';
    waitingPeriod?: number; // in days
    deductible?: number;
    maximumBenefit?: number;
    networkType?: 'PPO' | 'HMO' | 'EPO' | 'POS' | 'open';
  };
  
  // Coverage specifications
  coverage: {
    orthotics?: {
      enabled: boolean;
      maxAmount?: number;
      maxPairs?: number;
      frequency?: 'annual' | 'biannual' | 'lifetime';
      coPayment?: number;
      coInsurance?: number;
    };
    physiotherapy?: {
      enabled: boolean;
      maxSessions?: number;
      maxAmount?: number;
      coPayment?: number;
      coInsurance?: number;
      requiresReferral?: boolean;
    };
    massage?: {
      enabled: boolean;
      maxSessions?: number;
      maxAmount?: number;
      coPayment?: number;
      coInsurance?: number;
      requiresReferral?: boolean;
    };
    compression?: {
      enabled: boolean;
      maxAmount?: number;
      maxPairs?: number;
      frequency?: 'annual' | 'biannual' | 'lifetime';
    };
    shoes?: {
      enabled: boolean;
      maxAmount?: number;
      maxPairs?: number;
      frequency?: 'annual' | 'biannual' | 'lifetime';
    };
  };
  
  // Authorization requirements
  authorization: {
    preAuthRequired: boolean;
    dpaRequired: boolean; // Direct Payment Authorization
    cobEnabled: boolean; // Coordination of Benefits
    eligibilityVerification: boolean;
    priorApprovalServices?: string[];
  };
  
  // Usage statistics
  stats: {
    totalMembers: number;
    activeMembers: number;
    totalClaims: number;
    approvedClaims: number;
    deniedClaims: number;
    pendingClaims: number;
    totalClaimAmount: number;
    averageClaimAmount: number;
    lastClaimDate?: Date;
  };
  
  // Administrative
  notes?: string;
  internalNotes?: string;
  tags?: string[];
  createdAt: Date;
  modifiedAt?: Date;
  createdBy?: string;
}

const InsuranceGroupNumberSchema = new Schema<IInsuranceGroupNumber>({
  id: {
    type: Number,
    required: true,
    unique: true,
    index: true
  },
  groupNumber: {
    type: String,
    required: true,
    maxlength: 50,
    index: true,
    trim: true
  },
  insuranceCompanyId: {
    type: Number,
    index: true,
    sparse: true
  },
  planName: {
    type: String,
    maxlength: 200,
    trim: true
  },
  planType: {
    type: String,
    enum: ['individual', 'group', 'family', 'corporate'],
    required: true,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  planDetails: {
    effectiveDate: {
      type: Date,
      index: true
    },
    expiryDate: {
      type: Date,
      index: true
    },
    renewalDate: {
      type: Date,
      index: true
    },
    policyHolderType: {
      type: String,
      enum: ['employee', 'dependent', 'retiree', 'cobra']
    },
    waitingPeriod: {
      type: Number,
      min: 0,
      max: 365,
      default: 0
    },
    deductible: {
      type: Number,
      min: 0,
      default: 0
    },
    maximumBenefit: {
      type: Number,
      min: 0
    },
    networkType: {
      type: String,
      enum: ['PPO', 'HMO', 'EPO', 'POS', 'open']
    }
  },
  coverage: {
    orthotics: {
      enabled: {
        type: Boolean,
        default: false
      },
      maxAmount: {
        type: Number,
        min: 0
      },
      maxPairs: {
        type: Number,
        min: 0
      },
      frequency: {
        type: String,
        enum: ['annual', 'biannual', 'lifetime'],
        default: 'annual'
      },
      coPayment: {
        type: Number,
        min: 0
      },
      coInsurance: {
        type: Number,
        min: 0,
        max: 100
      }
    },
    physiotherapy: {
      enabled: {
        type: Boolean,
        default: false
      },
      maxSessions: {
        type: Number,
        min: 0
      },
      maxAmount: {
        type: Number,
        min: 0
      },
      coPayment: {
        type: Number,
        min: 0
      },
      coInsurance: {
        type: Number,
        min: 0,
        max: 100
      },
      requiresReferral: {
        type: Boolean,
        default: false
      }
    },
    massage: {
      enabled: {
        type: Boolean,
        default: false
      },
      maxSessions: {
        type: Number,
        min: 0
      },
      maxAmount: {
        type: Number,
        min: 0
      },
      coPayment: {
        type: Number,
        min: 0
      },
      coInsurance: {
        type: Number,
        min: 0,
        max: 100
      },
      requiresReferral: {
        type: Boolean,
        default: false
      }
    },
    compression: {
      enabled: {
        type: Boolean,
        default: false
      },
      maxAmount: {
        type: Number,
        min: 0
      },
      maxPairs: {
        type: Number,
        min: 0
      },
      frequency: {
        type: String,
        enum: ['annual', 'biannual', 'lifetime'],
        default: 'annual'
      }
    },
    shoes: {
      enabled: {
        type: Boolean,
        default: false
      },
      maxAmount: {
        type: Number,
        min: 0
      },
      maxPairs: {
        type: Number,
        min: 0
      },
      frequency: {
        type: String,
        enum: ['annual', 'biannual', 'lifetime'],
        default: 'annual'
      }
    }
  },
  authorization: {
    preAuthRequired: {
      type: Boolean,
      default: false,
      index: true
    },
    dpaRequired: {
      type: Boolean,
      default: false,
      index: true
    },
    cobEnabled: {
      type: Boolean,
      default: false,
      index: true
    },
    eligibilityVerification: {
      type: Boolean,
      default: true
    },
    priorApprovalServices: [{
      type: String,
      maxlength: 100
    }]
  },
  stats: {
    totalMembers: {
      type: Number,
      default: 0,
      min: 0
    },
    activeMembers: {
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
    totalClaimAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    averageClaimAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    lastClaimDate: {
      type: Date,
      index: true
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
  collection: 'insurance_group_numbers'
});

// Compound indexes for optimal performance
InsuranceGroupNumberSchema.index({ groupNumber: 1, insuranceCompanyId: 1 }, { unique: true });
InsuranceGroupNumberSchema.index({ insuranceCompanyId: 1, isActive: 1 });
InsuranceGroupNumberSchema.index({ planType: 1, isActive: 1 });
InsuranceGroupNumberSchema.index({ 'planDetails.effectiveDate': 1, 'planDetails.expiryDate': 1 });
InsuranceGroupNumberSchema.index({ 'authorization.preAuthRequired': 1 });
InsuranceGroupNumberSchema.index({ 'stats.activeMembers': -1 });

// Text search index
InsuranceGroupNumberSchema.index({
  groupNumber: 'text',
  planName: 'text',
  notes: 'text'
});

// Instance methods
InsuranceGroupNumberSchema.methods.updateClaimStats = function(claimData: {
  type: 'approved' | 'denied' | 'pending';
  amount?: number;
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
  
  this.modifiedAt = new Date();
};

InsuranceGroupNumberSchema.methods.addMember = function(): void {
  this.stats.totalMembers += 1;
  this.stats.activeMembers += 1;
  this.modifiedAt = new Date();
};

InsuranceGroupNumberSchema.methods.removeMember = function(): void {
  if (this.stats.activeMembers > 0) {
    this.stats.activeMembers -= 1;
    this.modifiedAt = new Date();
  }
};

InsuranceGroupNumberSchema.methods.isServiceCovered = function(serviceType: string): boolean {
  const coverageMap: Record<string, boolean> = {
    'orthotics': this.coverage.orthotics?.enabled || false,
    'physiotherapy': this.coverage.physiotherapy?.enabled || false,
    'massage': this.coverage.massage?.enabled || false,
    'compression': this.coverage.compression?.enabled || false,
    'shoes': this.coverage.shoes?.enabled || false
  };
  
  return coverageMap[serviceType] || false;
};

InsuranceGroupNumberSchema.methods.getCoverageDetails = function(serviceType: string) {
  const coverageMap: Record<string, any> = {
    'orthotics': this.coverage.orthotics,
    'physiotherapy': this.coverage.physiotherapy,
    'massage': this.coverage.massage,
    'compression': this.coverage.compression,
    'shoes': this.coverage.shoes
  };
  
  return coverageMap[serviceType] || null;
};

InsuranceGroupNumberSchema.methods.requiresPreAuth = function(serviceType?: string): boolean {
  if (this.authorization.preAuthRequired) {
    return true;
  }
  
  if (serviceType && this.authorization.priorApprovalServices) {
    return this.authorization.priorApprovalServices.includes(serviceType);
  }
  
  return false;
};

InsuranceGroupNumberSchema.methods.isExpired = function(): boolean {
  return this.planDetails.expiryDate ? this.planDetails.expiryDate < new Date() : false;
};

InsuranceGroupNumberSchema.methods.isRenewalDue = function(daysAhead: number = 30): boolean {
  if (!this.planDetails.renewalDate) return false;
  
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);
  
  return this.planDetails.renewalDate <= futureDate;
};

// Static methods
InsuranceGroupNumberSchema.statics.findByInsuranceCompany = function(companyId: number) {
  return this.find({ 
    insuranceCompanyId: companyId, 
    isActive: true 
  })
    .sort({ groupNumber: 1 })
    .lean();
};

InsuranceGroupNumberSchema.statics.findByPlanType = function(planType: string) {
  return this.find({ 
    planType, 
    isActive: true 
  })
    .sort({ 'stats.activeMembers': -1 })
    .lean();
};

InsuranceGroupNumberSchema.statics.findActiveGroups = function() {
  return this.find({ 
    isActive: true,
    $or: [
      { 'planDetails.expiryDate': { $exists: false } },
      { 'planDetails.expiryDate': { $gte: new Date() } }
    ]
  })
    .sort({ 'stats.activeMembers': -1 })
    .lean();
};

InsuranceGroupNumberSchema.statics.findExpiringGroups = function(daysAhead: number = 30) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);
  
  return this.find({
    isActive: true,
    'planDetails.expiryDate': {
      $gte: new Date(),
      $lte: futureDate
    }
  })
    .sort({ 'planDetails.expiryDate': 1 })
    .lean();
};

InsuranceGroupNumberSchema.statics.findRenewalsDue = function(daysAhead: number = 30) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);
  
  return this.find({
    isActive: true,
    'planDetails.renewalDate': {
      $gte: new Date(),
      $lte: futureDate
    }
  })
    .sort({ 'planDetails.renewalDate': 1 })
    .lean();
};

InsuranceGroupNumberSchema.statics.getGroupStats = function() {
  return this.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: '$planType',
        totalGroups: { $sum: 1 },
        totalMembers: { $sum: '$stats.totalMembers' },
        totalClaims: { $sum: '$stats.totalClaims' },
        totalClaimAmount: { $sum: '$stats.totalClaimAmount' },
        averageGroupSize: { $avg: '$stats.activeMembers' }
      }
    },
    {
      $project: {
        planType: '$_id',
        totalGroups: 1,
        totalMembers: 1,
        totalClaims: 1,
        totalClaimAmount: 1,
        averageGroupSize: { $round: ['$averageGroupSize', 0] },
        averageClaimAmount: {
          $cond: [
            { $gt: ['$totalClaims', 0] },
            { $divide: ['$totalClaimAmount', '$totalClaims'] },
            0
          ]
        }
      }
    },
    { $sort: { totalMembers: -1 } }
  ]);
};

InsuranceGroupNumberSchema.statics.getCoverageReport = function() {
  return this.aggregate([
    { $match: { isActive: true } },
    {
      $project: {
        groupNumber: 1,
        planName: 1,
        totalMembers: '$stats.totalMembers',
        orthoticsCovered: '$coverage.orthotics.enabled',
        physiotherapyCovered: '$coverage.physiotherapy.enabled',
        massageCovered: '$coverage.massage.enabled',
        compressionCovered: '$coverage.compression.enabled',
        shoesCovered: '$coverage.shoes.enabled'
      }
    },
    {
      $group: {
        _id: null,
        totalGroups: { $sum: 1 },
        orthoticsGroups: { $sum: { $cond: ['$orthoticsCovered', 1, 0] } },
        physiotherapyGroups: { $sum: { $cond: ['$physiotherapyCovered', 1, 0] } },
        massageGroups: { $sum: { $cond: ['$massageCovered', 1, 0] } },
        compressionGroups: { $sum: { $cond: ['$compressionCovered', 1, 0] } },
        shoesGroups: { $sum: { $cond: ['$shoesCovered', 1, 0] } }
      }
    }
  ]);
};

// Pre-save middleware
InsuranceGroupNumberSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.modifiedAt = new Date();
  }
  
  // Normalize group number
  if (this.groupNumber) {
    this.groupNumber = this.groupNumber.trim().toUpperCase();
  }
  
  // Validate date relationships
  if (this.planDetails.effectiveDate && this.planDetails.expiryDate) {
    if (this.planDetails.effectiveDate >= this.planDetails.expiryDate) {
      return next(new Error('Effective date must be before expiry date'));
    }
  }
  
  // Auto-deactivate if expired
  if (this.planDetails.expiryDate && this.planDetails.expiryDate < new Date()) {
    this.isActive = false;
  }
  
  next();
});

export const InsuranceGroupNumberModel = mongoose.model<IInsuranceGroupNumber>('InsuranceGroupNumber', InsuranceGroupNumberSchema);
export default InsuranceGroupNumberModel;
