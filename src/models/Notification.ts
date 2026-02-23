import mongoose, { Schema, Document, Model, Types } from 'mongoose';

// Notification Type Enum
export enum NotificationType {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error'
}

// Notification Category Enum
export enum NotificationCategory {
  PAYMENT = 'payment',
  ORDER = 'order',
  APPOINTMENT = 'appointment',
  TODO = 'todo'
}

// Notification Action Enum
export enum NotificationAction {
  CREATED = 'created',
  UPDATED = 'updated',
  DELETED = 'deleted',
  STATUS_CHANGED = 'status_changed',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
  REFUNDED = 'refunded'
}

// Notification Metadata Interface
export interface INotificationMetadata {
  clientName?: string;
  orderNumber?: string;
  paymentNumber?: string;
  appointmentId?: string | number;
  amount?: number;
  status?: string;
  oldStatus?: string;
  newStatus?: string;
  [key: string]: any;
}

// Notification Interface
export interface INotification extends Document {
  _id: Types.ObjectId;
  notificationId: string;
  type: NotificationType;
  category: NotificationCategory;
  action: NotificationAction;
  title: string;
  message: string;
  clinicName: string;
  entityId: string;
  entityType: string;
  metadata?: INotificationMetadata;
  read: boolean;
  readBy: Types.ObjectId[];
  priority?: 'low' | 'medium' | 'high';
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;

  // Instance methods
  markAsRead(userId: string | Types.ObjectId): Promise<INotification>;
  isReadBy(userId: string | Types.ObjectId): boolean;
}

// Notification Model Interface
interface INotificationModel extends Model<INotification> {
  generateNotificationId(): Promise<string>;
}

// Notification Schema
const NotificationSchema = new Schema<INotification>(
  {
    notificationId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    type: {
      type: String,
      enum: Object.values(NotificationType),
      required: true,
      index: true
    },
    category: {
      type: String,
      enum: Object.values(NotificationCategory),
      required: true,
      index: true
    },
    action: {
      type: String,
      enum: Object.values(NotificationAction),
      required: true
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000
    },
    clinicName: {
      type: String,
      required: true,
      index: true
    },
    entityId: {
      type: String,
      required: true,
      index: true
    },
    entityType: {
      type: String,
      required: true,
      enum: ['Payment', 'Order', 'Appointment']
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    },
    read: {
      type: Boolean,
      default: false,
      index: true
    },
    readBy: [{
      type: Schema.Types.ObjectId,
      ref: 'User'
    }],
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
      index: true
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    expiresAt: {
      type: Date,
      required: true
    }
  },
  {
    timestamps: true,
    collection: 'notifications'
  }
);

// Indexes
NotificationSchema.index({ clinicName: 1, createdAt: -1 });
NotificationSchema.index({ clinicName: 1, read: 1, createdAt: -1 });
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

// Static Methods
NotificationSchema.statics.generateNotificationId = async function(): Promise<string> {
  const prefix = 'NOTIF';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
};

// Pre-save middleware to generate notificationId
NotificationSchema.pre('save', async function(next) {
  if (this.isNew && !this.notificationId) {
    const NotificationModel = this.constructor as INotificationModel;
    this.notificationId = await NotificationModel.generateNotificationId();
  }
  
  // Set expiration date to 30 days from creation
  if (this.isNew && !this.expiresAt) {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 30);
    this.expiresAt = expirationDate;
  }
  
  next();
});

// Instance Methods
NotificationSchema.methods.markAsRead = async function(
  userId: string | Types.ObjectId
): Promise<INotification> {
  const userObjectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
  
  if (!this.readBy.some((id: Types.ObjectId) => id.equals(userObjectId))) {
    this.readBy.push(userObjectId);
    
    // Update read status if any user has read it
    if (!this.read) {
      this.read = true;
    }
    
    await this.save();
  }
  
  return this as INotification;
};

NotificationSchema.methods.isReadBy = function(
  userId: string | Types.ObjectId
): boolean {
  const userObjectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
  return this.readBy.some((id: Types.ObjectId) => id.equals(userObjectId));
};

// Create and export model
const Notification = mongoose.model<INotification, INotificationModel>(
  'Notification',
  NotificationSchema
);

export default Notification;
