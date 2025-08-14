import { Schema, model, Document } from 'mongoose';

export interface IAppointment extends Document {
  appointmentId?: number; // ID from MSSQL
  type: number; // Type from MSSQL
  startDate: Date;
  endDate: Date;
  allDay?: boolean;
  subject: string; // Often client name or service type
  location?: string;
  description?: string;
  status: number; // 0 = scheduled, 1 = completed, 2 = cancelled, etc.
  label: number; // Color/category label
  resourceId: number; // Links to practitioner/service
  duration: number; // in minutes
  
  // Client and billing information
  clientId: string; // Links to Client
  clientKey?: number; // MSSQL client key reference
  productKey?: number; // Service/product being provided
  
  // Billing and invoice tracking
  billDate?: Date;
  invoiceDate?: Date;
  readyToBill: boolean;
  advancedBilling: boolean;
  advancedBillingId?: number;
  
  // Clinic and practitioner
  clinicName: string;
  resourceName?: string; // Populated from Resource model
  
  // Scheduling metadata
  reminderInfo?: string; // JSON string for reminder settings
  recurrenceInfo?: string; // JSON string for recurring appointments
  isActive: boolean;
  shadowId?: number; // For appointment shadows/copies
  groupId?: string; // For grouped appointments
  
  // Audit fields
  dateCreated: Date;
  dateModified: Date;
  
  // Instance methods
  getDurationMinutes(): number;
  isCompleted(): boolean;
  isPast(): boolean;
  isFuture(): boolean;
  isToday(): boolean;
  canBeBilled(): boolean;
  getFormattedDuration(): string;
}

const AppointmentSchema = new Schema<IAppointment>({
  appointmentId: {
    type: Number,
    index: true
  },
  type: {
    type: Number,
    required: true,
    default: 0,
    index: true
  },
  startDate: {
    type: Date,
    required: true,
    index: true
  },
  endDate: {
    type: Date,
    required: true,
    index: true
  },
  allDay: {
    type: Boolean,
    default: false
  },
  subject: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
    index: true
  },
  location: {
    type: String,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  status: {
    type: Number,
    required: true,
    default: 0,
    index: true
  },
  label: {
    type: Number,
    default: 0,
    index: true
  },
  resourceId: {
    type: Number,
    required: true,
    index: true
  },
  duration: {
    type: Number,
    required: true,
    default: 30,
    min: 0
  },
  
  // Client and billing information
  clientId: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  clientKey: {
    type: Number,
    index: true
  },
  productKey: {
    type: Number,
    index: true
  },
  
  // Billing and invoice tracking
  billDate: {
    type: Date,
    index: true
  },
  invoiceDate: {
    type: Date,
    index: true
  },
  readyToBill: {
    type: Boolean,
    default: false,
    index: true
  },
  advancedBilling: {
    type: Boolean,
    default: false
  },
  advancedBillingId: {
    type: Number
  },
  
  // Clinic and practitioner
  clinicName: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  resourceName: {
    type: String,
    trim: true,
    maxlength: 100
  },
  
  // Scheduling metadata
  reminderInfo: {
    type: String,
    trim: true
  },
  recurrenceInfo: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  shadowId: {
    type: Number,
    default: 0
  },
  groupId: {
    type: String,
    trim: true,
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
AppointmentSchema.index({ clinicName: 1, startDate: 1 });
AppointmentSchema.index({ clientId: 1, startDate: 1 });
AppointmentSchema.index({ resourceId: 1, startDate: 1 });
AppointmentSchema.index({ startDate: 1, endDate: 1 }); // For time slot conflicts
AppointmentSchema.index({ billDate: 1, readyToBill: 1 }); // For billing queries
AppointmentSchema.index({ status: 1, isActive: 1 });

// Text search index
AppointmentSchema.index({
  subject: 'text',
  description: 'text',
  location: 'text'
});

// Instance methods
AppointmentSchema.methods.getDurationMinutes = function(): number {
  if (this.duration > 0) return this.duration;
  
  // Calculate from start/end dates if duration is not set
  const start = new Date(this.startDate);
  const end = new Date(this.endDate);
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60));
};

AppointmentSchema.methods.isCompleted = function(): boolean {
  return this.status === 1; // Assuming 1 = completed
};

AppointmentSchema.methods.isPast = function(): boolean {
  return new Date(this.endDate) < new Date();
};

AppointmentSchema.methods.isFuture = function(): boolean {
  return new Date(this.startDate) > new Date();
};

AppointmentSchema.methods.isToday = function(): boolean {
  const today = new Date();
  const appointmentDate = new Date(this.startDate);
  
  return today.getFullYear() === appointmentDate.getFullYear() &&
         today.getMonth() === appointmentDate.getMonth() &&
         today.getDate() === appointmentDate.getDate();
};

AppointmentSchema.methods.canBeBilled = function(): boolean {
  return this.isCompleted() && this.readyToBill && !this.invoiceDate;
};

AppointmentSchema.methods.getFormattedDuration = function(): string {
  const minutes = this.getDurationMinutes();
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (hours > 0) {
    return `${hours}h ${remainingMinutes}m`;
  }
  return `${minutes}m`;
};

// Static methods
AppointmentSchema.statics.findByClinic = function(clinicName: string, startDate?: Date, endDate?: Date) {
  const query: any = { 
    clinicName: clinicName,
    isActive: true 
  };
  
  if (startDate && endDate) {
    query.startDate = { $gte: startDate, $lte: endDate };
  }
  
  return this.find(query).sort({ startDate: 1 });
};

AppointmentSchema.statics.findByClient = function(clientId: string) {
  return this.find({ 
    clientId: clientId,
    isActive: true 
  }).sort({ startDate: -1 });
};

AppointmentSchema.statics.findByResource = function(resourceId: number, date?: Date) {
  const query: any = { 
    resourceId: resourceId,
    isActive: true 
  };
  
  if (date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    query.startDate = { $gte: startOfDay, $lte: endOfDay };
  }
  
  return this.find(query).sort({ startDate: 1 });
};

AppointmentSchema.statics.findReadyToBill = function(clinicName?: string) {
  const query: any = {
    readyToBill: true,
    invoiceDate: { $exists: false },
    isActive: true
  };
  
  if (clinicName) {
    query.clinicName = clinicName;
  }
  
  return this.find(query).sort({ billDate: 1 });
};

AppointmentSchema.statics.checkTimeSlotConflict = function(
  resourceId: number, 
  startDate: Date, 
  endDate: Date, 
  excludeAppointmentId?: string
) {
  const query: any = {
    resourceId: resourceId,
    isActive: true,
    $or: [
      // New appointment starts during existing appointment
      { startDate: { $lte: startDate }, endDate: { $gt: startDate } },
      // New appointment ends during existing appointment
      { startDate: { $lt: endDate }, endDate: { $gte: endDate } },
      // New appointment completely contains existing appointment
      { startDate: { $gte: startDate }, endDate: { $lte: endDate } }
    ]
  };
  
  if (excludeAppointmentId) {
    query._id = { $ne: excludeAppointmentId };
  }
  
  return this.find(query);
};

// Pre-save middleware
AppointmentSchema.pre('save', function(next) {
  this.dateModified = new Date();
  
  // Calculate duration if not provided
  if (!this.duration || this.duration === 0) {
    const start = new Date(this.startDate);
    const end = new Date(this.endDate);
    this.duration = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
  }
  
  // Set bill date if appointment is marked ready to bill
  if (this.readyToBill && !this.billDate) {
    this.billDate = new Date();
  }
  
  next();
});

export const AppointmentModel = model<IAppointment>('Appointment', AppointmentSchema);
