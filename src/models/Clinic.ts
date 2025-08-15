import { Schema, model, Document, Model } from 'mongoose';

export interface IClinic extends Document {
  clinicId: number;
  name: string;
  displayName: string;
  completeName?: string;
  address: {
    street: string;
    city: string;
    province: string;
    postalCode: string;
  };
  contact: {
    phone?: string;
    fax?: string;
    email?: string;
  };
  services: string[];
  status: 'active' | 'inactive' | 'historical' | 'no-data';
  clientCount: number;
  stats: {
    totalOrders: number;
    totalRevenue: number;
    lastActivity?: Date;
  };
  dateCreated: Date;
  dateModified: Date;
  
  // Instance methods
  isActive(): boolean;
  getFullAddress(): string;
}

interface IClinicModel extends Model<IClinic> {
  findActiveClinic(): any;
}

const ClinicSchema = new Schema<IClinic>({
  clinicId: {
    type: Number,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 100
  },
  displayName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  completeName: {
    type: String,
    trim: true,
    maxlength: 200
  },
  address: {
    street: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
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
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 10
    }
  },
  contact: {
    phone: {
      type: String,
      trim: true,
      maxlength: 20
    },
    fax: {
      type: String,
      trim: true,
      maxlength: 20
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 100,
      match: [/\S+@\S+\.\S+/, 'Invalid email format']
    }
  },
  services: [{
    type: String,
    trim: true
  }],
  status: {
    type: String,
    enum: ['active', 'inactive', 'historical', 'no-data'],
    default: 'active',
    index: true
  },
  clientCount: {
    type: Number,
    default: 0,
    min: 0
  },
  stats: {
    totalOrders: {
      type: Number,
      default: 0,
      min: 0
    },
    totalRevenue: {
      type: Number,
      default: 0,
      min: 0
    },
    lastActivity: {
      type: Date
    }
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
      if ('__v' in ret) {
        delete (ret as any).__v;
      }
      return ret;
    }
  }
});

// Indexes for performance
ClinicSchema.index({ clinicId: 1 }, { unique: true });
ClinicSchema.index({ name: 1 }, { unique: true });
ClinicSchema.index({ status: 1 });
ClinicSchema.index({ 'address.city': 1 });
ClinicSchema.index({ 'address.province': 1 });

// Instance methods
ClinicSchema.methods.isActive = function(): boolean {
  return this.status === 'active';
};

ClinicSchema.methods.getFullAddress = function(): string {
  const { street, city, province, postalCode } = this.address;
  return `${street}, ${city}, ${province} ${postalCode}`;
};

// Static methods
ClinicSchema.statics.findActiveClinic = function() {
  return this.find({ status: 'active' }).sort({ name: 1 });
};

ClinicSchema.statics.findByStatus = function(status: string) {
  return this.find({ status }).sort({ name: 1 });
};

// Pre-save middleware
ClinicSchema.pre('save', function(next) {
  this.dateModified = new Date();
  next();
});

export const ClinicModel = model<IClinic, IClinicModel>('Clinic', ClinicSchema);
