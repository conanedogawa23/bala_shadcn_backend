import { Schema, model, Document } from 'mongoose';

export interface IResource extends Document {
  resourceId: number; // ResourceID from MSSQL
  resourceName: string; // ResourceName from MSSQL
  type: 'practitioner' | 'service' | 'equipment' | 'room';
  color?: string; // For calendar display
  image?: string; // Profile image or icon
  
  // Practitioner details (if type is practitioner)
  practitioner?: {
    firstName?: string;
    lastName?: string;
    credentials?: string; // RMT, PT, MD, etc.
    licenseNumber?: string;
    specialties: string[]; // Massage, Physiotherapy, etc.
    email?: string;
    phone?: string;
  };
  
  // Service details (if type is service)
  service?: {
    category: string; // Physiotherapy, Massage, Facial
    duration: number; // Default duration in minutes
    price?: number;
    description?: string;
    requiresEquipment?: string[];
  };
  
  // Availability and scheduling
  availability: {
    monday: { start: string; end: string; available: boolean };
    tuesday: { start: string; end: string; available: boolean };
    wednesday: { start: string; end: string; available: boolean };
    thursday: { start: string; end: string; available: boolean };
    friday: { start: string; end: string; available: boolean };
    saturday: { start: string; end: string; available: boolean };
    sunday: { start: string; end: string; available: boolean };
  };
  
  // Clinic associations
  clinics: string[]; // Which clinics this resource works at
  defaultClinic?: string;
  
  // Status and metadata
  isActive: boolean;
  isBookable: boolean; // Can clients book directly
  requiresApproval: boolean; // Bookings need approval
  
  // Analytics
  stats: {
    totalAppointments: number;
    averageDuration: number;
    rating?: number;
    lastActivity?: Date;
  };
  
  // Audit fields
  dateCreated: Date;
  dateModified: Date;
  
  // Instance methods
  isAvailableOnDay(day: string): boolean;
  getAvailabilityForDay(day: string): { start: string; end: string; available: boolean } | null;
  getFullName(): string | null;
  hasSpecialty(specialty: string): boolean;
  isWorkingAtClinic(clinicName: string): boolean;
}

const ResourceSchema = new Schema<IResource>({
  resourceId: {
    type: Number,
    required: true,
    unique: true,
    index: true
  },
  resourceName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    index: true
  },
  type: {
    type: String,
    enum: ['practitioner', 'service', 'equipment', 'room'],
    required: true,
    index: true
  },
  color: {
    type: String,
    trim: true,
    maxlength: 7 // hex color
  },
  image: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  // Practitioner details
  practitioner: {
    firstName: {
      type: String,
      trim: true,
      maxlength: 50
    },
    lastName: {
      type: String,
      trim: true,
      maxlength: 50
    },
    credentials: {
      type: String,
      trim: true,
      maxlength: 100
    },
    licenseNumber: {
      type: String,
      trim: true,
      maxlength: 50
    },
    specialties: [{
      type: String,
      trim: true
    }],
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 100,
      match: [/\S+@\S+\.\S+/, 'Invalid email format']
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 20
    }
  },
  
  // Service details
  service: {
    category: {
      type: String,
      trim: true,
      maxlength: 100
    },
    duration: {
      type: Number,
      min: 15,
      max: 480 // 8 hours max
    },
    price: {
      type: Number,
      min: 0
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500
    },
    requiresEquipment: [{
      type: String,
      trim: true
    }]
  },
  
  // Availability and scheduling
  availability: {
    monday: {
      start: { type: String, default: '09:00' },
      end: { type: String, default: '17:00' },
      available: { type: Boolean, default: true }
    },
    tuesday: {
      start: { type: String, default: '09:00' },
      end: { type: String, default: '17:00' },
      available: { type: Boolean, default: true }
    },
    wednesday: {
      start: { type: String, default: '09:00' },
      end: { type: String, default: '17:00' },
      available: { type: Boolean, default: true }
    },
    thursday: {
      start: { type: String, default: '09:00' },
      end: { type: String, default: '17:00' },
      available: { type: Boolean, default: true }
    },
    friday: {
      start: { type: String, default: '09:00' },
      end: { type: String, default: '17:00' },
      available: { type: Boolean, default: true }
    },
    saturday: {
      start: { type: String, default: '09:00' },
      end: { type: String, default: '17:00' },
      available: { type: Boolean, default: false }
    },
    sunday: {
      start: { type: String, default: '09:00' },
      end: { type: String, default: '17:00' },
      available: { type: Boolean, default: false }
    }
  },
  
  // Clinic associations
  clinics: [{
    type: String,
    trim: true
  }],
  defaultClinic: {
    type: String,
    trim: true,
    index: true
  },
  
  // Status and metadata
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  isBookable: {
    type: Boolean,
    default: true
  },
  requiresApproval: {
    type: Boolean,
    default: false
  },
  
  // Analytics
  stats: {
    totalAppointments: {
      type: Number,
      default: 0,
      min: 0
    },
    averageDuration: {
      type: Number,
      default: 30,
      min: 0
    },
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    lastActivity: {
      type: Date
    }
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

// Indexes
ResourceSchema.index({ resourceId: 1 }, { unique: true });
ResourceSchema.index({ type: 1, isActive: 1 });
ResourceSchema.index({ defaultClinic: 1, isActive: 1 });
ResourceSchema.index({ 'practitioner.specialties': 1 });
ResourceSchema.index({ 'service.category': 1 });

// Text search index
ResourceSchema.index({
  resourceName: 'text',
  'practitioner.firstName': 'text',
  'practitioner.lastName': 'text',
  'service.category': 'text',
  'service.description': 'text'
});

// Instance methods
ResourceSchema.methods.isAvailableOnDay = function(day: string): boolean {
  const dayLower = day.toLowerCase();
  const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  
  if (!validDays.includes(dayLower)) return false;
  
  return this.availability[dayLower as keyof typeof this.availability]?.available || false;
};

ResourceSchema.methods.getAvailabilityForDay = function(day: string) {
  const dayLower = day.toLowerCase();
  const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  
  if (!validDays.includes(dayLower)) return null;
  
  return this.availability[dayLower as keyof typeof this.availability] || null;
};

ResourceSchema.methods.getFullName = function(): string | null {
  if (this.type === 'practitioner' && this.practitioner) {
    const { firstName, lastName } = this.practitioner;
    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    }
    if (firstName || lastName) {
      return firstName || lastName || null;
    }
  }
  return this.resourceName;
};

ResourceSchema.methods.hasSpecialty = function(specialty: string): boolean {
  if (this.type !== 'practitioner' || !this.practitioner) return false;
  
  return this.practitioner.specialties.some(s => 
    s.toLowerCase().includes(specialty.toLowerCase())
  );
};

ResourceSchema.methods.isWorkingAtClinic = function(clinicName: string): boolean {
  return this.clinics.includes(clinicName);
};

// Static methods
ResourceSchema.statics.findByType = function(type: string, clinicName?: string) {
  const query: any = { 
    type: type,
    isActive: true 
  };
  
  if (clinicName) {
    query.clinics = clinicName;
  }
  
  return this.find(query).sort({ resourceName: 1 });
};

ResourceSchema.statics.findPractitioners = function(clinicName?: string, specialty?: string) {
  const query: any = { 
    type: 'practitioner',
    isActive: true 
  };
  
  if (clinicName) {
    query.clinics = clinicName;
  }
  
  if (specialty) {
    query['practitioner.specialties'] = { $regex: specialty, $options: 'i' };
  }
  
  return this.find(query).sort({ 'practitioner.lastName': 1, 'practitioner.firstName': 1 });
};

ResourceSchema.statics.findServices = function(category?: string) {
  const query: any = { 
    type: 'service',
    isActive: true 
  };
  
  if (category) {
    query['service.category'] = { $regex: category, $options: 'i' };
  }
  
  return this.find(query).sort({ 'service.category': 1, resourceName: 1 });
};

ResourceSchema.statics.findBookableResources = function(clinicName?: string) {
  const query: any = { 
    isActive: true,
    isBookable: true
  };
  
  if (clinicName) {
    query.clinics = clinicName;
  }
  
  return this.find(query).sort({ type: 1, resourceName: 1 });
};

// Pre-save middleware
ResourceSchema.pre('save', function(next) {
  this.dateModified = new Date();
  
  // Auto-populate defaultClinic if not set
  if (!this.defaultClinic && this.clinics.length > 0) {
    this.defaultClinic = this.clinics[0];
  }
  
  // Update last activity
  this.stats.lastActivity = new Date();
  
  next();
});

export const ResourceModel = model<IResource>('Resource', ResourceSchema);
