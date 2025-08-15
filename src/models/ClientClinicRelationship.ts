import mongoose, { Schema, Document } from 'mongoose';

export interface IClientClinicRelationship extends Document {
  id: number;
  clientId: string;
  clinicName: string;
  relationshipType: 'primary' | 'secondary' | 'temporary' | 'referral' | 'inactive';
  startDate: Date;
  endDate?: Date;
  isActive: boolean;
  isPrimary: boolean;
  
  // Access and permissions
  permissions?: {
    canSchedule: boolean;
    canViewRecords: boolean;
    canReceiveBills: boolean;
    canAuthorizeInsurance: boolean;
  };
  
  // Relationship details
  details?: {
    referredBy?: string;
    referralDate?: Date;
    referralReason?: string;
    notes?: string;
    preferredPractitioner?: string;
    preferredServices?: string[];
  };
  
  // Billing preferences
  billing?: {
    billingAddress?: {
      street?: string;
      city?: string;
      province?: string;
      postalCode?: string;
    };
    preferredPaymentMethod?: string;
    insurancePrimary?: boolean;
    specialInstructions?: string;
  };
  
  // Analytics
  stats?: {
    totalAppointments: number;
    completedAppointments: number;
    cancelledAppointments: number;
    noShowAppointments: number;
    lastAppointmentDate?: Date;
    totalAmountBilled: number;
    totalAmountPaid: number;
    averageAppointmentDuration: number;
  };
  
  createdAt: Date;
  modifiedAt?: Date;
  createdBy?: string;
  modifiedBy?: string;
}

const ClientClinicRelationshipSchema = new Schema<IClientClinicRelationship>({
  id: {
    type: Number,
    required: true,
    unique: true,
    index: true
  },
  clientId: {
    type: String,
    required: true,
    index: true
  },
  clinicName: {
    type: String,
    required: true,
    index: true
  },
  relationshipType: {
    type: String,
    enum: ['primary', 'secondary', 'temporary', 'referral', 'inactive'],
    default: 'primary',
    index: true
  },
  startDate: {
    type: Date,
    required: true,
    index: true
  },
  endDate: {
    type: Date,
    index: true,
    sparse: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  isPrimary: {
    type: Boolean,
    default: false,
    index: true
  },
  permissions: {
    canSchedule: {
      type: Boolean,
      default: true
    },
    canViewRecords: {
      type: Boolean,
      default: true
    },
    canReceiveBills: {
      type: Boolean,
      default: true
    },
    canAuthorizeInsurance: {
      type: Boolean,
      default: false
    }
  },
  details: {
    referredBy: {
      type: String,
      maxlength: 200
    },
    referralDate: {
      type: Date
    },
    referralReason: {
      type: String,
      maxlength: 500
    },
    notes: {
      type: String,
      maxlength: 1000
    },
    preferredPractitioner: {
      type: String,
      maxlength: 200
    },
    preferredServices: [{
      type: String,
      maxlength: 100
    }]
  },
  billing: {
    billingAddress: {
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
      }
    },
    preferredPaymentMethod: {
      type: String,
      maxlength: 50
    },
    insurancePrimary: {
      type: Boolean,
      default: true
    },
    specialInstructions: {
      type: String,
      maxlength: 500
    }
  },
  stats: {
    totalAppointments: {
      type: Number,
      default: 0,
      min: 0
    },
    completedAppointments: {
      type: Number,
      default: 0,
      min: 0
    },
    cancelledAppointments: {
      type: Number,
      default: 0,
      min: 0
    },
    noShowAppointments: {
      type: Number,
      default: 0,
      min: 0
    },
    lastAppointmentDate: {
      type: Date
    },
    totalAmountBilled: {
      type: Number,
      default: 0,
      min: 0
    },
    totalAmountPaid: {
      type: Number,
      default: 0,
      min: 0
    },
    averageAppointmentDuration: {
      type: Number,
      default: 60,
      min: 0
    }
  },
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
  collection: 'client_clinic_relationships'
});

// Compound indexes for optimal performance
ClientClinicRelationshipSchema.index({ clientId: 1, clinicName: 1 }, { unique: true });
ClientClinicRelationshipSchema.index({ clientId: 1, isActive: 1 });
ClientClinicRelationshipSchema.index({ clinicName: 1, isActive: 1 });
ClientClinicRelationshipSchema.index({ clinicName: 1, relationshipType: 1 });
ClientClinicRelationshipSchema.index({ isPrimary: 1, isActive: 1 });
ClientClinicRelationshipSchema.index({ startDate: -1 });
ClientClinicRelationshipSchema.index({ endDate: 1 }, { sparse: true });

// Text search index
ClientClinicRelationshipSchema.index({
  'details.referredBy': 'text',
  'details.referralReason': 'text',
  'details.notes': 'text'
});

// Instance methods
ClientClinicRelationshipSchema.methods.deactivate = function(reason?: string): void {
  this.isActive = false;
  this.endDate = new Date();
  this.modifiedAt = new Date();
  
  if (reason && this.details) {
    this.details.notes = (this.details.notes || '') + `\nDeactivated: ${reason}`;
  }
};

ClientClinicRelationshipSchema.methods.makePrimary = async function(): Promise<void> {
  // First, make all other relationships for this client non-primary
  await this.constructor.updateMany(
    { 
      clientId: this.clientId, 
      _id: { $ne: this._id },
      isActive: true 
    },
    { 
      isPrimary: false,
      modifiedAt: new Date()
    }
  );
  
  // Then make this one primary
  this.isPrimary = true;
  this.modifiedAt = new Date();
};

ClientClinicRelationshipSchema.methods.updateStats = function(appointmentData: {
  type: 'completed' | 'cancelled' | 'noshow';
  duration?: number;
  amount?: number;
  date: Date;
}): void {
  if (!this.stats) {
    this.stats = {
      totalAppointments: 0,
      completedAppointments: 0,
      cancelledAppointments: 0,
      noShowAppointments: 0,
      totalAmountBilled: 0,
      totalAmountPaid: 0,
      averageAppointmentDuration: 60
    };
  }
  
  this.stats.totalAppointments += 1;
  this.stats.lastAppointmentDate = appointmentData.date;
  
  switch (appointmentData.type) {
    case 'completed':
      this.stats.completedAppointments += 1;
      if (appointmentData.amount) {
        this.stats.totalAmountBilled += appointmentData.amount;
      }
      break;
    case 'cancelled':
      this.stats.cancelledAppointments += 1;
      break;
    case 'noshow':
      this.stats.noShowAppointments += 1;
      break;
  }
  
  // Update average duration
  if (appointmentData.duration && appointmentData.type === 'completed') {
    const totalDuration = this.stats.averageAppointmentDuration * (this.stats.completedAppointments - 1);
    this.stats.averageAppointmentDuration = Math.round(
      (totalDuration + appointmentData.duration) / this.stats.completedAppointments
    );
  }
  
  this.modifiedAt = new Date();
};

// Static methods
ClientClinicRelationshipSchema.statics.findByClient = function(clientId: string) {
  return this.find({ clientId, isActive: true })
    .sort({ isPrimary: -1, startDate: -1 })
    .lean();
};

ClientClinicRelationshipSchema.statics.findByClinic = function(
  clinicName: string, 
  relationshipType?: string
) {
  const query: any = { clinicName, isActive: true };
  
  if (relationshipType) {
    query.relationshipType = relationshipType;
  }
  
  return this.find(query)
    .sort({ startDate: -1 })
    .lean();
};

ClientClinicRelationshipSchema.statics.findPrimaryRelationship = function(clientId: string) {
  return this.findOne({ 
    clientId, 
    isActive: true, 
    isPrimary: true 
  }).lean();
};

ClientClinicRelationshipSchema.statics.getClinicStats = function(clinicName: string) {
  return this.aggregate([
    { $match: { clinicName, isActive: true } },
    {
      $group: {
        _id: '$relationshipType',
        count: { $sum: 1 },
        totalAppointments: { $sum: '$stats.totalAppointments' },
        totalRevenue: { $sum: '$stats.totalAmountBilled' }
      }
    }
  ]);
};

ClientClinicRelationshipSchema.statics.getClientDistribution = function() {
  return this.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: '$clinicName',
        totalClients: { $sum: 1 },
        primaryClients: {
          $sum: { $cond: ['$isPrimary', 1, 0] }
        },
        averageAppointments: { 
          $avg: '$stats.totalAppointments' 
        }
      }
    },
    { $sort: { totalClients: -1 } }
  ]);
};

// Pre-save middleware
ClientClinicRelationshipSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.modifiedAt = new Date();
  }
  
  // Ensure only one primary relationship per client
  if (this.isPrimary && this.isNew) {
    this.constructor.updateMany(
      { 
        clientId: this.clientId, 
        _id: { $ne: this._id },
        isActive: true 
      },
      { 
        isPrimary: false,
        modifiedAt: new Date()
      }
    ).exec();
  }
  
  // Auto-deactivate if end date is set
  if (this.endDate && this.endDate <= new Date()) {
    this.isActive = false;
  }
  
  next();
});

export const ClientClinicRelationshipModel = mongoose.model<IClientClinicRelationship>(
  'ClientClinicRelationship', 
  ClientClinicRelationshipSchema
);

export default ClientClinicRelationshipModel;
