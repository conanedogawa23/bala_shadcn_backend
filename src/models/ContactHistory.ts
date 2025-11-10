import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IContactHistory extends Document {
  id?: number; // Auto-generated if not provided
  clientId?: number; // Changed from string to number for consistency with other models
  clinicName?: string;
  contactType: 'call' | 'email' | 'sms' | 'visit' | 'note' | 'appointment' | 'other';
  direction: 'inbound' | 'outbound' | 'internal';
  subject?: string;
  description?: string;
  contactDate: Date;
  duration?: number; // in minutes
  outcome?: string;
  followUpRequired?: boolean;
  followUpDate?: Date;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category?: string;
  tags?: string[];
  createdBy?: string;
  createdAt: Date;
  modifiedAt?: Date;
  isActive: boolean;
  
  // Communication details
  communication?: {
    method: string;
    fromAddress?: string;
    toAddress?: string;
    phoneNumber?: string;
    emailAddress?: string;
    attachments?: string[];
  };
  
  // Appointment relation
  appointmentId?: string;
  
  // Insurance/billing context
  insuranceContext?: {
    insuranceCompany?: string;
    claimNumber?: string;
    authorizationNumber?: string;
  };
  
  // Instance methods
  markAsFollowedUp(): void;
  addTag(tag: string): void;
}

const ContactHistorySchema = new Schema<IContactHistory>({
  id: {
    type: Number,
    required: false,
    unique: true,
    sparse: true, // Allow multiple null values for new contact history
    index: true
  },
  clientId: {
    type: Schema.Types.Mixed, // Accept both String and Number for legacy data compatibility (matches Client model)
    index: true,
    sparse: true
  },
  clinicName: {
    type: String,
    required: true,
    index: true
  },
  contactType: {
    type: String,
    enum: ['call', 'email', 'sms', 'visit', 'note', 'appointment', 'other'],
    required: true,
    index: true
  },
  direction: {
    type: String,
    enum: ['inbound', 'outbound', 'internal'],
    required: true,
    index: true
  },
  subject: {
    type: String,
    maxlength: 200
  },
  description: {
    type: String,
    maxlength: 5000
  },
  contactDate: {
    type: Date,
    required: true,
    index: true
  },
  duration: {
    type: Number,
    min: 0,
    max: 600 // Max 10 hours
  },
  outcome: {
    type: String,
    maxlength: 500
  },
  followUpRequired: {
    type: Boolean,
    default: false,
    index: true
  },
  followUpDate: {
    type: Date,
    index: true,
    sparse: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
    index: true
  },
  category: {
    type: String,
    maxlength: 100,
    index: true
  },
  tags: [{
    type: String,
    maxlength: 50
  }],
  createdBy: {
    type: String,
    maxlength: 100
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
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  communication: {
    method: {
      type: String,
      maxlength: 50
    },
    fromAddress: {
      type: String,
      maxlength: 200
    },
    toAddress: {
      type: String,
      maxlength: 200
    },
    phoneNumber: {
      type: String,
      maxlength: 50
    },
    emailAddress: {
      type: String,
      maxlength: 200
    },
    attachments: [{
      type: String,
      maxlength: 500
    }]
  },
  appointmentId: {
    type: String,
    index: true,
    sparse: true
  },
  insuranceContext: {
    insuranceCompany: {
      type: String,
      maxlength: 200
    },
    claimNumber: {
      type: String,
      maxlength: 100
    },
    authorizationNumber: {
      type: String,
      maxlength: 100
    }
  }
}, {
  timestamps: true,
  collection: 'contact_history'
});

// Compound indexes for optimal query performance
ContactHistorySchema.index({ clientId: 1, contactDate: -1 });
ContactHistorySchema.index({ clinicName: 1, contactDate: -1 });
ContactHistorySchema.index({ contactType: 1, contactDate: -1 });
ContactHistorySchema.index({ followUpRequired: 1, followUpDate: 1 });
ContactHistorySchema.index({ priority: 1, contactDate: -1 });
ContactHistorySchema.index({ createdAt: -1 });

// Text index for search functionality
ContactHistorySchema.index({
  subject: 'text',
  description: 'text',
  'communication.fromAddress': 'text',
  'communication.toAddress': 'text'
});

// Instance methods
ContactHistorySchema.methods.markAsFollowedUp = function(): void {
  this.followUpRequired = false;
  this.modifiedAt = new Date();
};

ContactHistorySchema.methods.addTag = function(tag: string): void {
  if (!this.tags.includes(tag)) {
    this.tags.push(tag);
    this.modifiedAt = new Date();
  }
};

ContactHistorySchema.methods.isOverdue = function(): boolean {
  return this.followUpRequired && 
         this.followUpDate && 
         this.followUpDate < new Date();
};

// Static methods
ContactHistorySchema.statics.findByClient = function(clientId: string, limit = 50) {
  return this.find({ clientId, isActive: true })
    .sort({ contactDate: -1 })
    .limit(limit)
    .lean();
};

ContactHistorySchema.statics.findByClinic = function(clinicName: string, limit = 100) {
  return this.find({ clinicName, isActive: true })
    .sort({ contactDate: -1 })
    .limit(limit)
    .lean();
};

ContactHistorySchema.statics.findFollowUpsRequired = function(clinicName?: string) {
  const query: any = { 
    followUpRequired: true, 
    isActive: true 
  };
  
  if (clinicName) {
    query.clinicName = clinicName;
  }
  
  return this.find(query)
    .sort({ followUpDate: 1, priority: -1 })
    .lean();
};

ContactHistorySchema.statics.getRecentActivity = function(
  clinicName?: string, 
  days = 7
) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const query: any = { 
    contactDate: { $gte: startDate },
    isActive: true 
  };
  
  if (clinicName) {
    query.clinicName = clinicName;
  }
  
  return this.find(query)
    .sort({ contactDate: -1 })
    .lean();
};

// Pre-save middleware for data validation and processing
ContactHistorySchema.pre('save', async function(next) {
  // Auto-generate id if not provided (for new contact history)
  if (!this.id) {
    const ContactHistoryModelRef = this.constructor as Model<IContactHistory>;
    const highestIdDoc = await ContactHistoryModelRef.findOne()
      .sort({ id: -1 })
      .select('id')
      .lean();
    
    this.id = (highestIdDoc?.id || 0) + 1;
  }
  
  if (this.isModified() && !this.isNew) {
    this.modifiedAt = new Date();
  }
  
  // Auto-set follow-up date if not provided but required
  if (this.followUpRequired && !this.followUpDate) {
    const followUpDate = new Date(this.contactDate);
    followUpDate.setDate(followUpDate.getDate() + 7); // Default 7 days
    this.followUpDate = followUpDate;
  }
  
  // Normalize phone numbers and emails
  if (this.communication?.phoneNumber) {
    this.communication.phoneNumber = this.communication.phoneNumber.replace(/\D/g, '');
  }
  
  if (this.communication?.emailAddress) {
    this.communication.emailAddress = this.communication.emailAddress.toLowerCase();
  }
  
  next();
});

// ContactHistory model interface with static methods
interface IContactHistoryModel extends Model<IContactHistory> {
  findByClient(clientId: string, options?: any): any;
  findByClinic(clinicName: string, options?: any): any;
  findFollowUpsRequired(clinicName?: string): any;
  getRecentActivity(limit?: any, clinicName?: any): any;
}

export const ContactHistoryModel = mongoose.model<IContactHistory, IContactHistoryModel>('ContactHistory', ContactHistorySchema);
export default ContactHistoryModel;
