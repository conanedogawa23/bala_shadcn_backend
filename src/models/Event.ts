import { Schema, model, Document, Model } from 'mongoose';

export interface IEvent extends Document {
  eventId?: number; // event_id from MSSQL (auto-generated if not provided)
  parentEventId?: number; // event_parent_id - for hierarchical events
  userId?: number; // user_id - event creator/owner
  categoryId?: number; // category_id - event category
  
  // Basic event information
  title: string; // event_title
  description?: string; // event_desc
  eventDate: Date; // event_date
  eventTime?: Date; // event_time - start time
  eventTimeEnd?: Date; // event_time_end - end time
  location?: string; // event_location
  cost?: string; // event_cost
  url?: string; // event_url
  
  // Event status and visibility
  isPublic: boolean; // event_is_public
  isApproved: boolean; // event_is_approved
  
  // Custom fields (flexible content)
  customTextBox1?: string; // custom_TextBox1
  customTextBox2?: string; // custom_TextBox2
  customTextBox3?: string; // custom_TextBox3
  customTextArea1?: string; // custom_TextArea1
  customTextArea2?: string; // custom_TextArea2
  customTextArea3?: string; // custom_TextArea3
  customCheckBox1?: boolean; // custom_CheckBox1
  customCheckBox2?: boolean; // custom_CheckBox2
  customCheckBox3?: boolean; // custom_CheckBox3
  
  // Client relationship
  clientId?: string; // sb_client_id
  clientFullName?: string; // sb_client_full_name
  clientClinicName?: string; // sb_client_clinic_name
  
  // Metadata
  dateAdded: Date; // event_date_add
  userAdded?: number; // event_user_add
  
  // Audit fields
  dateCreated: Date;
  dateModified: Date;
  
  // Instance methods
  isUpcoming(): boolean;
  isPast(): boolean;
  isToday(): boolean;
  getDuration(): number; // in minutes
  getFormattedDuration(): string;
  hasClientAssociated(): boolean;
}

const EventSchema = new Schema<IEvent>({
  eventId: {
    type: Number,
    required: false,
    unique: true,
    sparse: true, // Allow multiple null values for new events
    index: true
  },
  parentEventId: {
    type: Number,
    index: true
  },
  userId: {
    type: Number,
    index: true
  },
  categoryId: {
    type: Number,
    index: true
  },
  
  // Basic event information
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    index: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: 2000
  },
  eventDate: {
    type: Date,
    required: true,
    index: true
  },
  eventTime: {
    type: Date,
    index: true
  },
  eventTimeEnd: {
    type: Date,
    index: true
  },
  location: {
    type: String,
    trim: true,
    maxlength: 500
  },
  cost: {
    type: String,
    trim: true,
    maxlength: 50
  },
  url: {
    type: String,
    trim: true,
    maxlength: 250
  },
  
  // Event status and visibility
  isPublic: {
    type: Boolean,
    default: false,
    index: true
  },
  isApproved: {
    type: Boolean,
    default: false,
    index: true
  },
  
  // Custom fields - flexible content storage
  customTextBox1: {
    type: String,
    trim: true,
    maxlength: 250
  },
  customTextBox2: {
    type: String,
    trim: true,
    maxlength: 250
  },
  customTextBox3: {
    type: String,
    trim: true,
    maxlength: 250
  },
  customTextArea1: {
    type: String,
    trim: true,
    maxlength: 2000
  },
  customTextArea2: {
    type: String,
    trim: true,
    maxlength: 2000
  },
  customTextArea3: {
    type: String,
    trim: true,
    maxlength: 2000
  },
  customCheckBox1: {
    type: Boolean,
    default: false
  },
  customCheckBox2: {
    type: Boolean,
    default: false
  },
  customCheckBox3: {
    type: Boolean,
    default: false
  },
  
  // Client relationship
  clientId: {
    type: Schema.Types.Mixed, // Accept both String and Number for legacy data compatibility (matches Client model)
    index: true
  },
  clientFullName: {
    type: String,
    trim: true,
    maxlength: 200,
    index: true
  },
  clientClinicName: {
    type: String,
    trim: true,
    maxlength: 100,
    index: true
  },
  
  // Metadata
  dateAdded: {
    type: Date,
    default: Date.now,
    index: true
  },
  userAdded: {
    type: Number,
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
EventSchema.index({ eventDate: 1, isPublic: 1, isApproved: 1 });
EventSchema.index({ clientId: 1, eventDate: 1 });
EventSchema.index({ categoryId: 1, eventDate: 1 });
EventSchema.index({ userId: 1, eventDate: 1 });
EventSchema.index({ parentEventId: 1, eventDate: 1 });
EventSchema.index({ clientClinicName: 1, eventDate: 1 });

// Text search index
EventSchema.index({
  title: 'text',
  description: 'text',
  location: 'text',
  clientFullName: 'text'
});

// Instance methods
EventSchema.methods.isUpcoming = function(): boolean {
  const eventDateTime = this.eventTime || this.eventDate;
  return new Date(eventDateTime) > new Date();
};

EventSchema.methods.isPast = function(): boolean {
  const eventDateTime = this.eventTimeEnd || this.eventTime || this.eventDate;
  return new Date(eventDateTime) < new Date();
};

EventSchema.methods.isToday = function(): boolean {
  const today = new Date();
  const eventDate = new Date(this.eventDate);
  
  return today.getFullYear() === eventDate.getFullYear() &&
         today.getMonth() === eventDate.getMonth() &&
         today.getDate() === eventDate.getDate();
};

EventSchema.methods.getDuration = function(): number {
  if (this.eventTime && this.eventTimeEnd) {
    const start = new Date(this.eventTime);
    const end = new Date(this.eventTimeEnd);
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60));
  }
  return 0;
};

EventSchema.methods.getFormattedDuration = function(): string {
  const minutes = this.getDuration();
  if (minutes <= 0) {return 'Duration not specified';}
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (hours > 0) {
    return `${hours}h ${remainingMinutes}m`;
  }
  return `${minutes}m`;
};

EventSchema.methods.hasClientAssociated = function(): boolean {
  return !!(this.clientId && this.clientId.trim().length > 0);
};

// Static methods
EventSchema.statics.findUpcoming = function(limit?: number) {
  const query = this.find({
    eventDate: { $gte: new Date() },
    isApproved: true
  }).sort({ eventDate: 1 });
  
  return limit ? query.limit(limit) : query;
};

EventSchema.statics.findByDateRange = function(startDate: Date, endDate: Date) {
  return this.find({
    eventDate: { $gte: startDate, $lte: endDate }
  }).sort({ eventDate: 1, eventTime: 1 });
};

EventSchema.statics.findByClient = function(clientId: string) {
  return this.find({ 
    clientId: clientId 
  }).sort({ eventDate: -1 });
};

EventSchema.statics.findByCategory = function(categoryId: number) {
  return this.find({ 
    categoryId: categoryId,
    isApproved: true 
  }).sort({ eventDate: 1 });
};

EventSchema.statics.findByClinic = function(clinicName: string) {
  return this.find({ 
    clientClinicName: new RegExp(clinicName, 'i') 
  }).sort({ eventDate: -1 });
};

EventSchema.statics.findPublicEvents = function(startDate?: Date, endDate?: Date) {
  const query: any = {
    isPublic: true,
    isApproved: true
  };
  
  if (startDate && endDate) {
    query.eventDate = { $gte: startDate, $lte: endDate };
  } else if (startDate) {
    query.eventDate = { $gte: startDate };
  }
  
  return this.find(query).sort({ eventDate: 1 });
};

EventSchema.statics.findPendingApproval = function() {
  return this.find({ 
    isApproved: false 
  }).sort({ dateAdded: 1 });
};

// Pre-save middleware
EventSchema.pre('save', async function(next) {
  // Auto-generate eventId if not provided (for new events)
  if (!this.eventId) {
    const EventModelRef = this.constructor as Model<IEvent>;
    const highestIdDoc = await EventModelRef.findOne()
      .sort({ eventId: -1 })
      .select('eventId')
      .lean();
    
    this.eventId = (highestIdDoc?.eventId || 0) + 1;
  }
  
  this.dateModified = new Date();
  
  // Ensure event date is properly set
  if (!this.eventDate && this.eventTime) {
    this.eventDate = this.eventTime;
  }
  
  // If eventTimeEnd is before eventTime, swap them
  if (this.eventTime && this.eventTimeEnd && this.eventTimeEnd < this.eventTime) {
    const temp = this.eventTime;
    this.eventTime = this.eventTimeEnd;
    this.eventTimeEnd = temp;
  }
  
  next();
});

// Add static methods to the schema
EventSchema.statics.findUpcoming = function(limit: number = 50) {
  const now = new Date();
  return this.find({ 
    eventDate: { $gte: now },
    isApproved: true 
  }).sort({ eventDate: 1 }).limit(limit);
};

EventSchema.statics.findByDateRange = function(startDate: Date, endDate: Date) {
  return this.find({
    eventDate: { $gte: startDate, $lte: endDate }
  }).sort({ eventDate: 1 });
};

EventSchema.statics.findByClient = function(clientId: string) {
  return this.find({ clientId }).sort({ eventDate: -1 });
};

EventSchema.statics.findByCategory = function(categoryId: string) {
  return this.find({ categoryId }).sort({ eventDate: -1 });
};

EventSchema.statics.findByClinic = function(clinicName: string) {
  return this.find({ clientClinicName: new RegExp(clinicName, 'i') }).sort({ eventDate: -1 });
};

EventSchema.statics.findPublicEvents = function(startDate?: Date, endDate?: Date) {
  const query: any = { isPublic: true, isApproved: true };
  
  if (startDate && endDate) {
    query.eventDate = { $gte: startDate, $lte: endDate };
  }
  
  return this.find(query).sort({ eventDate: 1 });
};

EventSchema.statics.findPendingApproval = function() {
  return this.find({ isApproved: false }).sort({ dateCreated: -1 });
};

// Event model interface with static methods
interface IEventModel extends Model<IEvent> {
  findUpcoming(daysAhead?: number): any;
  findByDateRange(startDate: Date, endDate: Date): any;
  findByClient(clientId: string): any;
  findByCategory(categoryId: number): any;
  findByClinic(clinicName: string): any;
  findPublicEvents(startDate?: Date, endDate?: Date): any;
  findPendingApproval(): any;
}

export const EventModel = model<IEvent, IEventModel>('Event', EventSchema);
